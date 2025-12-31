/**
 * Add Rule Service
 * Uses existing API patterns with domain duplicate prevention
 */

import { checkDomainExists, getRuleType } from '../utils/rule-domain-validator.js';

/**
 * Show custom styled confirmation dialog for replace operation
 * Falls back to native confirm() in content script context
 */
async function showReplaceConfirmDialog(domain, existingRule, newRule, serverCount) {
    // Check if we're in a popup context or content script context
    const appContainer = document.getElementById('app');

    // If no app container exists, we're likely in a content script - use native confirm
    if (!appContainer) {
        const existingType = getRuleType(existingRule);
        const newType = getRuleType(newRule);

        const message = `Domain "${domain}" already exists on ${serverCount} server(s):\n\n` +
            `Existing: ${existingRule}\n` +
            `(Type: ${existingType.toUpperCase()})\n\n` +
            `New: ${newRule}\n` +
            `(Type: ${newType.toUpperCase()})\n\n` +
            `Replace existing rule on all ${serverCount} server(s)?`;

        console.log('[DEBUG] About to call native confirm()');
        console.log('[DEBUG] Message:', message);
        console.log('[DEBUG] typeof confirm:', typeof confirm);

        try {
            const result = confirm(message);
            console.log('[DEBUG] confirm() returned:', result);
            return result;
        } catch (error) {
            console.error('[DEBUG] confirm() threw error:', error);
            return false;
        }
    }

    // Full styled dialog for popup context
    return new Promise((resolve) => {
        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'confirm-overlay';

        // Create dialog
        const dialog = document.createElement('div');
        dialog.className = 'confirm-dialog';

        const existingType = getRuleType(existingRule);
        const newType = getRuleType(newRule);

        dialog.innerHTML = `
            <div class="confirm-header">
                <h3 class="confirm-title">Domain Conflict Detected</h3>
            </div>
            <div class="confirm-body">
                <p class="confirm-message">Domain "${escapeHtml(domain)}" already exists on ${serverCount} server(s):</p>
                <div style="margin: 12px 0; padding: 12px; background: var(--color-bg-tertiary); border-radius: var(--radius-md);">
                    <div style="margin-bottom: 8px;">
                        <strong>Existing:</strong> <span class="badge badge-${existingType === 'allow' ? 'success' : 'danger'}" style="margin-left: 8px;">${existingType.toUpperCase()}</span>
                        <div style="margin-top: 4px; font-family: monospace; color: var(--color-text-secondary);">${escapeHtml(existingRule)}</div>
                    </div>
                    <div>
                        <strong>New:</strong> <span class="badge badge-${newType === 'allow' ? 'success' : 'danger'}" style="margin-left: 8px;">${newType.toUpperCase()}</span>
                        <div style="margin-top: 4px; font-family: monospace; color: var(--color-text-secondary);">${escapeHtml(newRule)}</div>
                    </div>
                </div>
                <p class="confirm-subtitle">Replace existing rule on all ${serverCount} server(s)?</p>
            </div>
            <div class="confirm-actions">
                <button class="btn btn-secondary btn-block" id="confirm-cancel">Cancel</button>
                <button class="btn btn-primary btn-block" id="confirm-replace">Replace All</button>
            </div>
        `;

        overlay.appendChild(dialog);
        appContainer.appendChild(overlay);

        // Event listeners
        const cancelBtn = overlay.querySelector('#confirm-cancel');
        const replaceBtn = overlay.querySelector('#confirm-replace');

        cancelBtn.addEventListener('click', () => {
            overlay.remove();
            resolve(false);
        });

        replaceBtn.addEventListener('click', () => {
            overlay.remove();
            resolve(true);
        });

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
                resolve(false);
            }
        });
    });
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

export async function addRuleToTarget(targetValue, rule) {
    if (!targetValue || !rule) {
        throw new Error('Target and rule required');
    }

    const [type, id] = targetValue.split(':');
    let serverIds = [];

    if (type === 'group') {
        serverIds = await getServerIdsForGroup(id);
    } else if (type === 'server') {
        const groupId = await getGroupForServer(id);
        if (groupId) {
            serverIds = await getServerIdsForGroup(groupId);
        } else {
            serverIds = [id];
        }
    } else {
        throw new Error('Invalid target');
    }

    const results = {
        success: 0,
        duplicate: 0,
        replaced: 0,
        failed: 0,
        total: serverIds.length,
        domainConflicts: [],
        affectedServers: []
    };

    // First pass: detect all conflicts across all servers
    const conflictMap = new Map(); // domain -> { domain, existingRule, newRule, servers: [{ serverId, currentRules }] }

    for (const serverId of serverIds) {
        try {
            const currentRules = await window.app.sendMessage('getUserRules', { serverId });

            // Check for exact duplicate
            if (currentRules.includes(rule)) {
                results.duplicate++;
                continue;
            }

            // Check for domain duplicate
            const domainCheck = checkDomainExists(rule, currentRules);

            if (domainCheck.exists) {
                if (!conflictMap.has(domainCheck.domain)) {
                    conflictMap.set(domainCheck.domain, {
                        domain: domainCheck.domain,
                        existingRule: domainCheck.conflictingRule,
                        newRule: rule,
                        servers: []
                    });
                }
                conflictMap.get(domainCheck.domain).servers.push({
                    serverId,
                    currentRules
                });
            }
        } catch (error) {
            console.error(`Failed to check rules for server ${serverId}:`, error);
        }
    }

    // If there are conflicts, show ONE confirmation for all
    let userDecision = null; // null = not asked, true = replace, false = cancel

    if (conflictMap.size > 0) {
        console.log('[DEBUG] Domain conflicts detected:', conflictMap.size, 'conflicts');

        // Show single confirmation dialog
        // For simplicity, we'll assume one type of conflict (same domain, same new rule)
        // and take the first conflict found to construct the message.
        const conflict = Array.from(conflictMap.values())[0];
        const serverCount = conflict.servers.length;

        console.log('[DEBUG] Conflict details:', {
            domain: conflict.domain,
            existingRule: conflict.existingRule,
            newRule: conflict.newRule,
            serverCount
        });

        const message = `Domain "${conflict.domain}" already exists on ${serverCount} server(s):\n\n` +
            `Existing: ${conflict.existingRule}\n` +
            `(Type: ${getRuleType(conflict.existingRule)})\n\n` +
            `New: ${conflict.newRule}\n` +
            `(Type: ${getRuleType(conflict.newRule)})\n\n` +
            `Replace on all ${serverCount} server(s)?`;

        console.log('[DEBUG] About to show confirmation dialog');
        console.log('[DEBUG] appContainer exists:', !!document.getElementById('app'));

        userDecision = await showReplaceConfirmDialog(conflict.domain, conflict.existingRule, conflict.newRule, serverCount);

        console.log('[DEBUG] User decision:', userDecision);
    } else {
        console.log('[DEBUG] No domain conflicts detected');
    }

    // Second pass: apply rules based on conflicts and user decision
    for (const serverId of serverIds) {
        try {
            const currentRules = await window.app.sendMessage('getUserRules', { serverId });

            // Check for exact duplicate (skip if already counted)
            if (currentRules.includes(rule)) {
                continue; // Already counted in first pass
            }

            // Check for domain duplicate
            const domainCheck = checkDomainExists(rule, currentRules);

            if (domainCheck.exists) {
                // User already decided for all servers
                if (userDecision === false) {
                    results.failed++;
                    continue;
                }

                // Replace the rule
                const updatedRules = currentRules.map(r =>
                    r === domainCheck.conflictingRule ? rule : r
                );
                await window.app.sendMessage('setRules', { serverId, rules: updatedRules });
                results.replaced++;
                results.success++;
                results.affectedServers.push(serverId);
            } else {
                // No conflict, add normally
                const updatedRules = [...currentRules, rule];
                await window.app.sendMessage('setRules', { serverId, rules: updatedRules });
                results.success++;
                results.affectedServers.push(serverId);
            }
        } catch (error) {
            console.error(`Failed to add rule to server ${serverId}:`, error);
            results.failed++;
        }
    }

    // Refresh server list for all affected servers to update rule counts
    if (results.affectedServers.length > 0) {
        console.log(`Refreshing ${results.affectedServers.length} server(s) to update rule counts...`);

        // Refresh server data in parallel
        await Promise.allSettled(
            results.affectedServers.map(serverId =>
                window.app.sendMessage('refreshServerRules', { serverId, force: true })
                    .catch(err => console.warn(`Failed to refresh server ${serverId}:`, err))
            )
        );

        console.log('Server refresh complete');

        // Refresh UI if currently on server list view
        if (window.app.refreshCurrentView) {
            console.log('Refreshing server list UI...');
            window.app.refreshCurrentView();
        }
    }

    return results;
}

/**
 * Show confirmation dialog for replacing existing rule
 * @deprecated - Now using inline confirmation in addRuleToTarget
 */
async function confirmReplaceRule(domain, existingRule, newRule) {
    const existingType = getRuleType(existingRule);
    const newType = getRuleType(newRule);

    const message = `Domain "${domain}" already has a rule:\n\n` +
        `Existing: ${existingRule}\n` +
        `(Type: ${existingType})\n\n` +
        `New: ${newRule}\n` +
        `(Type: ${newType})\n\n` +
        `Replace the existing rule?`;

    return confirm(message);
}

async function getServerIdsForGroup(groupId) {
    const groups = await window.app.sendMessage('getGroups');
    const group = groups.find(g => g.id === groupId);

    if (!group) {
        throw new Error('Group not found');
    }

    return group.serverIds || [];
}

async function getGroupForServer(serverId) {
    const groups = await window.app.sendMessage('getGroups');

    for (const group of groups) {
        if (group.serverIds && group.serverIds.includes(serverId)) {
            return group.id;
        }
    }

    return null;
}

