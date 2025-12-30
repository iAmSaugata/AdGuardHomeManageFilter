/**
 * Add Rule Service
 * Uses existing API patterns with domain duplicate prevention
 */

import { checkDomainExists, getRuleType } from '../utils/rule-domain-validator.js';

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
                results.domainConflicts.push({
                    serverId,
                    domain: domainCheck.domain,
                    existingRule: domainCheck.conflictingRule,
                    newRule: rule
                });

                // Ask user if they want to replace
                const shouldReplace = await confirmReplaceRule(
                    domainCheck.domain,
                    domainCheck.conflictingRule,
                    rule
                );

                if (!shouldReplace) {
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
