/**
 * Add Rule Service
 * Uses existing API patterns - no new logic
 */

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
        failed: 0,
        total: serverIds.length
    };

    for (const serverId of serverIds) {
        try {
            const currentRules = await window.app.sendMessage('getUserRules', { serverId });

            if (currentRules.includes(rule)) {
                results.duplicate++;
                continue;
            }

            const updatedRules = [...currentRules, rule];
            await window.app.sendMessage('setRules', { serverId, rules: updatedRules });
            results.success++;
        } catch (error) {
            console.error(`Failed to add rule to server ${serverId}:`, error);
            results.failed++;
        }
    }

    return results;
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
