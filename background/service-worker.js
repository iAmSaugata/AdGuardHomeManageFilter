// Service Worker - Background Script
// Handles message passing, API coordination, and background tasks

import * as storage from './storage.js';
import * as apiClient from './api-client.js';
import * as syncEngine from './sync-engine.js';
import { generateUUID, validateServer } from './helpers.js';

// ============================================================================
// INITIALIZATION
// ============================================================================

chrome.runtime.onInstalled.addListener(async () => {
    console.log('AdGuard Home Manager installed');
    await storage.initializeStorage();
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
    }
};

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
            console.error(`Error handling ${action}:`, error);
            sendResponse({
                success: false,
                error: error.message
            });
        }
    })();

    // Return true to indicate async response
    return true;
});

console.log('Service worker initialized');
