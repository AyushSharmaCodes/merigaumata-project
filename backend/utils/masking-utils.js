/**
 * Masking Utilities
 * Functions for masking sensitive data in logs and displays
 */

/**
 * Mask GSTIN for display/logging
 * Input: 29ABCDE1234F1Z5
 * Output: 29ABCDE****1Z5
 * @param {string} gstin - Full GSTIN
 * @returns {string} Masked GSTIN
 */
function maskGSTIN(gstin) {
    if (!gstin || typeof gstin !== 'string') return gstin;
    if (gstin.length < 15) return gstin;

    // Show first 7 and last 3, mask middle 4
    return gstin.slice(0, 7) + '****' + gstin.slice(11);
}

/**
 * Mask email address for display/logging
 * Input: ayush@example.com
 * Output: a***h@example.com
 * @param {string} email - Full email address
 * @returns {string} Masked email
 */
function maskEmail(email) {
    if (!email || typeof email !== 'string') return email;

    const atIndex = email.indexOf('@');
    if (atIndex <= 0) return email;

    const local = email.slice(0, atIndex);
    const domain = email.slice(atIndex);

    if (local.length <= 2) {
        return local[0] + '***' + domain;
    }

    return local[0] + '***' + local.slice(-1) + domain;
}

/**
 * Mask phone number for display/logging
 * Input: 9876543210
 * Output: 98****3210
 * @param {string} phone - Full phone number
 * @returns {string} Masked phone
 */
function maskPhone(phone) {
    if (!phone || typeof phone !== 'string') return phone;

    // Remove non-digits for processing
    const digits = phone.replace(/\D/g, '');

    if (digits.length < 6) return phone;

    // Show first 2 and last 4 digits
    const masked = digits.slice(0, 2) + '****' + digits.slice(-4);

    // If original had country code (+91 etc), preserve format
    if (phone.startsWith('+')) {
        return phone.slice(0, 3) + ' ' + masked;
    }

    return masked;
}

/**
 * Mask PAN number for display/logging
 * Input: ABCDE1234F
 * Output: ABC***34F
 * @param {string} pan - Full PAN
 * @returns {string} Masked PAN
 */
function maskPAN(pan) {
    if (!pan || typeof pan !== 'string') return pan;
    if (pan.length !== 10) return pan;

    return pan.slice(0, 3) + '***' + pan.slice(6, 8) + pan.slice(-1);
}

/**
 * Mask card number for display
 * Input: 4111111111111111
 * Output: ****1111
 * @param {string} cardNumber - Full card number
 * @returns {string} Last 4 digits with mask
 */
function maskCardNumber(cardNumber) {
    if (!cardNumber || typeof cardNumber !== 'string') return cardNumber;

    const digits = cardNumber.replace(/\D/g, '');
    if (digits.length < 4) return '****';

    return '****' + digits.slice(-4);
}

/**
 * Mask order ID for short display
 * Input: 123e4567-e89b-12d3-a456-426614174000
 * Output: 123e...4000
 * @param {string} orderId - Full UUID
 * @returns {string} Shortened ID
 */
function maskUUID(uuid) {
    if (!uuid || typeof uuid !== 'string') return uuid;
    if (uuid.length < 12) return uuid;

    return uuid.slice(0, 4) + '...' + uuid.slice(-4);
}

/**
 * Safe object mask - recursively masks sensitive fields
 * @param {Object} obj - Object to mask
 * @param {Array} sensitiveKeys - Keys to mask
 * @returns {Object} Masked copy
 */
function maskSensitiveFields(obj, sensitiveKeys = []) {
    if (!obj || typeof obj !== 'object') return obj;

    const defaultSensitive = [
        'password', 'secret', 'token', 'key',
        'authorization', 'cookie', 'creditCard'
    ];

    const keysToMask = [...defaultSensitive, ...sensitiveKeys];
    const masked = Array.isArray(obj) ? [...obj] : { ...obj };

    for (const [key, value] of Object.entries(masked)) {
        const lowerKey = key.toLowerCase();

        // Check if this key should be masked
        if (keysToMask.some(s => lowerKey.includes(s.toLowerCase()))) {
            masked[key] = '[REDACTED]';
            continue;
        }

        // Special field handling
        if (lowerKey === 'gstin' || lowerKey === 'gst_number') {
            masked[key] = maskGSTIN(value);
        } else if (lowerKey === 'email') {
            masked[key] = maskEmail(value);
        } else if (lowerKey === 'phone' || lowerKey === 'mobile') {
            masked[key] = maskPhone(value);
        } else if (lowerKey === 'pan') {
            masked[key] = maskPAN(value);
        } else if (typeof value === 'object' && value !== null) {
            // Recurse for nested objects
            masked[key] = maskSensitiveFields(value, sensitiveKeys);
        }
    }

    return masked;
}

module.exports = {
    maskGSTIN,
    maskEmail,
    maskPhone,
    maskPAN,
    maskCardNumber,
    maskUUID,
    maskSensitiveFields
};
