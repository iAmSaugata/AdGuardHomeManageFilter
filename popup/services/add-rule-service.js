/**
 * Add Rule Service
 * Handles adding rules to servers with group-aware logic
 * Uses existing getUserRules/setRules API patterns
 */

/**
 * Add rule to target (group or server)
 * @param {string} targetValue - Format: "group:id" or "server:id"
 * @param {string} rule - AdGuard rule syntax
 * @returns {Promise<Object>} Summary { success, duplicate, failed, total }
 */
export async function addRuleToTarget(targetValue, rule) {
    if (!targetValue || !rule) {
        throw new Error('Target and rule are required');
    }

    const [type, id] = targetValue.split(':');
    let serverIds = [];

    if (type === 'group') {
        // Get all servers in the group
        serverIds = await getServerIdsForGroup(id);
    } else if (type === 'server') {
        // Check if server is in a group
        const groupId = await getGroupForServer(id);
        if (groupId) {
            // Server is in a group - add to all servers in that group
            serverIds = await getServerIdsForGroup(groupId);
        } else {
            // Server not in a group - add only to this server
            serverIds = [id];
        }
    } else {
        throw new Error('Invalid target type');
    }

    // Add rule to each server
    const results = {
        success: 0,
        duplicate: 0,
        failed: 0,
        total: serverIds.length
    };

    for (const serverId of serverIds) {
        try {
            // Get current rules using existing API pattern
            const currentRules = await window.app.sendMessage('getUserRules', { serverId });

            // Check if rule already exists
            if (currentRules.includes(rule)) {
                results.duplicate++;
                continue;
            }

            // Add new rule
            const updatedRules = [...currentRules, rule];

            // Set rules using existing API pattern
            await window.app.sendMessage('setRules', { serverId, rules: updatedRules });
            results.success++;
        } catch (error) {
            console.error(`Failed to add rule to server ${serverId}:`, error);
            results.failed++;
        }
    }

    return results;
}

/**
 * Get all server IDs for a group
 * @param {string} groupId - Group ID
 * @returns {Promise<string[]>} Array of server IDs
 */
async function getServerIdsForGroup(groupId) {
    const groups = await window.app.sendMessage('getGroups');
    const group = groups.find(g => g.id === groupId);

    if (!group) {
        throw new Error('Group not found');
    }

    return group.serverIds || [];
}

/**
 * Get group ID for a server (if server is in a group)
 * @param {string} serverId - Server ID
 * @returns {Promise<string|null>} Group ID or null if not in a group
 */
async function getGroupForServer(serverId) {
    const groups = await window.app.sendMessage('getGroups');

    for (const group of groups) {
        if (group.serverIds && group.serverIds.includes(serverId)) {
            return group.id;
        }
    }

    return null;
}
