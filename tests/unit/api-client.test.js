// Unit Tests for API Client Module
// Tests API request handling, error enrichment, and retry logic

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    testConnection,
    getFilteringStatus,
    setRules,
    getUserRules
} from '../../background/api-client.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('API Client Module', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('testConnection()', () => {
        it.skip('should return success for valid credentials - integration test', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ enabled: true, user_rules: [] }),
                headers: {
                    get: () => 'application/json'
                }
            });

            const result = await testConnection('https://test.com', 'admin', 'password');

            expect(result.success).toBe(true);
            expect(result.error).toBeUndefined();
        });

        it('should return error for 401 Unauthorized', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: false,
                status: 401,
                statusText: 'Unauthorized',
                text: async () => 'Unauthorized',
                headers: {
                    get: () => null
                }
            });

            const result = await testConnection('https://test.com', 'admin', 'wrong');

            expect(result.success).toBe(false);
            expect(result.error).toContain('401');
        });

        it('should handle network errors', async () => {
            global.fetch.mockRejectedValueOnce(new Error('Network error'));

            const result = await testConnection('https://test.com', 'admin', 'password');

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('should include Basic Auth header', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({}),
                headers: {
                    get: () => null
                }
            });

            await testConnection('https://test.com', 'admin', 'password');

            const callArgs = global.fetch.mock.calls[0];
            const headers = callArgs[1].headers;

            expect(headers.Authorization).toBeDefined();
            expect(headers.Authorization).toMatch(/^Basic /);
        });

        it('should normalize host (remove trailing slash)', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({}),
                headers: {
                    get: () => null
                }
            });

            await testConnection('https://test.com/', 'admin', 'password');

            const callArgs = global.fetch.mock.calls[0];
            const url = callArgs[0];

            // Should not have double slash
            expect(url).not.toContain('//control');
            expect(url).toContain('/control/filtering/status');
        });
    });

    describe('getFilteringStatus()', () => {
        const mockServer = {
            id: 'srv-1',
            host: 'https://test.com',
            username: 'admin',
            password: 'password'
        };

        it.skip('should fetch filtering status successfully - integration test', async () => {
            const mockStatus = {
                enabled: true,
                user_rules: ['||example.com^', '@@||allowed.com^']
            };

            global.fetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => mockStatus,
                headers: {
                    get: () => 'application/json'
                }
            });

            const result = await getFilteringStatus(mockServer);

            expect(result.enabled).toBe(true);
            expect(result.user_rules).toHaveLength(2);
        });

        it('should throw error on failure', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
                text: async () => 'Server error',
                headers: {
                    get: () => null
                }
            });

            await expect(getFilteringStatus(mockServer)).rejects.toThrow();
        });
    });

    describe('setRules()', () => {
        const mockServer = {
            id: 'srv-1',
            host: 'https://test.com',
            username: 'admin',
            password: 'password'
        };

        it('should set rules successfully', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                headers: {
                    get: () => null
                }
            });

            const rules = ['||block.com^', '@@||allow.com^'];
            await setRules(mockServer, rules);

            const callArgs = global.fetch.mock.calls[0];
            const body = callArgs[1].body;

            expect(body).toContain('||block.com^');
            expect(body).toContain('@@||allow.com^');
        });

        it('should use POST method', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                headers: {
                    get: () => null
                }
            });

            await setRules(mockServer, []);

            const callArgs = global.fetch.mock.calls[0];
            expect(callArgs[1].method).toBe('POST');
        });

        it('should set correct Content-Type', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                headers: {
                    get: () => null
                }
            });

            await setRules(mockServer, []);

            const callArgs = global.fetch.mock.calls[0];
            const headers = callArgs[1].headers;

            // setRules uses application/json for Content-Type
            expect(headers['Content-Type']).toBe('application/json');
        });
    });

    describe.skip('getUserRules() - integration with interceptors', () => {
        const mockServer = {
            id: 'srv-1',
            host: 'https://test.com',
            username: 'admin',
            password: 'password'
        };

        it('should extract user rules from filtering status', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    enabled: true,
                    user_rules: ['||example.com^']
                }),
                headers: {
                    get: () => 'application/json'
                }
            });

            const rules = await getUserRules(mockServer);

            expect(rules).toHaveLength(1);
            expect(rules[0]).toBe('||example.com^');
        });
    });

    describe('Error Handling', () => {
        const mockServer = {
            id: 'srv-1',
            host: 'https://test.com',
            username: 'admin',
            password: 'password'
        };

        it('should handle timeout errors', async () => {
            global.fetch.mockImplementationOnce(() =>
                new Promise((resolve, reject) =>
                    setTimeout(() => reject(new Error('timeout')), 100)
                )
            );

            await expect(getFilteringStatus(mockServer)).rejects.toThrow();
        });

        it('should handle 404 errors', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: false,
                status: 404,
                statusText: 'Not Found',
                text: async () => 'Not found',
                headers: {
                    get: () => null
                }
            });

            await expect(getFilteringStatus(mockServer)).rejects.toThrow();
        });

        it('should handle malformed JSON response', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => { throw new Error('Invalid JSON'); },
                headers: {
                    get: () => 'application/json'
                }
            });

            await expect(getFilteringStatus(mockServer)).rejects.toThrow();
        });
    });

    describe.skip('Host Normalization - integration with interceptors', () => {
        it('should remove trailing slash from host', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({}),
                headers: {
                    get: () => 'application/json'
                }
            });

            const server = {
                host: 'https://test.com/',
                username: 'admin',
                password: 'pass'
            };

            await getFilteringStatus(server);

            const url = global.fetch.mock.calls[0][0];
            expect(url).toBe('https://test.com/control/filtering/status');
        });

        it('should not modify host without trailing slash', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({}),
                headers: {
                    get: () => 'application/json'
                }
            });

            const server = {
                host: 'https://test.com',
                username: 'admin',
                password: 'pass'
            };

            await getFilteringStatus(server);

            const url = global.fetch.mock.calls[0][0];
            expect(url).toBe('https://test.com/control/filtering/status');
        });
    });
});
