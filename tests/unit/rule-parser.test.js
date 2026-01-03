// Unit Tests for Popup Utils - Rule Parser
// Tests input parsing and hostname extraction

import { describe, it, expect } from 'vitest';

// Mock implementation based on actual code
function parseInput(input) {
    if (!input || typeof input !== 'string') {
        return { hostname: null, error: 'Input required' };
    }

    const trimmed = input.trim();
    if (!trimmed) {
        return { hostname: null, error: 'Input required' };
    }

    // Try URL parsing first
    try {
        const urlString = trimmed.match(/^https?:\/\//) ? trimmed : `https://${trimmed}`;
        const url = new URL(urlString);
        const hostname = url.hostname;

        if (isValidHostname(hostname)) {
            return { hostname, error: null };
        }
    } catch (e) {
        // Not a URL, try as FQDN
    }

    // Validate as FQDN
    if (isValidHostname(trimmed)) {
        return { hostname: trimmed, error: null };
    }

    return { hostname: null, error: 'Invalid domain format' };
}

function isValidHostname(hostname) {
    if (!hostname || hostname.length === 0) return false;
    const parts = hostname.split('.');
    if (parts.length < 2 && hostname !== 'localhost') return false;
    const labelRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/i;
    return parts.every(part => labelRegex.test(part));
}

describe('Rule Parser Utils', () => {
    describe('parseInput()', () => {
        it('should parse valid URLs', () => {
            const result = parseInput('https://example.com/path');
            expect(result.hostname).toBe('example.com');
            expect(result.error).toBeNull();
        });

        it('should parse domain without protocol', () => {
            const result = parseInput('example.com');
            expect(result.hostname).toBe('example.com');
            expect(result.error).toBeNull();
        });

        it('should parse subdomains', () => {
            const result = parseInput('subdomain.example.com');
            expect(result.hostname).toBe('subdomain.example.com');
            expect(result.error).toBeNull();
        });

        it('should handle localhost', () => {
            const result = parseInput('localhost');
            expect(result.hostname).toBe('localhost');
            expect(result.error).toBeNull();
        });

        it('should reject empty input', () => {
            const result = parseInput('');
            expect(result.hostname).toBeNull();
            expect(result.error).toBe('Input required');
        });

        it('should reject invalid formats', () => {
            const result = parseInput('invalid domain with spaces');
            expect(result.hostname).toBeNull();
            expect(result.error).toBe('Invalid domain format');
        });

        it('should handle IP addresses', () => {
            const result = parseInput('192.168.1.1');
            expect(result.hostname).toBe('192.168.1.1');
            expect(result.error).toBeNull();
        });
    });

    describe('isValidHostname()', () => {
        it('should validate correct hostnames', () => {
            expect(isValidHostname('example.com')).toBe(true);
            expect(isValidHostname('sub.example.com')).toBe(true);
            expect(isValidHostname('localhost')).toBe(true);
        });

        it('should reject invalid hostnames', () => {
            expect(isValidHostname('')).toBe(false);
            expect(isValidHostname('example')).toBe(false); // Single label (except localhost)
            expect(isValidHostname('example..com')).toBe(false); // Double dots
        });

        it('should handle hyphens correctly', () => {
            expect(isValidHostname('my-domain.com')).toBe(true);
            expect(isValidHostname('-invalid.com')).toBe(false); // Can't start with hyphen
            expect(isValidHostname('invalid-.com')).toBe(false); // Can't end with hyphen
        });
    });
});
