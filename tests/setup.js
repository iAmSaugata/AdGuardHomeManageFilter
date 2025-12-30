// Test environment setup
// Configures mocks for Chrome Extension APIs

import { chromeMock } from './mocks/chrome-mock.js';
import { webcrypto } from 'node:crypto';

// Mock Chrome APIs globally
global.chrome = chromeMock;

// Mock TextEncoder/TextDecoder (JSDOM compatibility)
if (typeof global.TextEncoder === 'undefined') {
    global.TextEncoder = TextEncoder;
    global.TextDecoder = TextDecoder;
}

// Mock Web Crypto API
if (typeof global.crypto === 'undefined' || !global.crypto.subtle) {
    global.crypto = webcrypto;
}

// Console logging for test visibility
console.log('Test environment initialized with Chrome API mocks');
