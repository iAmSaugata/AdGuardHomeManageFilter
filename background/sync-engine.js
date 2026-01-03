// Sync Engine
// Handles fetching and caching of server rules with TTL management

import * as storage from './storage.js';
import * as apiClient from './api-client.js';
import { dedupRules, normalizeRule, Logger, getRuleCounts } from './helpers.js';

// ============================================================================
// SYNC PRIMITIVES
// ============================================================================

/**
 * Refresh rules for a single server
 * @param {string} serverId - Server ID
 * @param {Object} options - { force: boolean }
 * @returns {Object} { success, data, error, fromCache }
 */
export async function refreshServerRules(serverId, options = {}) {
    const { force = false } = options;

    try {

        const server = await storage.getServer(serverId);
        if (!server) {
            return {
                success: false,
                error: 'Server not found',
                fromCache: false
            };
        }

        Logger.debug(`[SyncEngine] Refreshing rules for server: ${server.name} (${serverId})`);

        const settings = await storage.getSettings();

        // Check cache freshness if not forcing
        if (!force && !settings.preferLatest) {
            const isFresh = await storage.isCacheFresh(serverId);
            if (isFresh) {
                const cached = await storage.getCache(serverId);
                return {
                    success: true,
                    data: cached,
                    fromCache: true
                };
            }
        }

        // Fetch from network
        try {
            const status = await apiClient.getFilteringStatus(server);
            const rules = status.user_rules || [];

            // Normalize and deduplicate
            const normalizedRules = rules.map(normalizeRule).filter(r => r);
            const dedupedRules = dedupRules(normalizedRules);

            // Update cache
            const cacheData = {
                rules: dedupedRules,
                count: dedupedRules.length,
                ttlMinutes: settings.cacheTTLMinutes
            };

            Logger.debug(`[SyncEngine] Rules fetched for ${server.name}: ${dedupedRules.length}`);

            await storage.setCache(serverId, cacheData);

            return {
                success: true,
                data: cacheData,
                fromCache: false
            };
        } catch (networkError) {
            // Network failed - try cache fallback
            const cached = await storage.getCache(serverId);
            if (cached) {
                Logger.warn(`Network fetch failed for server ${serverId}, using stale cache:`, networkError.message);
                return {
                    success: true,
                    data: cached,
                    fromCache: true,
                    warning: 'Using cached data due to network error: ' + networkError.message
                };
            }

            // No cache available
            throw networkError;
        }
    } catch (error) {
        Logger.error(`Failed to refresh server ${serverId}:`, error);
        return {
            success: false,
            error: error.message,
            fromCache: false
        };
    }
}

/**
 * Refresh rules for all servers
 * @param {Object} options - { force: boolean }
 * @returns {Object} { success, results: { serverId: result } }
 */
export async function refreshAllServers(options = {}) {
    const { force = false } = options;

    try {
        const servers = await storage.getServers();
        const settings = await storage.getSettings();

        // Skip if auto-sync is disabled and not forcing
        if (!force && !settings.autoSync) {
            return {
                success: false,
                error: 'Auto-sync is disabled'
            };
        }

        const results = {};

        // Refresh each server sequentially to avoid overwhelming the network
        for (const server of servers) {
            results[server.id] = await refreshServerRules(server.id, { force });
        }

        // NEW: Group Synchronization Logic
        // Checks consistency across grouped servers and auto-merges drifts
        try {
            const groups = await storage.getGroups();
            if (groups.length > 0) {
                Logger.debug(`[SyncEngine] Checking consistency for ${groups.length} groups`);
                await syncGroups(groups, servers, results);
            }
        } catch (groupError) {
            Logger.error('[SyncEngine] Group sync failed:', groupError);
        }

        // Check if any succeeded
        const anySuccess = Object.values(results).some(r => r.success);

        return {
            success: anySuccess,
            results
        };
    } catch (error) {
        Logger.error('Failed to refresh all servers:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Get rules for a server (prefer latest if configured)
 * This is the main method to use when displaying rules
 */
export async function getServerRules(serverId) {
    const startTime = performance.now();
    const server = await storage.getServer(serverId);
    const serverName = server ? server.name : serverId;
    Logger.debug(`[SyncEngine] getServerRules called for: ${serverName}`);

    const settings = await storage.getSettings();
    Logger.debug(`[SyncEngine] preferLatest: ${settings.preferLatest}`);

    if (settings.preferLatest) {
        // Try network first, fallback to cache
        Logger.info(`[SyncEngine] preferLatest=true, trying network first...`);
        const result = await refreshServerRules(serverId, { force: false });
        Logger.debug(`[SyncEngine] Completed in ${(performance.now() - startTime).toFixed(2)}ms, fromCache: ${result.fromCache}`);
        return result;
    } else {
        // Use cache if fresh, otherwise fetch
        const cacheCheckStart = performance.now();
        const isFresh = await storage.isCacheFresh(serverId);

        // Detailed freshness logging
        const cached = await storage.getCache(serverId);
        if (cached && cached.fetchedAt) {
            const ageMs = Date.now() - new Date(cached.fetchedAt).getTime();
            const ttlMs = settings.cacheTTLMinutes * 60 * 1000;
            Logger.debug(`[SyncEngine] Cache Check for ${serverName}: Age=${(ageMs / 1000).toFixed(1)}s, TTL=${(ttlMs / 1000).toFixed(1)}s, Fresh=${isFresh}, Rules=${cached.rules ? cached.rules.length : 0}`);
        } else {
            Logger.debug(`[SyncEngine] Cache Check for ${serverName}: No valid cache found`);
        }

        Logger.debug(`[SyncEngine] Cache freshness check took ${(performance.now() - cacheCheckStart).toFixed(2)}ms, isFresh: ${isFresh}`);

        if (isFresh) {
            Logger.debug(`[SyncEngine] ✅ Cache HIT, rules: ${cached?.rules?.length || 0}`);
            return {
                success: true,
                data: cached,
                fromCache: true
            };
        }
    }

    Logger.warn(`[SyncEngine] ⚠️ Cache MISS - Fetching from network...`);
    const result = await refreshServerRules(serverId, { force: true });
    Logger.debug(`[SyncEngine] Network fetch completed in ${(performance.now() - startTime).toFixed(2)}ms`);
    return result;
}

/**
 * Synchronize rules across grouped servers
 * Merges, deduplicates, and pushes unified rules to all servers in a group
 */
async function syncGroups(groups, allServers, fetchResults) {
    const settings = await storage.getSettings();

    for (const group of groups) {
        // Filter servers in this group
        const groupServerIds = new Set(group.serverIds || []);
        const groupServers = allServers.filter(s => groupServerIds.has(s.id));

        if (groupServers.length < 2) continue; // Nothing to sync

        // Collect fresh rules from all successfully fetched servers
        let allRules = [];
        let participatingServers = [];

        for (const server of groupServers) {
            const result = fetchResults[server.id];
            // Only include if we have valid rule data (fresh or cache)
            if (result && result.success && result.data && result.data.rules) {
                allRules.push(...result.data.rules);
                participatingServers.push({ server, currentRules: result.data.rules });
            }
        }

        if (participatingServers.length === 0) continue;

        // Deduplicate (Union)
        const normalized = allRules.map(normalizeRule).filter(r => r);
        const mergedRules = dedupRules(normalized);

        // Check for drift and update
        for (const participant of participatingServers) {
            const { server, currentRules } = participant;
            const currentNormalized = currentRules.map(normalizeRule);
            const currentDeduped = dedupRules(currentNormalized);

            // Simple drift check: Compare JSON stringified content (order-independent comparison)
            // [Fix] Use [...arr].sort() to avoid mutating the original arrays!
            const currentStr = JSON.stringify([...currentDeduped].sort());
            const mergedStr = JSON.stringify([...mergedRules].sort());

            if (currentStr !== mergedStr) {
                Logger.info(`[SyncEngine] Drift detected for ${server.name} in group "${group.name}". Auto-Repairing...`);
                try {
                    // Fetch decrypted server credentials first
                    const serverWithAuth = await storage.getServer(server.id);
                    await apiClient.setRules(serverWithAuth, mergedRules);

                    // Update cache immediately so UI reflects it
                    const cacheData = {
                        rules: mergedRules,
                        count: mergedRules.length,
                        ttlMinutes: settings.cacheTTLMinutes || 60
                    };
                    await storage.setCache(server.id, cacheData);

                    // Update result for caller (so UI gets fresh merged data)
                    fetchResults[server.id].data = cacheData;

                    Logger.info(`[SyncEngine] ✅ Auto-Repaired ${server.name} with ${mergedRules.length} rules`);

                    // Notify UI about repair
                    try {
                        await chrome.runtime.sendMessage({
                            action: 'repairNotification',
                            data: {
                                serverName: server.name,
                                ruleCount: mergedRules.length
                            }
                        });
                    } catch (ignore) {
                        // Popup might be closed, ignore
                    }

                } catch (e) {
                    Logger.error(`[SyncEngine] Failed to sync drift for ${server.name}:`, e);
                }
            }
        }
    }
}
