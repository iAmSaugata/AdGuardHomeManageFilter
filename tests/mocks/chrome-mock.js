// Chrome Extension API Mock
// Provides mock implementations of chrome.* APIs for testing

import { storageMock } from './storage-mock.js';

export const chromeMock = {
    // chrome.runtime
    runtime: {
        id: 'test-extension-id-12345',

        getManifest() {
            return {
                manifest_version: 3,
                name: 'AdGuard Home Central Manager',
                version: '0.2.0'
            };
        },

        sendMessage(message, callback) {
            // Simulate async message passing
            setTimeout(() => {
                if (callback) {
                    callback({ success: true, data: null });
                }
            }, 0);
        },

        onMessage: {
            addListener(callback) {
                // Store listener for testing
                this._listeners = this._listeners || [];
                this._listeners.push(callback);
            },
            _listeners: []
        },

        onInstalled: {
            addListener(callback) {
                this._listeners = this._listeners || [];
                this._listeners.push(callback);
            },
            _listeners: []
        },

        lastError: null
    },

    // chrome.storage
    storage: storageMock,

    // chrome.permissions (for optional host permissions)
    permissions: {
        request(permissions, callback) {
            if (callback) {
                callback(true); // Auto-grant in tests
            }
            return Promise.resolve(true);
        },

        contains(permissions, callback) {
            if (callback) {
                callback(true);
            }
            return Promise.resolve(true);
        }
    }
};

// Helper to trigger onInstalled event in tests
export function triggerOnInstalled() {
    chromeMock.runtime.onInstalled._listeners.forEach(listener => {
        listener({ reason: 'install' });
    });
}

// Helper to simulate message passing in tests
export function simulateMessage(action, data, callback) {
    chromeMock.runtime.onMessage._listeners.forEach(listener => {
        listener(
            { action, data },
            { id: 'test-sender' },
            callback || (() => { })
        );
    });
}
