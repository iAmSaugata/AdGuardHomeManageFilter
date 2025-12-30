// Crypto Module - Password Encryption/Decryption
// Uses Web Crypto API with AES-GCM for secure credential storage

// ============================================================================
// CONFIGURATION
// ============================================================================

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits for GCM
const PBKDF2_ITERATIONS = 100000;
const VERSION = 1;

// Cache for the encryption key (generated once per session)
let cachedKey = null;

// ============================================================================
// KEY DERIVATION
// ============================================================================

/**
 * Generate a deterministic encryption key from Chrome runtime ID
 * Uses PBKDF2 for key derivation to ensure consistent key across sessions
 * @returns {Promise<CryptoKey>}
 */
async function getEncryptionKey() {
    // Return cached key if available
    if (cachedKey) {
        return cachedKey;
    }

    try {
        // Use Chrome runtime ID as base material (unique per extension install)
        const runtimeId = chrome.runtime.id;
        const salt = new TextEncoder().encode('adguard-home-manager-v1');

        // Import the runtime ID as key material
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(runtimeId),
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
