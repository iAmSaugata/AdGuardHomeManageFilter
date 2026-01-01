// Crypto Module - Password Encryption/Decryption
// Uses Web Crypto API with AES-GCM for secure credential storage

// ============================================================================
// CONFIGURATION
// ============================================================================

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits for GCM
const PBKDF2_ITERATIONS = 100000;
const VERSION = 2; // Bumped for enhanced key derivation

// Cache for the encryption key (generated once per session)
let cachedKey = null;

// Storage key for device-specific secret
const DEVICE_SECRET_KEY = '_deviceSecret';

// ============================================================================
// KEY DERIVATION
// ============================================================================

/**
 * Get or create device-specific secret (32 random bytes)
 * Generated once on first install, then persisted in chrome.storage.local
 * @returns {Promise<Uint8Array>}
 */
async function getOrCreateDeviceSecret() {
    const result = await chrome.storage.local.get(DEVICE_SECRET_KEY);

    if (result[DEVICE_SECRET_KEY]) {
        // Device secret exists, return it
        return new Uint8Array(result[DEVICE_SECRET_KEY]);
    }

    // First install - generate random device-specific secret
    const deviceSecret = crypto.getRandomValues(new Uint8Array(32));
    await chrome.storage.local.set({
        [DEVICE_SECRET_KEY]: Array.from(deviceSecret)
    });

    console.log('[Crypto] Device-specific secret generated (32 bytes)');
    return deviceSecret;
}

/**
 * Generate encryption key from multiple entropy sources
 * Combines Chrome runtime ID + device-specific secret for stronger key material
 * Uses PBKDF2 for key derivation to ensure consistent key across sessions
 * @returns {Promise<CryptoKey>}
 */
async function getEncryptionKey() {
    // Return cached key if available
    if (cachedKey) {
        return cachedKey;
    }

    try {
        // Gather entropy from multiple sources
        const runtimeId = chrome.runtime.id;
        const deviceSecret = await getOrCreateDeviceSecret();

        // Combine multiple entropy sources for stronger key material
        const combinedMaterial = new Uint8Array([
            ...new TextEncoder().encode(runtimeId),
            ...deviceSecret
        ]);

        // Updated salt with version bump
        const salt = new TextEncoder().encode('adguard-home-manager-v2');

        // Import the combined material as key material
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            combinedMaterial,
            'PBKDF2',
            false,
            ['deriveBits', 'deriveKey']
        );

        // Derive AES-GCM key using PBKDF2
        const key = await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: PBKDF2_ITERATIONS,
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: ALGORITHM, length: KEY_LENGTH },
            false, // Not extractable for security
            ['encrypt', 'decrypt']
        );

        // Cache the key for this session
        cachedKey = key;
        return key;
    } catch (error) {
        console.error('Failed to generate encryption key:', error);
        throw new Error('Encryption key generation failed');
    }
}

// ============================================================================
// ENCRYPTION
// ============================================================================

/**
 * Encrypt plaintext using AES-GCM
 * @param {string} plaintext - Data to encrypt (password)
 * @returns {Promise<{ciphertext: string, iv: string, version: number}>}
 */
export async function encrypt(plaintext) {
    if (!plaintext || typeof plaintext !== 'string') {
        throw new Error('Plaintext must be a non-empty string');
    }

    try {
        const key = await getEncryptionKey();

        // Generate random IV (must be unique for each encryption)
        const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

        // Encode plaintext to bytes
        const encoded = new TextEncoder().encode(plaintext);

        // Encrypt using AES-GCM
        const ciphertext = await crypto.subtle.encrypt(
            { name: ALGORITHM, iv: iv },
            key,
            encoded
        );

        // Return encrypted data with IV
        return {
            ciphertext: arrayBufferToBase64(ciphertext),
            iv: arrayBufferToBase64(iv),
            version: VERSION
        };
    } catch (error) {
        console.error('Encryption failed:', error);
        throw new Error('Failed to encrypt data');
    }
}

// ============================================================================
// DECRYPTION
// ============================================================================

/**
 * Decrypt ciphertext using AES-GCM
 * @param {{ciphertext: string, iv: string, version?: number}} encrypted - Encrypted data object
 * @returns {Promise<string>} Decrypted plaintext
 */
export async function decrypt(encrypted) {
    if (!encrypted || typeof encrypted !== 'object') {
        throw new Error('Encrypted data must be an object');
    }

    if (!encrypted.ciphertext || !encrypted.iv) {
        throw new Error('Missing ciphertext or IV');
    }

    try {
        const key = await getEncryptionKey();

        // Convert base64 to ArrayBuffer
        const iv = base64ToArrayBuffer(encrypted.iv);
        const ciphertext = base64ToArrayBuffer(encrypted.ciphertext);

        // Decrypt using AES-GCM
        const decrypted = await crypto.subtle.decrypt(
            { name: ALGORITHM, iv: iv },
            key,
            ciphertext
        );

        // Convert bytes to string
        return new TextDecoder().decode(decrypted);
    } catch (error) {
        console.error('Decryption failed:', error);
        throw new Error('Failed to decrypt data. Data may be corrupted.');
    }
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Check if data is encrypted (vs plaintext)
 * @param {any} data - Data to check
 * @returns {boolean} True if data appears to be encrypted
 */
export function isEncrypted(data) {
    // Explicitly return false for null/undefined
    if (data === null || data === undefined) {
        return false;
    }

    return (
        data &&
        typeof data === 'object' &&
        typeof data.ciphertext === 'string' &&
        typeof data.iv === 'string' &&
        data.ciphertext.length > 0 &&
        data.iv.length > 0
    );
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Convert ArrayBuffer to Base64 string
 * @param {ArrayBuffer} buffer - Buffer to convert
 * @returns {string} Base64 encoded string
 */
function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/**
 * Convert Base64 string to ArrayBuffer
 * @param {string} base64 - Base64 encoded string
 * @returns {ArrayBuffer} Decoded buffer
 */
function base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

// ============================================================================
// MIGRATION UTILITIES
// ============================================================================

/**
 * Migrate plaintext password to encrypted format
 * @param {string} plaintext - Plaintext password
 * @returns {Promise<{ciphertext: string, iv: string, version: number}>}
 */
export async function migratePassword(plaintext) {
    if (isEncrypted(plaintext)) {
        // Already encrypted, return as-is
        return plaintext;
    }

    // Encrypt plaintext password
    return await encrypt(plaintext);
}

/**
 * Test encryption/decryption roundtrip
 * Used for debugging and validation
 * @param {string} testString - String to test
 * @returns {Promise<boolean>} True if roundtrip successful
 */
export async function testEncryption(testString = 'test-password-123') {
    try {
        const encrypted = await encrypt(testString);
        const decrypted = await decrypt(encrypted);
        return decrypted === testString;
    } catch (error) {
        console.error('Encryption test failed:', error);
        return false;
    }
}
