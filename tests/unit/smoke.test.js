import { describe, test, expect, beforeEach } from 'vitest';

/**
 * Smoke Test - Verifies test framework is working
 * This test ensures the testing infrastructure is properly configured
 */

describe('Test Framework Smoke Test', () => {
    test('basic assertion works', () => {
        expect(1 + 1).toBe(2);
    });

    test('async/await works', async () => {
        const result = await Promise.resolve('success');
        expect(result).toBe('success');
    });

    test('Chrome API mock is available', () => {
        expect(chrome).toBeDefined();
        expect(chrome.runtime).toBeDefined();
        expect(chrome.storage).toBeDefined();
    });

    test('Chrome runtime.id is mocked', () => {
        expect(chrome.runtime.id).toBe('test-extension-id-12345');
    });

    test('Chrome storage mock works', async () => {
        await chrome.storage.local.set({ testKey: 'testValue' });
        const result = await chrome.storage.local.get('testKey');
        expect(result.testKey).toBe('testValue');
    });

    test('Web Crypto API is available', () => {
        expect(crypto).toBeDefined();
        expect(crypto.subtle).toBeDefined();
    });

    test('TextEncoder is available', () => {
        expect(TextEncoder).toBeDefined();
        const encoder = new TextEncoder();
        const encoded = encoder.encode('test');
        expect(encoded).toBeTruthy();
        expect(encoded.length).toBeGreaterThan(0);
    });
});

describe('Chrome Storage Mock', () => {
    beforeEach(() => {
        // Reset storage before each test
        chrome.storage._reset();
    });

    test('can set and get single value', async () => {
        await chrome.storage.local.set({ key1: 'value1' });
        const result = await chrome.storage.local.get('key1');
        expect(result.key1).toBe('value1');
    });

    test('can set and get multiple values', async () => {
        await chrome.storage.local.set({
            key1: 'value1',
            key2: 'value2'
        });

        const result = await chrome.storage.local.get(['key1', 'key2']);
        expect(result.key1).toBe('value1');
        expect(result.key2).toBe('value2');
    });

    test('can remove values', async () => {
        await chrome.storage.local.set({ key1: 'value1', key2: 'value2' });
        await chrome.storage.local.remove('key1');

        const result = await chrome.storage.local.get(['key1', 'key2']);
        expect(result.key1).toBeUndefined();
        expect(result.key2).toBe('value2');
    });

    test('can clear all storage', async () => {
        await chrome.storage.local.set({ key1: 'value1', key2: 'value2' });
        await chrome.storage.local.clear();

        const result = await chrome.storage.local.get(null);
        expect(Object.keys(result)).toHaveLength(0);
    });
});
