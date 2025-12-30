// Group Form View
// Create/Edit groups with merged rule preview

import { escapeHtml, classifyRule, getRuleCounts, showConfirmDialog } from '../utils.js';

export async function renderGroupForm(container, data = {}) {
    const { mode = 'add', groupId } = data;
    const isEdit = mode === 'edit';

    // Fetch servers and all groups
    const [servers, allGroups] = await Promise.all([
        window.app.sendMessage('getServers'),
        window.app.sendMessage('getGroups')
    ]);

    let group = null;
    if (isEdit && groupId) {
        group = await window.app.sendMessage('getGroup', { id: groupId });
        if (!group) {
            window.app.showToast('Group not found', 'error');
            window.app.navigateTo('settings');
            return;
        }
    }

    // Filter available servers (exclude servers in other groups)
    const otherGroups = isEdit ? allGroups.filter(g => g.id !== groupId) : allGroups;
    const usedServerIds = new Set();
    otherGroups.forEach(g => {
        if (g.serverIds) {
            g.serverIds.forEach(id => usedServerIds.add(id));
        }
    });

    // Separate available and unavailable servers
    const availableServers = servers.filter(s => !usedServerIds.has(s.id));
    const unavailableServers = servers.filter(s => usedServerIds.has(s.id));

    // Get group info for unavailable servers
    const unavailableServerInfo = unavailableServers.map(server => {
        const serverGroup = otherGroups.find(g => g.serverIds && g.serverIds.includes(server.id));
        return {
            server,
            groupName: serverGroup ? serverGroup.name : 'Unknown Group'
        };
    });

    container.innerHTML = `
        <div class="view-container">
            <div class="view-header">
                <button class="btn btn-ghost btn-sm" id="back-btn">
                    ← Back
                </button>
                <h1 class="view-title">${isEdit ? 'Edit' : 'Create'} Group</h1>
                ${isEdit ? `
                    <button class="btn btn-ghost btn-sm" id="delete-group-btn" title="Delete Group">
                        🗑️
                    </button>
                ` : '<div style="width: 40px;"></div>'}
            </div>
            <div class="view-body">
                <div class="form-group">
                    <label class="form-label" for="group-name">Group Name</label>
                    <input
                        type="text"
                        id="group-name"
                        class="form-input"
                        placeholder="e.g., Home Servers"
                        value="${group ? escapeHtml(group.name) : ''}"
                        required
                    />
                </div>

                <div class="form-group">
                    <label class="form-label">Select Servers</label>
                    ${availableServers.length > 0 ? `
                        <div class="server-availability">
                            ℹ️ ${availableServers.length} of ${servers.length} servers available
                            ${unavailableServers.length > 0 ? `(${unavailableServers.length} already in groups)` : ''}
                        </div>
                    ` : `
                        <div class="server-availability" style="border-left-color: var(--color-warning);">
                            ⚠️ All servers are already in other groups
                        </div>
                    `}
                    <div class="server-checkboxes">
                        ${availableServers.map(server => `
                            <label class="toggle-label">
                                <input
                                    type="checkbox"
                                    class="server-checkbox"
                                    value="${server.id}"
                                    ${group && group.serverIds.includes(server.id) ? 'checked' : ''}
                                />
                                <span>${escapeHtml(server.name)}</span>
                            </label>
                        `).join('')}
                        ${unavailableServers.length > 0 ? `
                            <div style="margin-top: var(--space-3); padding-top: var(--space-3); border-top: 1px solid var(--color-border);">
                                <div class="text-xs text-tertiary" style="margin-bottom: var(--space-2);">
                                    Unavailable (already in groups):
                                </div>
                                ${unavailableServerInfo.map(({ server, groupName }) => `
                                    <label class="toggle-label server-unavailable">
                                        <input
                                            type="checkbox"
                                            class="server-checkbox"
                                            value="${server.id}"
                                            disabled
                                        />
                                        <span>${escapeHtml(server.name)} <span class="text-xs">(in "${escapeHtml(groupName)}")</span></span>
                                    </label>
                                `).join('')}
                            </div>
                        ` : ''}
                    </div>
                </div>

                <div id="warnings-container"></div>

                <div class="form-group">
                    <label class="form-label">Merged Rules Preview</label>
                    <div class="rule-counts-card" id="preview-counts">
                        <span class="badge badge-info">Select servers to preview</span>
                    </div>
                    <div class="rules-preview" id="rules-preview">
                        <div class="empty-state-text">Select servers to see merged rules</div>
                    </div>
                </div>

                <div>
                    <div class="flex gap-2">
                        <button class="btn btn-secondary flex-1" id="cancel-btn">Cancel</button>
                        <button class="btn btn-primary flex-1" id="save-btn">
                            ${isEdit ? 'Update' : 'Create'} Group
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Event listeners
    document.getElementById('back-btn').addEventListener('click', () => {
        window.app.navigateTo('settings');
    });

    document.getElementById('cancel-btn').addEventListener('click', () => {
        window.app.navigateTo('settings');
    });

    document.getElementById('save-btn').addEventListener('click', () => {
        handleSaveGroup(isEdit, groupId);
    });

    // Delete group button (only in edit mode)
    if (isEdit) {
        document.getElementById('delete-group-btn').addEventListener('click', async () => {
            await handleDeleteGroup(groupId);
        });
    }

    // Server checkbox change handler
    document.querySelectorAll('.server-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            updatePreview();
        });
    });

    // Initial preview if editing
    if (isEdit) {
        updatePreview();
    }
}

async function updatePreview() {
    const selectedServerIds = Array.from(document.querySelectorAll('.server-checkbox:checked'))
        .map(cb => cb.value);

    if (selectedServerIds.length === 0) {
        document.getElementById('preview-counts').innerHTML = `
            <span class="badge badge-info">Select servers to preview</span>
        `;
        document.getElementById('rules-preview').innerHTML = `
            <div class="preview-empty-badge">
                <span class="badge badge-secondary">Select servers to see merged rules</span>
            </div>
        `;
        document.getElementById('warnings-container').innerHTML = '';

        // Clear all server counts
        document.querySelectorAll('.server-checkbox').forEach(cb => {
            const label = cb.closest('.checkbox-label');
            if (!label) return; // Skip if label not found

            const existingCounts = label.querySelector('.server-counts');
            if (existingCounts) {
                existingCounts.remove();
            }
        });

        return;
    }

    try {
        // Fetch individual server counts and merge
        const serverCounts = {};
        const allRules = [];
        const warnings = [];

        for (const serverId of selectedServerIds) {
            const cache = await window.app.sendMessage('getCache', { serverId });

            if (!cache || !cache.rules) {
                const server = await window.app.sendMessage('getServer', { id: serverId });
                warnings.push(`${server.name} not synced yet — refresh first`);
                serverCounts[serverId] = null;
                continue;
            }

            const counts = getRuleCounts(cache.rules);
            serverCounts[serverId] = counts;
            allRules.push(...cache.rules);
        }

        // Update server labels with counts
        document.querySelectorAll('.server-checkbox').forEach(cb => {
            const label = cb.closest('.toggle-label');
            if (!label) return; // Skip if label not found (e.g., disabled servers)

            const existingCounts = label.querySelector('.server-counts');
            if (existingCounts) {
                existingCounts.remove();
            }

            if (cb.checked && serverCounts[cb.value]) {
                const counts = serverCounts[cb.value];
                const countsHtml = document.createElement('div');
                countsHtml.className = 'server-counts';
                countsHtml.innerHTML = `
                    <span class="count-item count-allow">${counts.allow}</span>
                    <span class="count-item count-block">${counts.block}</span>
                    <span class="count-item count-disabled">${counts.disabled}</span>
                `;
                label.appendChild(countsHtml);
            }
        });

        // Normalize and deduplicate for merged view
        const normalized = allRules.map(normalizeRule).filter(r => r);
        const deduped = dedupRules(normalized);
        const mergedCounts = getRuleCounts(deduped);

        // Display warnings
        if (warnings.length > 0) {
            document.getElementById('warnings-container').innerHTML = `
                <div class="warning-banner">
                    ⚠️ ${warnings.join('<br>⚠️ ')}
                </div>
            `;
        } else {
            document.getElementById('warnings-container').innerHTML = '';
        }

        // Display merged counts
        document.getElementById('preview-counts').innerHTML = `
            <span class="badge badge-success">${mergedCounts.allow} Allow</span>
            <span class="badge badge-danger">${mergedCounts.block} Block</span>
            <span class="badge badge-warning">${mergedCounts.disabled} Disabled</span>
            <span class="badge badge-info">${mergedCounts.total} Total</span>
        `;

        // Display rules
        if (deduped.length === 0) {
            document.getElementById('rules-preview').innerHTML = `
                <div class="preview-empty-badge">
                    <span class="badge badge-secondary">No rules found</span>
                </div>
            `;
        } else {
            const rulesHtml = deduped.map(rule => {
                const type = classifyRule(rule);
                const colorClass = type === 'allow' ? 'rule-allow' :
                    type === 'disabled' ? 'rule-disabled' : 'rule-block';

                return `
                    <div class="rule-item ${colorClass}">
                        <span class="rule-indicator"></span>
                        <span class="rule-text">${escapeHtml(rule)}</span>
                    </div>
                `;
            }).join('');

            document.getElementById('rules-preview').innerHTML = rulesHtml;
        }

    } catch (error) {
        console.error('Failed to update preview:', error);
        document.getElementById('warnings-container').innerHTML = `
            <div class="warning-banner">
                ⚠️ Failed to load preview: ${error.message}
            </div>
        `;
    }
}

async function mergeRulesFromServers(serverIds) {
    const allRules = [];
    const warnings = [];

    for (const serverId of serverIds) {
        const cache = await window.app.sendMessage('getCache', { serverId });

        if (!cache || !cache.rules) {
            const server = await window.app.sendMessage('getServer', { id: serverId });
            warnings.push(`${server.name} not synced yet — refresh first`);
            continue;
        }

        allRules.push(...cache.rules);
    }

    // Normalize and deduplicate
    const normalized = allRules.map(normalizeRule).filter(r => r);
    const deduped = dedupRules(normalized);

    return {
        rules: deduped,
        warnings,
        counts: getRuleCounts(deduped)
    };
}

async function handleSaveGroup(isEdit, groupId) {
    const name = document.getElementById('group-name').value.trim();
    const selectedServerIds = Array.from(document.querySelectorAll('.server-checkbox:checked'))
        .map(cb => cb.value);

    if (!name) {
        window.app.showToast('Please enter a group name', 'error');
        return;
    }

    if (selectedServerIds.length === 0) {
        window.app.showToast('Please select at least one server', 'error');
        return;
    }

    try {
        window.app.showLoading();

        // Merge rules
        const result = await mergeRulesFromServers(selectedServerIds);

        // Create group object
        const group = {
            id: isEdit ? groupId : generateId(),
            name,
            serverIds: selectedServerIds,
            rules: result.rules
        };

        // Save group
        await window.app.sendMessage('saveGroup', { group });

        // Apply merged rules to all servers SEQUENTIALLY (not parallel)
        // This prevents AdGuard Home from rejecting simultaneous POST requests
        let successCount = 0;
        let failCount = 0;

        for (const serverId of selectedServerIds) {
            try {
                await window.app.sendMessage('setRules', {
                    serverId,
                    rules: result.rules
                });
                successCount++;

                // Small delay between servers to prevent API overload
                if (successCount < selectedServerIds.length) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            } catch (error) {
                console.error(`Failed to apply rules to server ${serverId}:`, error);
                failCount++;
            }
        }

        window.app.hideLoading();

        // Show appropriate message
        if (failCount === 0) {
            window.app.showToast(
                `Group ${isEdit ? 'updated' : 'created'}: Rules applied to ${successCount}/${selectedServerIds.length} servers`,
                'success'
            );
        } else if (successCount > 0) {
            window.app.showToast(
                `Group saved: Rules applied to ${successCount}/${selectedServerIds.length} servers`,
                'warning'
            );
        } else {
            window.app.showToast(
                `Group saved but failed to apply rules to all servers (${successCount}/${selectedServerIds.length})`,
                'error'
            );
        }

        window.app.navigateTo('settings');

    } catch (error) {
        window.app.hideLoading();
        window.app.showToast('Failed to save group: ' + error.message, 'error');
    }
}

// Group-specific helper functions
function generateId() {
    return 'group_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function normalizeRule(rule) {
    if (typeof rule !== 'string') return '';
    return rule.trim();
}

function dedupRules(rules) {
    return [...new Set(rules)];
}

async function handleDeleteGroup(groupId) {
    const group = await window.app.sendMessage('getGroup', { id: groupId });

    if (!group) {
        window.app.showToast('Group not found', 'error');
        return;
    }

    const confirmed = await showConfirmDialog(
        'Delete Group',
        `Are you sure you want to delete "${group.name}"?`,
        'This will not affect the rules on your servers.'
    );

    if (!confirmed) {
        return;
    }

    try {
        await window.app.sendMessage('deleteGroup', { id: groupId });
        window.app.showToast('Group deleted successfully', 'success');
        window.app.navigateTo('settings');
    } catch (error) {
        window.app.showToast('Failed to delete group: ' + error.message, 'error');
    }
}

// Shared helper functions (classifyRule, getRuleCounts, escapeHtml) imported from utils.js

