const crypto = require('crypto');
const logger = require('./logger');

// We use the SUPABASE_SERVICE_ROLE_KEY as a master secret to derive an encryption key.
// This allows us to have secure storage without requiring new environment variables in production.
const MASTER_SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const SALT = 'merigaumata-otp-metadata-salt'; // Fixed salt for derivation

let encryptionKey = null;

/**
 * Derive a secure encryption key from the master secret
 */
function getEncryptionKey() {
    if (encryptionKey) return encryptionKey;

    if (!MASTER_SECRET) {
        logger.error('[Encryption] SUPABASE_SERVICE_ROLE_KEY is missing. Encryption will fail.');
        throw new Error('Encryption key not configured');
    }

    try {
        // Scrypt is a strong KDF. We use it to derive a fixed-length key from the master secret.
        // Sync is fine here as it's typically called once on first use and cached.
        encryptionKey = crypto.scryptSync(MASTER_SECRET, SALT, KEY_LENGTH);
        return encryptionKey;
    } catch (error) {
        logger.error({ err: error }, '[Encryption] Failed to derive encryption key');
        throw error;
    }
}

/**
 * Encrypt any serializable data
 * @param {any} data - Data to encrypt
 * @returns {string} - Combined string of iv:authTag:encryptedData
 */
function encrypt(data) {
    try {
        const key = getEncryptionKey();
        const iv = crypto.randomBytes(12); // GCM standard IV length
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

        const plaintext = typeof data === 'string' ? data : JSON.stringify(data);
        let encrypted = cipher.update(plaintext, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        const authTag = cipher.getAuthTag().toString('hex');

        // We combine IV, Auth Tag, and Encrypted Data into a single colon-separated string
        return `${iv.toString('hex')}:${authTag}:${encrypted}`;
    } catch (error) {
        logger.error({ err: error }, '[Encryption] Encryption failed');
        throw new Error('Encryption operation failed');
    }
}

/**
 * Decrypt data encrypted with the above function
 * @param {string} encryptedString - Combined string iv:authTag:encryptedData
 * @param {boolean} [asJson=true] - Whether to parse the result as JSON
 * @returns {any} - Decrypted data
 */
function decrypt(encryptedString, asJson = true) {
    if (!encryptedString) return null;

    try {
        const parts = encryptedString.split(':');
        if (parts.length !== 3) {
            throw new Error('Invalid encrypted data format');
        }

        const [ivHex, authTagHex, encryptedHex] = parts;
        const key = getEncryptionKey();
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');

        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return asJson ? JSON.parse(decrypted) : decrypted;
    } catch (error) {
        logger.error({ err: error }, '[Encryption] Decryption failed');
        throw new Error('Decryption operation failed');
    }
}

module.exports = {
    encrypt,
    decrypt
};
