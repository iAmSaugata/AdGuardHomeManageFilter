// Storage Layer - chrome.storage.local wrapper with schema
// Provides type-safe access to extension storage

import { encrypt, decrypt, isEncrypted, migratePassword } from './crypto.js';

const STORAGE_KEYS = {
  SERVERS: 'servers',
  GROUPS: 'groups',
  SETTINGS: 'settings',
  CACHE: 'cache'
};

const DEFAULT_SETTINGS = {
  autoSync: true,
  preferLatest: true,
  cacheTTLMinutes: 30,
  theme: 'dark'
};

// ============================================================================
// SERVERS
// ============================================================================

export async function getServers() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.SERVERS);
  return result[STORAGE_KEYS.SERVERS] || [];
}

export async function getServer(id) {
  const servers = await getServers();
  const server = servers.find(s => s.id === id) || null;

  if (!server) return null;

  // Handle password decryption and migration
  if (server.password) {
    if (isEncrypted(server.password)) {
      // Already encrypted, decrypt for use
      try {
        server.password = await decrypt(server.password);
      } catch (error) {
        console.error(`Failed to decrypt password for server ${id}:`, error);
        // Return server without password if decryption fails
        delete server.password;
      }
    } else {
      // Plaintext password - migrate to encrypted format
      console.log(`Migrating password for server ${id} to encrypted format`);
      try {
        const encrypted = await encrypt(server.password);
        const plainPassword = server.password; // Keep for return

        // Update storage with encrypted password
        const allServers = await getServers();
        const index = allServers.findIndex(s => s.id === id);
        if (index >= 0) {
          allServers[index].password = encrypted;
          await chrome.storage.local.set({ [STORAGE_KEYS.SERVERS]: allServers });
        }

        server.password = plainPassword; // Return decrypted password
      } catch (error) {
        console.error(`Failed to migrate password for server ${id}:`, error);
        // Keep plaintext password if migration fails
      }
    }
  }

  return server;
}

export async function saveServer(server) {
  const servers = await getServers();
  const now = new Date().toISOString();

  // Encrypt password before saving
  let serverToSave = { ...server };
  if (serverToSave.password && !isEncrypted(serverToSave.password)) {
    try {
      serverToSave.password = await encrypt(serverToSave.password);
    } catch (error) {
      console.error('Failed to encrypt password:', error);
      throw new Error('Failed to encrypt password. Server not saved.');
    }
  }

  const existingIndex = servers.findIndex(s => s.id === serverToSave.id);

  if (existingIndex >= 0) {
    // Update existing
    servers[existingIndex] = {
      ...serverToSave,
      updatedAt: now
    };
  } else {
    // Add new
    servers.push({
      ...serverToSave,
      createdAt: now,
      updatedAt: now
    });
  }

  await chrome.storage.local.set({ [STORAGE_KEYS.SERVERS]: servers });

  // Return server with plaintext password for immediate use
  return server;
}

export async function deleteServer(id) {
  const servers = await getServers();
  const filtered = servers.filter(s => s.id !== id);
  await chrome.storage.local.set({ [STORAGE_KEYS.SERVERS]: filtered });

  // Also clear cache for this server
  await clearCache(id);

  return true;
}

// ============================================================================
// GROUPS
// ============================================================================

export async function getGroups() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.GROUPS);
  return result[STORAGE_KEYS.GROUPS] || [];
}

export async function getGroup(id) {
  const groups = await getGroups();
  return groups.find(g => g.id === id) || null;
}

export async function saveGroup(group) {
  const groups = await getGroups();
  const now = new Date().toISOString();

  const existingIndex = groups.findIndex(g => g.id === group.id);

  if (existingIndex >= 0) {
    // Update existing
    groups[existingIndex] = {
      ...group,
      updatedAt: now
    };
  } else {
    // Add new
    groups.push({
      ...group,
      createdAt: now,
      updatedAt: now
    });
  }

  await chrome.storage.local.set({ [STORAGE_KEYS.GROUPS]: groups });
  return group;
}

export async function deleteGroup(id) {
  const groups = await getGroups();
  const filtered = groups.filter(g => g.id !== id);
  await chrome.storage.local.set({ [STORAGE_KEYS.GROUPS]: filtered });
  return true;
}

// ============================================================================
// SETTINGS
// ============================================================================

export async function getSettings() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
  return { ...DEFAULT_SETTINGS, ...result[STORAGE_KEYS.SETTINGS] };
}

export async function updateSettings(updates) {
  const current = await getSettings();
  const updated = { ...current, ...updates };
  await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: updated });
  return updated;
}

// ============================================================================
// CACHE
// ============================================================================

export async function getCache(serverId) {
  const result = await chrome.storage.local.get(STORAGE_KEYS.CACHE);
  const cache = result[STORAGE_KEYS.CACHE] || {};
  return cache[serverId] || null;
}

export async function setCache(serverId, data) {
  const result = await chrome.storage.local.get(STORAGE_KEYS.CACHE);
  const cache = result[STORAGE_KEYS.CACHE] || {};

  cache[serverId] = {
    ...data,
    fetchedAt: new Date().toISOString()
  };

  await chrome.storage.local.set({ [STORAGE_KEYS.CACHE]: cache });
  return cache[serverId];
}

export async function clearCache(serverId) {
  const result = await chrome.storage.local.get(STORAGE_KEYS.CACHE);
  let cache = result[STORAGE_KEYS.CACHE] || {};

  if (serverId) {
    delete cache[serverId];
  } else {
    // Clear all cache - more efficient than forEach delete
    cache = {};
  }

  await chrome.storage.local.set({ [STORAGE_KEYS.CACHE]: cache });
  return true;
}

export async function isCacheFresh(serverId) {
  const cached = await getCache(serverId);
  if (!cached || !cached.fetchedAt) return false;

  const settings = await getSettings();
  const ttlMs = settings.cacheTTLMinutes * 60 * 1000;
  const fetchedAt = new Date(cached.fetchedAt).getTime();
  const now = Date.now();

  return (now - fetchedAt) < ttlMs;
}

// ============================================================================
// UI SNAPSHOT CACHE (for instant popup rendering)
// ============================================================================

const UI_SNAPSHOT_KEY = 'ui_snapshot';
const CACHE_VERSION = 2; // Increment to invalidate all old caches

/**
 * Get cached UI snapshot for instant rendering
 * @returns {Promise<{servers: Array, groups: Array, timestamp: string} | null>}
 */
export async function getUISnapshot() {
  const result = await chrome.storage.local.get(UI_SNAPSHOT_KEY);
  const snapshot = result[UI_SNAPSHOT_KEY];

  if (!snapshot) return null;

  // Invalidate old cache versions
  if (snapshot.version !== CACHE_VERSION) {
    console.log(`[Cache] Invalidating old cache version ${snapshot.version || 1}, current is ${CACHE_VERSION}`);
    await chrome.storage.local.remove(UI_SNAPSHOT_KEY);
    return null;
  }

  // Cache never expires - background checks handle updates automatically
  return snapshot;
}

/**
 * Save UI snapshot for next popup open
 * @param {{servers: Array, groups: Array, serverData: Object}} data
 */
export async function setUISnapshot(data) {
  const snapshot = {
    ...data,
    version: CACHE_VERSION,
    timestamp: new Date().toISOString()
  };

  await chrome.storage.local.set({ [UI_SNAPSHOT_KEY]: snapshot });
}

// ============================================================================
// INITIALIZATION
// ============================================================================

export async function initializeStorage() {
  const result = await chrome.storage.local.get([
    STORAGE_KEYS.SERVERS,
    STORAGE_KEYS.GROUPS,
    STORAGE_KEYS.SETTINGS,
    STORAGE_KEYS.CACHE
  ]);

  const updates = {};

  if (!result[STORAGE_KEYS.SERVERS]) {
    updates[STORAGE_KEYS.SERVERS] = [];
  }

  if (!result[STORAGE_KEYS.GROUPS]) {
    updates[STORAGE_KEYS.GROUPS] = [];
  }

  if (!result[STORAGE_KEYS.SETTINGS]) {
    updates[STORAGE_KEYS.SETTINGS] = DEFAULT_SETTINGS;
  }

  if (!result[STORAGE_KEYS.CACHE]) {
    updates[STORAGE_KEYS.CACHE] = {};
  }

  if (Object.keys(updates).length > 0) {
    await chrome.storage.local.set(updates);
  }

  return true;
}
