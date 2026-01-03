// Unit Tests for Crypto Module
// Tests AES-GCM encryption/decryption implementation

import { describe, it, expect, beforeEach } from 'vitest';
import { encrypt, decrypt, isEncrypted, migratePassword, testEncryption } from '../../background/crypto.js';

describe('Crypto Module', () => {
    describe('encrypt()', () => {
        it('should encrypt plaintext successfully', async () => {
            const plaintext = 'test-password-123';
            const encrypted = await encrypt(plaintext);

            expect(encrypted).toHaveProperty('ciphertext');
            expect(encrypted).toHaveProperty('iv');
            expect(encrypted).toHaveProperty('version');
            expect(typeof encrypted.ciphertext).toBe('string');
            expect(typeof encrypted.iv).toBe('string');
            expect(encrypted.version).toBe(2); // Version bumped for enhanced key derivation
        });

        it('should generate unique IVs for same plaintext', async () => {
            const plaintext = 'same-password';
            const encrypted1 = await encrypt(plaintext);
            const encrypted2 = await encrypt(plaintext);

            expect(encrypted1.iv).not.toBe(encrypted2.iv);
            expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
        });

        it('should throw error for non-string input', async () => {
            await expect(encrypt(null)).rejects.toThrow('Plaintext must be a non-empty string');
            await expect(encrypt(undefined)).rejects.toThrow('Plaintext must be a non-empty string');
            await expect(encrypt(123)).rejects.toThrow('Plaintext must be a non-empty string');
            await expect(encrypt('')).rejects.toThrow('Plaintext must be a non-empty string');
        });

        it('should handle special characters', async () => {
            const plaintext = 'p@ssw0rd!#$%^&*(){}[]<>?/|\\~`';
            const encrypted = await encrypt(plaintext);
            const decrypted = await decrypt(encrypted);

            expect(decrypted).toBe(plaintext);
        });

        it('should handle unicode characters', async () => {
            const plaintext = '密码🔐émojis™';
            const encrypted = await encrypt(plaintext);
            const decrypted = await decrypt(encrypted);

            expect(decrypted).toBe(plaintext);
        });
    });

    describe('decrypt()', () => {
        it('should decrypt ciphertext successfully', async () => {
            const plaintext = 'test-password-123';
            const encrypted = await encrypt(plaintext);
            const decrypted = await decrypt(encrypted);

            expect(decrypted).toBe(plaintext);
        });

        it('should handle long passwords', async () => {
            const plaintext = 'a'.repeat(1000); // 1000 character password
            const encrypted = await encrypt(plaintext);
            const decrypted = await decrypt(encrypted);

            expect(decrypted).toBe(plaintext);
        });

        it('should throw error for missing ciphertext', async () => {
            await expect(decrypt({ iv: 'abc' })).rejects.toThrow('Missing ciphertext or IV');
        });

        it('should throw error for missing IV', async () => {
            await expect(decrypt({ ciphertext: 'abc' })).rejects.toThrow('Missing ciphertext or IV');
        });

        it('should throw error for corrupted ciphertext', async () => {
            const encrypted = await encrypt('test');
            encrypted.ciphertext = 'corrupted-data';

            await expect(decrypt(encrypted)).rejects.toThrow('Failed to decrypt data');
        });

        it('should throw error for wrong IV', async () => {
            const encrypted1 = await encrypt('test1');
            const encrypted2 = await encrypt('test2');

            // Mix IVs
            encrypted1.iv = encrypted2.iv;

            await expect(decrypt(encrypted1)).rejects.toThrow('Failed to decrypt data');
        });

        it('should throw error for non-object input', async () => {
            await expect(decrypt('not-an-object')).rejects.toThrow('Encrypted data must be an object');
            await expect(decrypt(null)).rejects.toThrow('Encrypted data must be an object');
        });
    });

    describe('isEncrypted()', () => {
        it('should return true for encrypted data', async () => {
            const encrypted = await encrypt('test');
            expect(isEncrypted(encrypted)).toBe(true);
        });

        it('should return false for plaintext string', () => {
            expect(isEncrypted('plaintext')).toBe(false);
        });

        it('should return false for null', () => {
            expect(isEncrypted(null)).toBe(false);
        });

        it('should return false for undefined', () => {
            expect(isEncrypted(undefined)).toBe(false);
        });

        it('should return false for empty object', () => {
            expect(isEncrypted({})).toBe(false);
        });

        it('should return false for object with only ciphertext', () => {
            expect(isEncrypted({ ciphertext: 'abc' })).toBe(false);
        });

        it('should return false for object with only IV', () => {
            expect(isEncrypted({ iv: 'abc' })).toBe(false);
        });

        it('should return false for object with empty strings', () => {
            expect(isEncrypted({ ciphertext: '', iv: '' })).toBe(false);
        });

        it('should return true for valid encrypted object', () => {
            expect(isEncrypted({ ciphertext: 'abc', iv: 'def' })).toBe(true);
        });
    });

    describe('migratePassword()', () => {
        it('should encrypt plaintext password', async () => {
            const plaintext = 'password123';
            const migrated = await migratePassword(plaintext);

            expect(isEncrypted(migrated)).toBe(true);
            expect(migrated).toHaveProperty('ciphertext');
            expect(migrated).toHaveProperty('iv');
        });

        it('should return already encrypted password as-is', async () => {
            const encrypted = await encrypt('password123');
            const migrated = await migratePassword(encrypted);

            expect(migrated).toEqual(encrypted);
        });

        it('should decrypt migrated password correctly', async () => {
            const plaintext = 'password123';
            const migrated = await migratePassword(plaintext);
            const decrypted = await decrypt(migrated);

            expect(decrypted).toBe(plaintext);
        });
    });

    describe('testEncryption()', () => {
        it('should return true for successful roundtrip', async () => {
            const result = await testEncryption();
            expect(result).toBe(true);
        });

        it('should work with custom test string', async () => {
            const result = await testEncryption('my-custom-test-string');
            expect(result).toBe(true);
        });
    });

    describe('Encryption Roundtrip', () => {
        const testCases = [
            'simple',
            'complex-P@ssw0rd!',
            '12345678',
            'a'.repeat(100),
            '密码🔐',
            'spaces in password',
            'tabs\tand\nnewlines',
            '!@#$%^&*()_+-=[]{}|;:,.<>?'
        ];

        testCases.forEach(plaintext => {
            it(`should encrypt and decrypt: "${plaintext.substring(0, 30)}${plaintext.length > 30 ? '...' : ''}"`, async () => {
                const encrypted = await encrypt(plaintext);
                const decrypted = await decrypt(encrypted);
                expect(decrypted).toBe(plaintext);
            });
        });
    });

    describe('Security Properties', () => {
        it('should produce different ciphertext for same input (non-deterministic)', async () => {
            const plaintext = 'same-password';
            const results = await Promise.all([
                encrypt(plaintext),
                encrypt(plaintext),
                encrypt(plaintext)
            ]);

            const ciphertexts = results.map(r => r.ciphertext);
            const uniqueCiphertexts = new Set(ciphertexts);

            expect(uniqueCiphertexts.size).toBe(3); // All should be unique
        });

        it('should use proper IV length (12 bytes / 16 base64 chars)', async () => {
            const encrypted = await encrypt('test');
            // Base64 encoding of 12 bytes = 16 characters
            expect(encrypted.iv.length).toBe(16);
        });

        it('should include version number', async () => {
            const encrypted = await encrypt('test');
            expect(encrypted.version).toBeDefined();
            expect(typeof encrypted.version).toBe('number');
        });
    });

    describe('Error Recovery', () => {
        it('should handle encryption failure gracefully', async () => {
            // This tests the error handling path
            await expect(encrypt({ toString: () => { throw new Error('Bad'); } }))
                .rejects.toThrow();
        });
    });

    describe('Advanced Data Handling', () => {
        it('should handle decryption with both missing data fields', async () => {
            await expect(decrypt({})).rejects.toThrow('Missing ciphertext or IV');
            await expect(decrypt({ ciphertext: '' })).rejects.toThrow('Missing ciphertext or IV');
            await expect(decrypt({ iv: '' })).rejects.toThrow('Missing ciphertext or IV');
        });

        it('should handle decryption with invalid base64', async () => {
            const encrypted = await encrypt('test');
            encrypted.iv = 'not!!!valid!!!base64!!!';

            await expect(decrypt(encrypted)).rejects.toThrow();
        });

        it('should handle decryption with truncated ciphertext', async () => {
            const encrypted = await encrypt('test');
            // Truncate the ciphertext to invalid length
            encrypted.ciphertext = encrypted.ciphertext.substring(0, 4);

            await expect(decrypt(encrypted)).rejects.toThrow();
        });

        it('should handle very long passwords (10KB)', async () => {
            const longPassword = 'a'.repeat(10000);
            const encrypted = await encrypt(longPassword);
            const decrypted = await decrypt(encrypted);

            expect(decrypted).toBe(longPassword);
            expect(decrypted.length).toBe(10000);
        });

        it('should handle password migration edge cases', async () => {
            // Already encrypted
            const encrypted = await encrypt('password');
            const migrated1 = await migratePassword(encrypted);
            expect(migrated1).toEqual(encrypted);

            // Plaintext migration
            const migrated2 = await migratePassword('plaintext');
            expect(isEncrypted(migrated2)).toBe(true);

            const decrypted = await decrypt(migrated2);
            expect(decrypted).toBe('plaintext');
        });

        it('should handle isEncrypted with malformed objects', async () => {
            expect(isEncrypted({ ciphertext: 'valid', iv: '' })).toBe(false);
            expect(isEncrypted({ ciphertext: '', iv: 'valid' })).toBe(false);
            expect(isEncrypted({ ciphertext: null, iv: 'valid' })).toBe(false);
            expect(isEncrypted({ ciphertext: 'valid', iv: null })).toBe(false);
            expect(isEncrypted({ ciphertext: undefined, iv: 'valid' })).toBe(false);
        });
    });
});
