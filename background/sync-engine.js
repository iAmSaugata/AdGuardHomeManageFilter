// Sync Engine
// Handles fetching and caching of server rules with TTL management

import * as storage from './storage.js';
import * as apiClient from './api-client.js';
import { dedupRules, normalizeRule } from './helpers.js';

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
                console.warn(`Network fetch failed for server ${serverId}, using stale cache:`, networkError.message);
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
        console.error(`Failed to refresh server ${serverId}:`, error);
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

        // Check if any succeeded
        const anySuccess = Object.values(results).some(r => r.success);

        return {
            success: anySuccess,
            results
        };
    } catch (error) {
        console.error('Failed to refresh all servers:', error);
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
    const settings = await storage.getSettings();

    if (settings.preferLatest) {
        // Try network first, fallback to cache
        const result = await refreshServerRules(serverId, { force: false });
        return result;
    } else {
        // Use cache if fresh, otherwise fetch
        const isFresh = await storage.isCacheFresh(serverId);
        if (isFresh) {
            const cached = await storage.getCache(serverId);
            return {
                success: true,
                data: cached,
                fromCache: true
            };
        }

        return await refreshServerRules(serverId, { force: true });
    }
}
