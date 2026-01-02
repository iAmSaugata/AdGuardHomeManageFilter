// Service Worker - Background Script
// Handles message passing, API coordination, and background tasks

import * as storage from './storage.js';
import * as apiClient from './api-client.js';
import * as syncEngine from './sync-engine.js';
import { generateUUID, validateServer, Logger, setLogLevel } from './helpers.js';

// ============================================================================
// SERVICE WORKER LIFECYCLE (Phase 2 Reliability)
// ============================================================================

// Track service worker uptime for monitoring
let serviceWorkerStartTime = Date.now();

// Log when extension starts up
chrome.runtime.onStartup.addListener(() => {
    console.log('[SW] Extension startup - service worker initialized');
    serviceWorkerStartTime = Date.now();
});

// Log when service worker is about to suspend
chrome.runtime.onSuspend.addListener(() => {
    const uptime = Date.now() - serviceWorkerStartTime;
    console.log(`[SW] Service worker suspended after ${uptime}ms (${(uptime / 1000).toFixed(1)}s)`);
});

// Optional: Keep-alive alarm to prevent premature termination
// Uncomment if background tasks need service worker to stay alive longer
// chrome.alarms.create('keepAlive', { periodInMinutes: 1 });
// chrome.alarms.onAlarm.addListener((alarm) => {
//     if (alarm.name === 'keepAlive') {
//         console.log('[SW] Keep-alive ping');
//     }
// });

// ============================================================================
// INITIALIZATION
// ============================================================================

chrome.runtime.onInstalled.addListener(async () => {
    Logger.info('AdGuard Home Manager installed');
    await storage.initializeStorage();

    // Initialize debug mode from storage
    await initializeDebugMode();

    // Create context menu
    chrome.contextMenus.create({
        id: 'add-to-adguard',
        title: 'Add to AdGuard Home',
        contexts: ['link', 'selection']  // Only show on links and selected text
    });
});

// Initialize debug mode on startup
async function initializeDebugMode() {
    try {
        const result = await chrome.storage.local.get('debugMode');
        const debugMode = result.debugMode || false;

        // Set log level based on debug mode
        // Debug enabled: LOG_LEVEL.DEBUG (3) - shows all logs
        // Debug disabled: LOG_LEVEL.ERROR (0) - shows only errors
        const logLevel = debugMode ? 3 : 0;
        setLogLevel(logLevel);

        Logger.info(`[Init] Debug mode: ${debugMode ? 'enabled' : 'disabled'}, log level: ${logLevel}`);
    } catch (error) {
        console.error('[Init] Failed to initialize debug mode:', error);
        // Default to ERROR level if initialization fails
        setLogLevel(0);
    }
}

// ============================================================================
// CONTEXT MENU HANDLER
// ============================================================================

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'add-to-adguard') {
        // Get URL from link, selected text, or page (in that priority order)
        const url = info.linkUrl || info.selectionText || info.pageUrl;

        if (url && tab && tab.id) {
            try {
                // Inject CSS first
                await chrome.scripting.insertCSS({
                    target: { tabId: tab.id },
                    files: ['context-menu/modal.css']
                });

                // Inject script in ISOLATED world (has chrome API access)
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['context-menu/content-script.js'],
                    world: 'ISOLATED'
                });

                // Send direct message to injected script
                setTimeout(async () => {
                    try {
                        await chrome.tabs.sendMessage(tab.id, {
                            type: 'ADGUARD_SHOW_MODAL',
                            url: url
                        });
                    } catch (e) {
                        Logger.error('[AdGuard] Failed to send message:', e);
                    }
                }, 200);
            } catch (error) {
                Logger.error('Failed to show modal:', error);
            }
        }
    }
});

// ============================================================================
// MESSAGE HANDLERS
// ============================================================================

const messageHandlers = {
    // Storage operations
    async getServers() {
        return await storage.getServers();
    },

    async getServer({ id }) {
        return await storage.getServer(id);
    },

    async saveServer({ server }) {
        // Generate ID if new server
        if (!server.id) {
            server.id = generateUUID();
        }

        // Validate
        const validation = validateServer(server);
        if (!validation.valid) {
            throw new Error(validation.errors.join(', '));
        }

        return await storage.saveServer(server);
    },

    async deleteServer({ id }) {
        return await storage.deleteServer(id);
    },

    async getGroups() {
        return await storage.getGroups();
    },

    async getGroup({ id }) {
        return await storage.getGroup(id);
    },

    async saveGroup({ group }) {
        if (!group.id) {
            group.id = generateUUID();
        }
        return await storage.saveGroup(group);
    },

    async deleteGroup({ id }) {
        return await storage.deleteGroup(id);
    },

    async getSettings() {
        return await storage.getSettings();
    },

    async updateSettings({ settings }) {
        return await storage.updateSettings(settings);
    },

    // API operations
    async testConnection({ host, username, password }) {
        return await apiClient.testConnection(host, username, password);
    },

    async getFilteringStatus({ serverId }) {
        const server = await storage.getServer(serverId);
        if (!server) {
            throw new Error('Server not found');
        }
        return await apiClient.getFilteringStatus(server);
    },

    async setRules({ serverId, rules }) {
        const server = await storage.getServer(serverId);
        if (!server) {
            throw new Error('Server not found');
        }
        return await apiClient.setRules(server, rules);
    },

    async getUserRules({ serverId }) {
        const server = await storage.getServer(serverId);
        if (!server) {
            throw new Error('Server not found');
        }
        return await apiClient.getUserRules(server);
    },

    async getServerInfo({ serverId }) {
        const server = await storage.getServer(serverId);
        if (!server) {
            throw new Error('Server not found');
        }
        return await apiClient.getServerInfo(server);
    },

    // Sync operations
    async refreshServerRules({ serverId, force = false }) {
        return await syncEngine.refreshServerRules(serverId, { force });
    },

    async refreshAllServers({ force = false }) {
        return await syncEngine.refreshAllServers({ force });
    },

    async getServerRules({ serverId }) {
        return await syncEngine.getServerRules(serverId);
    },

    // Cache operations
    async getCache({ serverId }) {
        return await storage.getCache(serverId);
    },

    async clearCache({ serverId }) {
        return await storage.clearCache(serverId);
    },

    // UI Snapshot operations (for instant popup rendering)
    async getUISnapshot() {
        return await storage.getUISnapshot();
    },

    async setUISnapshot({ servers, groups, serverData }) {
        return await storage.setUISnapshot({ servers, groups, serverData });
    },

    // New API operations (following OpenAPI spec)
    async addFilterURL({ serverId, url, name, whitelist }) {
        const server = await storage.getServer(serverId);
        if (!server) {
            throw new Error('Server not found');
        }
        return await apiClient.addFilterURL(server, url, name, whitelist);
    },

    async removeFilterURL({ serverId, url, whitelist }) {
        const server = await storage.getServer(serverId);
        if (!server) {
            throw new Error('Server not found');
        }
        return await apiClient.removeFilterURL(server, url, whitelist);
    },

    async setFilteringConfig({ serverId, config }) {
        const server = await storage.getServer(serverId);
        if (!server) {
            throw new Error('Server not found');
        }
        return await apiClient.setFilteringConfig(server, config);
    },

    // Debug mode control
    async setDebugMode({ enabled }) {
        try {
            // Update log level
            const logLevel = enabled ? 3 : 0; // DEBUG or ERROR
            setLogLevel(logLevel);

            Logger.info(`[Debug] Mode ${enabled ? 'enabled' : 'disabled'}, log level set to ${logLevel}`);

            return { success: true, logLevel };
        } catch (error) {
            Logger.error('[Debug] Failed to set debug mode:', error);
            throw error;
        }
    },

    // Protection toggle with group-aware logic
    async toggleProtection({ serverId, enabled }) {
        try {
            const server = await storage.getServer(serverId);
            if (!server) {
                throw new Error('Server not found');
            }

            // Find all groups containing this server
            const allGroups = await storage.getGroups();
            const serverGroups = allGroups.filter(group =>
                group.serverIds && group.serverIds.includes(serverId)
            );

            // Get unique server IDs from all groups
            const serverIdsSet = new Set([serverId]);
            for (const group of serverGroups) {
                for (const id of group.serverIds) {
                    serverIdsSet.add(id);
                }
            }

            const serverIds = Array.from(serverIdsSet);

            // Immediately cache the new status for all affected servers
            const protectionStatus = await chrome.storage.local.get('protectionStatus') || {};
            const currentStatus = protectionStatus.protectionStatus || {};
            for (const id of serverIds) {
                currentStatus[id] = enabled;
            }
            await chrome.storage.local.set({ protectionStatus: currentStatus });

            // Return immediately with all affected server IDs for instant UI update
            const affectedServers = serverIds.map(id => ({ id, enabled }));

            // Toggle protection for all linked servers in background (don't wait)
            (async () => {
                for (const id of serverIds) {
                    const srv = await storage.getServer(id);
                    if (srv) {
                        try {
                            await apiClient.setProtectionEnabled(srv, enabled);
                            Logger.info(`Protection ${enabled ? 'enabled' : 'disabled'} for ${srv.name}`);
                        } catch (error) {
                            Logger.error(`Failed to toggle protection for ${srv.name}:`, error);
                            // Revert cached status on error
                            currentStatus[id] = !enabled;
                            await chrome.storage.local.set({ protectionStatus: currentStatus });
                        }
                    }
                }
            })();

            Logger.info(`Protection ${enabled ? 'enabled' : 'disabled'} for ${affectedServers.length} server(s)`);

            return {
                success: true,
                affectedServers,
                totalServers: affectedServers.length
            };
        } catch (error) {
            Logger.error('Failed to toggle protection:', error);
            throw error;
        }
    },

    async getProtectionStatus({ serverId }) {
        try {
            // Check cache first
            const cached = await chrome.storage.local.get('protectionStatus');
            if (cached.protectionStatus && cached.protectionStatus[serverId] !== undefined) {
                return { success: true, enabled: cached.protectionStatus[serverId], fromCache: true };
            }

            // If not cached, fetch from API
            const server = await storage.getServer(serverId);
            if (!server) {
                throw new Error('Server not found');
            }

            const enabled = await apiClient.getProtectionStatus(server);

            // Cache the result
            const currentStatus = cached.protectionStatus || {};
            currentStatus[serverId] = enabled;
            await chrome.storage.local.set({ protectionStatus: currentStatus });

            return { success: true, enabled };
        } catch (error) {
            Logger.error('Failed to get protection status:', error);
            throw error;
        }
    },

    async refreshFilters({ serverId, force }) {
        const server = await storage.getServer(serverId);
        if (!server) {
            throw new Error('Server not found');
        }
        return await apiClient.refreshFilters(server, force);
    },

    async checkHost({ serverId, name }) {
        const server = await storage.getServer(serverId);
        if (!server) {
            throw new Error('Server not found');
        }
        return await apiClient.checkHost(server, name);
    }
};

// Note: Context menu logic now handled in content-script.js
// which imports parseInput, generateRule, and addRuleToTarget directly

// ============================================================================
// MESSAGE LISTENER
// ============================================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const { action, data } = message;

    // Find handler
    const handler = messageHandlers[action];

    if (!handler) {
        sendResponse({
            success: false,
            error: `Unknown action: ${action}`
        });
        return false;
    }

    // Execute handler asynchronously
    (async () => {
        try {
            const result = await handler(data || {});
            sendResponse({
                success: true,
                data: result
            });
        } catch (error) {
            Logger.error(`Error handling ${action}:`, error);
            sendResponse({
                success: false,
                error: error.message
            });
        }
    })();

    // Return true to indicate async response
    return true;
});

Logger.info('Service worker initialized');
