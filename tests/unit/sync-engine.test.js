// Unit Tests for Sync Engine Module
// Tests rule syncing, caching, and TTL management

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as syncEngine from '../../background/sync-engine.js';
import { refreshServerRules, refreshAllServers, getServerRules } from '../../background/sync-engine.js';

// Mock modules
vi.mock('../../background/storage.js', () => ({
    getServer: vi.fn(),
    getServers: vi.fn(),
    getSettings: vi.fn(),
    getCache: vi.fn(),
    setCache: vi.fn(),
    isCacheFresh: vi.fn()
}));

vi.mock('../../background/api-client.js', () => ({
    getFilteringStatus: vi.fn()
}));

vi.mock('../../background/helpers.js', () => ({
    dedupRules: vi.fn((rules) => [...new Set(rules)]),
    normalizeRule: vi.fn((rule) => rule.trim()),
    Logger: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn()
    }
}));

import { getServer, getServers, getSettings, getCache, setCache, isCacheFresh } from '../../background/storage.js';
import { getFilteringStatus } from '../../background/api-client.js';

describe('Sync Engine Module', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('refreshServerRules()', () => {
        it('should return error for non-existent server', async () => {
            getServer.mockResolvedValue(null);

            const result = await refreshServerRules('invalid-id');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Server not found');
            expect(result.fromCache).toBe(false);
        });

        it('should return cached data when cache is fresh', async () => {
            const mockServer = { id: 'server1', name: 'Test Server' };
            const mockSettings = { preferLatest: false, cacheTTLMinutes: 30 };
            const mockCache = { rules: ['||test.com^'], count: 1 };

            getServer.mockResolvedValue(mockServer);
            getSettings.mockResolvedValue(mockSettings);
            isCacheFresh.mockResolvedValue(true);
            getCache.mockResolvedValue(mockCache);

            const result = await refreshServerRules('server1');

            expect(result.success).toBe(true);
            expect(result.data).toEqual(mockCache);
            expect(result.fromCache).toBe(true);
        });

        it('should fetch from network when cache is stale', async () => {
            const mockServer = { id: 'server1', name: 'Test Server' };
            const mockSettings = { preferLatest: false, cacheTTLMinutes: 30 };
            const mockStatus = { user_rules: ['||ad.com^', '||tracker.com^'] };

            getServer.mockResolvedValue(mockServer);
            getSettings.mockResolvedValue(mockSettings);
            isCacheFresh.mockResolvedValue(false);
            getFilteringStatus.mockResolvedValue(mockStatus);
            setCache.mockResolvedValue(true);

            const result = await refreshServerRules('server1');

            expect(result.success).toBe(true);
            expect(result.fromCache).toBe(false);
            expect(getFilteringStatus).toHaveBeenCalledWith(mockServer);
        });

        it('should force refresh when force=true', async () => {
            const mockServer = { id: 'server1', name: 'Test Server' };
            const mockSettings = { preferLatest: false, cacheTTLMinutes: 30 };
            const mockStatus = { user_rules: ['||ad.com^'] };

            getServer.mockResolvedValue(mockServer);
            getSettings.mockResolvedValue(mockSettings);
            getFilteringStatus.mockResolvedValue(mockStatus);
            setCache.mockResolvedValue(true);

            const result = await refreshServerRules('server1', { force: true });

            expect(result.success).toBe(true);
            expect(result.fromCache).toBe(false);
            expect(isCacheFresh).not.toHaveBeenCalled(); // Should skip cache check
        });

        it('should fallback to stale cache on network error', async () => {
            const mockServer = { id: 'server1', name: 'Test Server' };
            const mockSettings = { preferLatest: false, cacheTTLMinutes: 30 };
            const mockCache = { rules: ['||cached.com^'], count: 1 };

            getServer.mockResolvedValue(mockServer);
            getSettings.mockResolvedValue(mockSettings);
            isCacheFresh.mockResolvedValue(false);
            getFilteringStatus.mockRejectedValue(new Error('Network error'));
            getCache.mockResolvedValue(mockCache);

            const result = await refreshServerRules('server1');

            expect(result.success).toBe(true);
            expect(result.data).toEqual(mockCache);
            expect(result.fromCache).toBe(true);
            expect(result.warning).toContain('network error');
        });

        it('should handle complete failure when no cache available', async () => {
            const mockServer = { id: 'server1', name: 'Test Server' };
            const mockSettings = { preferLatest: false, cacheTTLMinutes: 30 };

            getServer.mockResolvedValue(mockServer);
            getSettings.mockResolvedValue(mockSettings);
            isCacheFresh.mockResolvedValue(false);
            getFilteringStatus.mockRejectedValue(new Error('Network error'));
            getCache.mockResolvedValue(null);

            const result = await refreshServerRules('server1');

            expect(result.success).toBe(false);
            expect(result.error).toContain('Network error');
        });
    });

    describe('refreshAllServers()', () => {
        it('should refresh all servers successfully', async () => {
            const mockServers = [
                { id: 'server1', name: 'Server 1' },
                { id: 'server2', name: 'Server 2' }
            ];
            const mockSettings = { autoSync: true, cacheTTLMinutes: 30 };

            getServers.mockResolvedValue(mockServers);
            getSettings.mockResolvedValue(mockSettings);
            getServer.mockImplementation((id) =>
                mockServers.find(s => s.id === id)
            );
            getFilteringStatus.mockResolvedValue({ user_rules: [] });
            setCache.mockResolvedValue(true);

            const result = await refreshAllServers({ force: true });

            expect(result.success).toBe(true);
            expect(result.results).toHaveProperty('server1');
            expect(result.results).toHaveProperty('server2');
        });

        it('should skip refresh when autoSync is disabled', async () => {
            const mockSettings = { autoSync: false };

            getSettings.mockResolvedValue(mockSettings);

            const result = await refreshAllServers();

            expect(result.success).toBe(false);
            expect(result.error).toBe('Auto-sync is disabled');
        });

        it('should force refresh even when autoSync is disabled', async () => {
            const mockServers = [{ id: 'server1', name: 'Server 1' }];
            const mockSettings = { autoSync: false, cacheTTLMinutes: 30 };

            getServers.mockResolvedValue(mockServers);
            getSettings.mockResolvedValue(mockSettings);
            getServer.mockResolvedValue(mockServers[0]);
            getFilteringStatus.mockResolvedValue({ user_rules: [] });
            setCache.mockResolvedValue(true);

            const result = await refreshAllServers({ force: true });

            expect(result.success).toBe(true);
        });
    });

    describe('getServerRules()', () => {
        it('should prefer network when preferLatest is enabled', async () => {
            const mockSettings = { preferLatest: true, cacheTTLMinutes: 30 };
            const mockServer = { id: 'server1', name: 'Test Server' };
            const mockStatus = { user_rules: ['||latest.com^'] };

            getSettings.mockResolvedValue(mockSettings);
            getServer.mockResolvedValue(mockServer);
            getFilteringStatus.mockResolvedValue(mockStatus);
            setCache.mockResolvedValue(true);

            const result = await getServerRules('server1');

            expect(result.success).toBe(true);
            expect(getFilteringStatus).toHaveBeenCalled();
        });

        it('should use cache when available and fresh', async () => {
            const mockSettings = { preferLatest: false, cacheTTLMinutes: 30 };
            const mockCache = { rules: ['||cached.com^'], count: 1 };

            getSettings.mockResolvedValue(mockSettings);
            isCacheFresh.mockResolvedValue(true);
            getCache.mockResolvedValue(mockCache);

            const result = await getServerRules('server1');

            expect(result.success).toBe(true);
            expect(result.data).toEqual(mockCache);
            expect(result.fromCache).toBe(true);
        });
    });
});
