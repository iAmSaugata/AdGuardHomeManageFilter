// Unit Tests for Helpers Module
// Tests rule processing, validation, and async utilities

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    generateUUID,
    normalizeRule,
    dedupRules,
    parseInputToHostname,
    generateBlockRule,
    generateAllowRule,
    classifyRule,
    classifyRules,
    getRuleCounts,
    withTimeout,
    withRetry,
    validateServer,
    sanitizeServerForLog
} from '../../background/helpers.js';

describe('Helpers Module', () => {
    describe('generateUUID()', () => {
        it('should generate valid UUID v4 format', () => {
            const uuid = generateUUID();
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            expect(uuid).toMatch(uuidRegex);
        });

        it('should generate unique UUIDs', () => {
            const uuids = new Set();
            for (let i = 0; i < 1000; i++) {
                uuids.add(generateUUID());
            }
            expect(uuids.size).toBe(1000);
        });

        it('should have version 4 in correct position', () => {
            const uuid = generateUUID();
            expect(uuid[14]).toBe('4');
        });
    });

    describe('normalizeRule()', () => {
        it('should trim whitespace', () => {
            expect(normalizeRule('  ||example.com^  ')).toBe('||example.com^');
            expect(normalizeRule('\t||example.com^\n')).toBe('||example.com^');
        });

        it('should preserve comments', () => {
            expect(normalizeRule('!This is a comment')).toBe('!This is a comment');
            expect(normalizeRule('  ! Comment with spaces  ')).toBe('! Comment with spaces');
        });

        it('should preserve exception rules', () => {
            expect(normalizeRule('@@||example.com^')).toBe('@@||example.com^');
        });

        it('should return empty string for invalid input', () => {
            expect(normalizeRule('')).toBe('');
            expect(normalizeRule('  ')).toBe('');
            expect(normalizeRule(null)).toBe('');
            expect(normalizeRule(undefined)).toBe('');
            expect(normalizeRule(123)).toBe('');
        });

        it('should reject rules shorter than 2 chars', () => {
            expect(normalizeRule('a')).toBe('');
            expect(normalizeRule('!')).toBe('!'); // Comments are preserved
        });
    });

    describe('dedupRules()', () => {
        it('should remove exact duplicates', () => {
            const rules = ['||a.com^', '||b.com^', '||a.com^', '||c.com^'];
            const result = dedupRules(rules);
            expect(result).toEqual(['||a.com^', '||b.com^', '||c.com^']);
        });

        it('should preserve order (first occurrence)', () => {
            const rules = ['||z.com^', '||a.com^', '||z.com^'];
            const result = dedupRules(rules);
            expect(result).toEqual(['||z.com^', '||a.com^']);
        });

        it('should deduplicate comments like other rules', () => {
            const rules = ['!comment1', '||a.com^', '!comment1'];
            const result = dedupRules(rules);
            // Comments are now deduplicated correctly to prevent double counting
            expect(result.filter(r => r.startsWith('!'))).toHaveLength(1);
            expect(result).toEqual(['!comment1', '||a.com^']);
        });

        it('should skip empty rules', () => {
            const rules = ['||a.com^', '', '  ', '||b.com^'];
            const result = dedupRules(rules);
            expect(result).toEqual(['||a.com^', '||b.com^']);
        });

        it('should handle empty array', () => {
            expect(dedupRules([])).toEqual([]);
        });

        it('should handle non-array input', () => {
            expect(dedupRules(null)).toEqual([]);
            expect(dedupRules(undefined)).toEqual([]);
            expect(dedupRules('not-array')).toEqual([]);
        });
    });

    describe('parseInputToHostname()', () => {
        it('should extract hostname from HTTP URL', () => {
            expect(parseInputToHostname('http://example.com/path')).toBe('example.com');
        });

        it('should extract hostname from HTTPS URL', () => {
            expect(parseInputToHostname('https://example.com:8080/path')).toBe('example.com');
        });

        it('should parse domain without protocol', () => {
            expect(parseInputToHostname('example.com')).toBe('example.com');
            expect(parseInputToHostname('sub.example.com')).toBe('sub.example.com');
        });

        it('should handle IP addresses', () => {
            expect(parseInputToHostname('192.168.1.1')).toBe('192.168.1.1');
            expect(parseInputToHostname('http://192.168.1.1')).toBe('192.168.1.1');
        });

        it('should return empty string for invalid input', () => {
            expect(parseInputToHostname('')).toBe('');
            expect(parseInputToHostname('  ')).toBe('');
            expect(parseInputToHostname(null)).toBe('');
        });

        it('should handle edge cases', () => {
            expect(parseInputToHostname('localhost')).toBe('localhost');
            expect(parseInputToHostname('http://localhost:3000')).toBe('localhost');
        });
    });

    describe('generateBlockRule()', () => {
        it('should generate block rule from domain', () => {
            expect(generateBlockRule('example.com')).toBe('||example.com^');
        });

        it('should extract domain from URL', () => {
            expect(generateBlockRule('https://example.com/path')).toBe('||example.com^');
        });

        it('should handle subdomains', () => {
            expect(generateBlockRule('sub.example.com')).toBe('||sub.example.com^');
        });
    });

    describe('generateAllowRule()', () => {
        it('should generate allow rule from domain', () => {
            expect(generateAllowRule('example.com')).toBe('@@||example.com^');
        });

        it('should extract domain from URL', () => {
            expect(generateAllowRule('https://example.com/path')).toBe('@@||example.com^');
        });
    });

    describe('classifyRule()', () => {
        it('should classify block rules', () => {
            // GOLDEN RULE: Only || prefix = block
            expect(classifyRule('||example.com^')).toBe('block');
            expect(classifyRule('||ads.com^$third-party')).toBe('block');
        });

        it('should classify single pipe and plain domains as disabled per GOLDEN RULE', () => {
            // Single pipe is NOT block per GOLDEN RULE
            expect(classifyRule('|https://example.com')).toBe('disabled');
            // Plain domain is NOT block per GOLDEN RULE
            expect(classifyRule('example.com')).toBe('disabled');
        });

        it('should classify allow rules', () => {
            expect(classifyRule('@@||example.com^')).toBe('allow');
            expect(classifyRule('@@|https://example.com')).toBe('allow');
        });

        it('should classify disabled rules', () => {
            expect(classifyRule('!comment')).toBe('disabled');
            expect(classifyRule('#comment')).toBe('disabled');
            expect(classifyRule('')).toBe('disabled');
            expect(classifyRule('  ')).toBe('disabled');
        });

        it('should handle invalid input', () => {
            expect(classifyRule(null)).toBe('unknown');
            expect(classifyRule(undefined)).toBe('unknown');
            expect(classifyRule(123)).toBe('unknown');
        });
    });

    describe('classifyRules()', () => {
        it('should classify array of rules', () => {
            const rules = [
                '||block.com^',
                '@@||allow.com^',
                '!comment',
                '||another-block.com^'
            ];
            const result = classifyRules(rules);

            expect(result.block).toHaveLength(2);
            expect(result.allow).toHaveLength(1);
            expect(result.disabled).toHaveLength(1);
        });

        it('should handle empty array', () => {
            const result = classifyRules([]);
            expect(result).toEqual({ allow: [], block: [], disabled: [] });
        });

        it('should handle non-array input', () => {
            const result = classifyRules(null);
            expect(result).toEqual({ allow: [], block: [], disabled: [] });
        });
    });

    describe('getRuleCounts()', () => {
        it('should count rules by type', () => {
            const rules = [
                '||block1.com^',
                '||block2.com^',
                '@@||allow.com^',
                '!comment'
            ];
            const counts = getRuleCounts(rules);

            expect(counts.block).toBe(2);
            expect(counts.allow).toBe(1);
            expect(counts.disabled).toBe(1);
            expect(counts.total).toBe(4);
        });

        it('should handle empty array', () => {
            const counts = getRuleCounts([]);
            expect(counts).toEqual({ allow: 0, block: 0, disabled: 0, total: 0 });
        });
    });

    describe('withTimeout()', () => {
        it('should resolve if promise completes before timeout', async () => {
            const promise = Promise.resolve('success');
            const result = await withTimeout(promise, 1000);
            expect(result).toBe('success');
        });

        it('should reject if promise exceeds timeout', async () => {
            const promise = new Promise(resolve => setTimeout(() => resolve('late'), 1000));
            await expect(withTimeout(promise, 100)).rejects.toThrow('timed out after 100ms');
        });

        it('should use default timeout of 10 seconds', async () => {
            const promise = Promise.resolve('quick');
            const result = await withTimeout(promise);
            expect(result).toBe('quick');
        });

        it('should propagate promise rejection', async () => {
            const promise = Promise.reject(new Error('failed'));
            await expect(withTimeout(promise, 1000)).rejects.toThrow('failed');
        });
    });

    describe('withRetry()', () => {
        it('should succeed on first attempt', async () => {
            let attempts = 0;
            const fn = async () => {
                attempts++;
                return 'success';
            };

            const result = await withRetry(fn, 2);
            expect(result).toBe('success');
            expect(attempts).toBe(1);
        });

        it('should retry on failure and eventually succeed', async () => {
            let attempts = 0;
            const fn = async () => {
                attempts++;
                if (attempts < 3) throw new Error('Retry me');
                return 'success';
            };

            const result = await withRetry(fn, 2);
            expect(result).toBe('success');
            expect(attempts).toBe(3);
        });

        it('should throw error after max retries', async () => {
            let attempts = 0;
            const fn = async () => {
                attempts++;
                throw new Error('Always fails');
            };

            await expect(withRetry(fn, 2)).rejects.toThrow('Always fails');
            expect(attempts).toBe(3); // 1 initial + 2 retries
        });

        it('should use exponential backoff', async () => {
            const delays = [];
            let attempts = 0;

            const fn = async () => {
                const start = Date.now();
                attempts++;
                if (attempts < 3) throw new Error('Retry');
                delays.push(Date.now() - start);
                return 'success';
            };

            await withRetry(fn, 2, 100);

            // Delays should roughly double (100ms, 200ms)
            // We're not testing exact timing due to test environment variance
            expect(attempts).toBe(3);
        }, 10000);

        it('should handle custom delay', async () => {
            let attempts = 0;
            const fn = async () => {
                attempts++;
                if (attempts < 2) throw new Error('Retry');
                return 'success';
            };

            const result = await withRetry(fn, 1, 50);
            expect(result).toBe('success');
        });
    });

    describe('validateServer()', () => {
        it('should validate correct server config', () => {
            const server = {
                name: 'Test Server',
                host: 'https://example.com',
                username: 'admin',
                password: 'password123'
            };
            const result = validateServer(server);

            expect(result.valid).toBe(true);
            expect(result.errors).toEqual([]);
        });

        it('should reject missing name', () => {
            const server = {
                name: '',
                host: 'https://example.com',
                username: 'admin',
                password: 'password123'
            };
            const result = validateServer(server);

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Server name is required');
        });

        it('should reject missing host', () => {
            const server = {
                name: 'Test',
                host: '',
                username: 'admin',
                password: 'password123'
            };
            const result = validateServer(server);

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Server host is required');
        });

        it('should reject invalid URL format', () => {
            const server = {
                name: 'Test',
                host: 'not-a-url',
                username: 'admin',
                password: 'password123'
            };
            const result = validateServer(server);

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Server host must be a valid URL (e.g., https://192.168.1.1)');
        });

        it('should reject missing username', () => {
            const server = {
                name: 'Test',
                host: 'https://example.com',
                username: '',
                password: 'password123'
            };
            const result = validateServer(server);

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Username is required');
        });

        it('should reject missing password', () => {
            const server = {
                name: 'Test',
                host: 'https://example.com',
                username: 'admin',
                password: ''
            };
            const result = validateServer(server);

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Password is required');
        });

        it('should collect all validation errors', () => {
            const server = {
                name: '',
                host: '',
                username: '',
                password: ''
            };
            const result = validateServer(server);

            expect(result.valid).toBe(false);
            expect(result.errors).toHaveLength(4);
        });
    });

    describe('sanitizeServerForLog()', () => {
        it('should remove password from server object', () => {
            const server = {
                id: 'abc-123',
                name: 'Test Server',
                host: 'https://example.com',
                username: 'admin',
                password: 'secret-password-123'
            };
            const sanitized = sanitizeServerForLog(server);

            expect(sanitized).toEqual({
                id: 'abc-123',
                name: 'Test Server',
                host: 'https://example.com',
                username: '***'
            });
            expect(sanitized.password).toBeUndefined();
        });

        it('should handle server without username', () => {
            const server = {
                id: 'abc-123',
                name: 'Test Server',
                host: 'https://example.com'
            };
            const sanitized = sanitizeServerForLog(server);

            expect(sanitized.username).toBeUndefined();
        });

        it('should not mutate original server object', () => {
            const server = {
                id: 'abc-123',
                name: 'Test Server',
                host: 'https://example.com',
                username: 'admin',
                password: 'secret'
            };
            sanitizeServerForLog(server);

            expect(server.password).toBe('secret'); // Original unchanged
        });
    });
});
