// Rule Edit/Delete Handlers
// Separate module to keep server-detail.js manageable

import { classifyRule, getRuleCounts, escapeHtml } from '../utils.js';

/**
 * Handle clicking the edit button on a rule
 */
export function handleEditRule(ruleItem, serverId, allRules, ruleIndex) {
    // Prevent editing if already in edit mode
    if (ruleItem.classList.contains('editing')) return;

    const originalRule = allRules[ruleIndex];
    const ruleTextSpan = ruleItem.querySelector('.rule-text');
    const actionsDiv = ruleItem.querySelector('.rule-actions');

    // Enter edit mode
    ruleItem.classList.add('editing');

    // Create input
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'rule-edit-input';
    input.value = originalRule;
    input.style.cssText = 'flex:1;font-family:monospace;font-size:12px;padding:2px 4px;background:rgba(0,0,0,0.3);border:1px solid #4caf50;border-radius:3px;color:#fff;outline:none;height:18px;line-height:14px;margin-right:4px;';

    // Create edit actions as inline buttons
    const editActions = document.createElement('span');
    editActions.className = 'rule-edit-actions';
    editActions.style.cssText = 'display:inline;float:right;white-space:nowrap;';
    editActions.innerHTML = `<button class="btn btn-sm btn-primary" data-action="save" style="padding:2px 6px;font-size:9px;height:18px;line-height:14px;margin:0 2px;">Save</button><button class="btn btn-sm btn-secondary" data-action="cancel" style="padding:2px 6px;font-size:9px;height:18px;line-height:14px;margin:0;">Cancel</button>`;

    // Replace elements
    ruleTextSpan.replaceWith(input);
    actionsDiv.replaceWith(editActions);

    input.focus();
    input.select();

    // Handle save/cancel
    editActions.addEventListener('click', async (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;

        if (btn.dataset.action === 'save') {
            const newRule = input.value.trim();
            if (!newRule) {
                window.app.showToast('Rule cannot be empty', 'error');
                return;
            }
            if (newRule !== originalRule) {
                await saveRuleEdit(ruleItem, serverId, allRules, ruleIndex, newRule);
            } else {
                cancelEdit(ruleItem, originalRule);
            }
        } else {
            cancelEdit(ruleItem, originalRule);
        }
    });

    // Handle Enter/Escape
    input.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const newRule = input.value.trim();
            if (newRule && newRule !== originalRule) {
                await saveRuleEdit(ruleItem, serverId, allRules, ruleIndex, newRule);
            } else {
                cancelEdit(ruleItem, originalRule);
            }
        } else if (e.key === 'Escape') {
            cancelEdit(ruleItem, originalRule);
        }
    });
}

/**
 * Cancel edit mode and restore original view
 */
function cancelEdit(ruleItem, originalRule) {
    const input = ruleItem.querySelector('.rule-edit-input');
    const editActions = ruleItem.querySelector('.rule-edit-actions');

    const ruleTextSpan = document.createElement('span');
    ruleTextSpan.className = 'rule-text';
    ruleTextSpan.textContent = originalRule;

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'rule-actions';
    actionsDiv.innerHTML = `
    <button class="rule-action-btn" data-action="edit" title="Edit rule">✏️</button>
    <button class="rule-action-btn" data-action="delete" title="Delete rule">⛔</button>
  `;

    input.replaceWith(ruleTextSpan);
    editActions.replaceWith(actionsDiv);
    ruleItem.classList.remove('editing');
}

/**
 * Save edited rule to server(s)
 */
async function saveRuleEdit(ruleItem, serverId, allRules, ruleIndex, newRule) {
    try {
        window.app.showToast('Updating rule...', 'info');

        // Update rules array
        const updatedRules = [...allRules];
        updatedRules[ruleIndex] = newRule;

        // Check for group membership
        const groups = await window.app.sendMessage('getGroups');
        const serverGroup = groups.find(g => g.serverIds && g.serverIds.includes(serverId));
        const targetServerIds = serverGroup ? serverGroup.serverIds : [serverId];
        const groupName = serverGroup ? serverGroup.name : null;

        // Update servers
        let successCount = 0;
        for (const targetId of targetServerIds) {
            try {
                await window.app.sendMessage('setRules', {
                    serverId: targetId,
                    rules: updatedRules
                });
                successCount++;
            } catch (error) {
                console.error(`Failed to update server ${targetId}:`, error);
            }
        }

        if (successCount > 0) {
            // Update local state
            allRules[ruleIndex] = newRule;

            // Update DOM directly
            const ruleTextSpan = document.createElement('span');
            ruleTextSpan.className = 'rule-text';
            ruleTextSpan.textContent = newRule;

            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'rule-actions';
            actionsDiv.innerHTML = `
        <button class="rule-action-btn" data-action="edit" title="Edit rule">✏️</button>
        <button class="rule-action-btn" data-action="delete" title="Delete rule">⛔</button>
      `;

            const input = ruleItem.querySelector('.rule-edit-input');
            const editActions = ruleItem.querySelector('.rule-edit-actions');
            input.replaceWith(ruleTextSpan);
            editActions.replaceWith(actionsDiv);
            ruleItem.classList.remove('editing');

            // Update rule color
            const type = classifyRule(newRule);
            ruleItem.className = `rule-item ${type === 'allow' ? 'rule-allow' : type === 'disabled' ? 'rule-disabled' : 'rule-block'}`;
            ruleItem.setAttribute('data-rule-index', ruleIndex);
            ruleItem.style.position = 'relative';

            const message = groupName
                ? `Rule updated in group "${groupName}" (${successCount}/${targetServerIds.length} servers)`
                : 'Rule updated successfully';

            window.app.showToast(message, successCount === targetServerIds.length ? 'success' : 'warning');

            // Refresh cache in background
            window.app.sendMessage('refreshServerRules', { serverId, force: true });
        } else {
            throw new Error('Failed to update any servers');
        }
    } catch (error) {
        window.app.showToast('Failed to save rule: ' + error.message, 'error');
        cancelEdit(ruleItem, allRules[ruleIndex]);
    }
}

/**
 * Handle clicking the delete button on a rule
 */
export function handleDeleteRule(ruleItem, serverId, allRules, ruleIndex) {
    // Show inline confirmation
    const existingConfirm = ruleItem.querySelector('.inline-confirm');
    if (existingConfirm) {
        existingConfirm.remove();
        return;
    }

    // Create inline confirmation as span
    const confirmDiv = document.createElement('span');
    confirmDiv.className = 'inline-confirm';
    confirmDiv.style.cssText = 'display:inline;margin-left:8px;white-space:nowrap;background:rgba(28,31,38,0.95);padding:2px 6px;border-radius:3px;';
    confirmDiv.innerHTML = `<span style="font-size:9px;color:#8c8c8c;margin-right:4px;">Delete?</span><button class="btn btn-sm btn-secondary" data-action="cancel" style="padding:2px 6px;font-size:9px;height:16px;line-height:12px;margin-right:2px;">Cancel</button><button class="btn btn-sm btn-danger" data-action="confirm" style="padding:2px 6px;font-size:9px;height:16px;line-height:12px;">Delete</button>`;

    ruleItem.appendChild(confirmDiv);

    // Handle confirmation
    confirmDiv.addEventListener('click', async (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;

        if (btn.dataset.action === 'confirm') {
            await performDeleteRule(ruleItem, serverId, allRules, ruleIndex);
        }
        confirmDiv.remove();
    });

    // Close on outside click
    setTimeout(() => {
        const closeHandler = (e) => {
            if (!confirmDiv.contains(e.target)) {
                confirmDiv.remove();
                document.removeEventListener('click', closeHandler);
            }
        };
        document.addEventListener('click', closeHandler);
    }, 100);
}

/**
 * Perform the actual rule deletion
 */
async function performDeleteRule(ruleItem, serverId, allRules, ruleIndex) {
    try {
        window.app.showToast('Deleting rule...', 'info');

        // Remove rule from array
        const updatedRules = allRules.filter((_, index) => index !== ruleIndex);

        // Check for group membership
        const groups = await window.app.sendMessage('getGroups');
        const serverGroup = groups.find(g => g.serverIds && g.serverIds.includes(serverId));
        const targetServerIds = serverGroup ? serverGroup.serverIds : [serverId];
        const groupName = serverGroup ? serverGroup.name : null;

        // Update servers
        let successCount = 0;
        for (const targetId of targetServerIds) {
            try {
                await window.app.sendMessage('setRules', {
                    serverId: targetId,
                    rules: updatedRules
                });
                successCount++;
            } catch (error) {
                console.error(`Failed to update server ${targetId}:`, error);
            }
        }

        if (successCount > 0) {
            // Remove from local array
            allRules.splice(ruleIndex, 1);

            // Remove from DOM with animation
            ruleItem.style.opacity = '0';
            ruleItem.style.transform = 'translateX(-10px)';
            ruleItem.style.transition = 'all 0.2s';

            setTimeout(() => {
                ruleItem.remove();

                // Update counts
                const counts = getRuleCounts(allRules);
                document.querySelector('.badge-success').textContent = `${counts.allow} Allow`;
                document.querySelector('.badge-danger').textContent = `${counts.block} Block`;
                document.querySelector('.badge-warning').textContent = `${counts.disabled} Disabled`;
                document.querySelector('.badge-info').textContent = `${counts.total} Total`;
            }, 200);

            const message = groupName
                ? `Rule deleted from group "${groupName}" (${successCount}/${targetServerIds.length} servers)`
                : 'Rule deleted successfully';

            window.app.showToast(message, successCount === targetServerIds.length ? 'success' : 'warning');

            // Refresh cache in background
            window.app.sendMessage('refreshServerRules', { serverId, force: true });
        } else {
            throw new Error('Failed to update any servers');
        }
    } catch (error) {
        window.app.showToast('Failed to delete rule: ' + error.message, 'error');
    }
}
