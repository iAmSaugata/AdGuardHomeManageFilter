// Storage Layer - chrome.storage.local wrapper with schema
// Provides type-safe access to extension storage

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
  return servers.find(s => s.id === id) || null;
}

export async function saveServer(server) {
  const servers = await getServers();
  const now = new Date().toISOString();

  const existingIndex = servers.findIndex(s => s.id === server.id);

  if (existingIndex >= 0) {
    // Update existing
    servers[existingIndex] = {
      ...server,
      updatedAt: now
    };
  } else {
    // Add new
    servers.push({
      ...server,
      createdAt: now,
      updatedAt: now
    });
  }

  await chrome.storage.local.set({ [STORAGE_KEYS.SERVERS]: servers });
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
