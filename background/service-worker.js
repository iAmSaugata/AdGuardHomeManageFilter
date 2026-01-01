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

    // Set log level from settings
    const settings = await storage.getSettings();
    setLogLevel(settings.logLevel || 0);

    // Create context menu
    chrome.contextMenus.create({
        id: 'add-to-adguard',
        title: 'Add to AdGuard Home',
        contexts: ['link', 'page', 'selection']
    });
});

// ============================================================================
// CONTEXT MENU HANDLER
// ============================================================================

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'add-to-adguard') {
        // Get URL from link or page
        const url = info.linkUrl || info.pageUrl || info.selectionText;

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
