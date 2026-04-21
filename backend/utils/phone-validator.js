const axios = require('axios');
const logger = require('./logger');

/**
 * Phone Validator Utility
 * Uses Abstract API to validate phone numbers
 */
class PhoneValidator {
    constructor() {
        this.apiKey = process.env.ABSTRACT_API_PHONE_KEY;
        this.apiUrl = process.env.ABSTRACT_API_PHONE_URL;
        this.cache = new Map();
        this.cacheTtlMs = 10 * 60 * 1000;
        this.requestTimeoutMs = 1200;
    }

    normalize(phone) {
        return String(phone || '').replace(/\s+/g, '').trim();
    }

    getCached(phone) {
        const normalizedPhone = this.normalize(phone);
        const cached = this.cache.get(normalizedPhone);

        if (!cached) return null;
        if (Date.now() - cached.timestamp > this.cacheTtlMs) {
            this.cache.delete(normalizedPhone);
            return null;
        }

        return cached.result;
    }

    setCached(phone, result) {
        const normalizedPhone = this.normalize(phone);
        if (!normalizedPhone) return;

        this.cache.set(normalizedPhone, {
            result,
            timestamp: Date.now()
        });
    }

    /**
     * Validate a phone number
     * @param {string} phone - Phone number to validate
     * @returns {Promise<{isValid: boolean, error?: string}>}
     */
    async validate(phone) {
        const normalizedPhone = this.normalize(phone);
        logger.info({ phone: normalizedPhone }, 'PhoneValidator.validate called');

        if (!normalizedPhone) {
            return { isValid: false, error: 'Please enter a phone number.' };
        }

        const cached = this.getCached(normalizedPhone);
        if (cached) {
            return cached;
        }

        if (!this.apiKey) {
            logger.warn('ABSTRACT_API_PHONE_KEY is not set. Skipping phone validation.');
            const result = { isValid: true };
            this.setCached(normalizedPhone, result);
            return result; // Graceful bypass if not configured
        }

        if (!this.apiUrl) {
            logger.warn('ABSTRACT_API_PHONE_URL is not set. Skipping phone validation.');
            const result = { isValid: true };
            this.setCached(normalizedPhone, result);
            return result;
        }

        try {
            logger.info({ phone: normalizedPhone }, 'Initiating phone validation with Abstract API');

            const response = await axios.get(this.apiUrl, {
                params: {
                    api_key: this.apiKey,
                    phone: normalizedPhone
                },
                timeout: this.requestTimeoutMs
            });

            const data = response.data;

            // Abstract Phone Intelligence API response structure:
            // {
            //   "phone_number": "...",
            //   "phone_validation": { "is_valid": true, ... },
            //   "phone_location": { "country_name": "...", ... },
            //   ...
            // }

            const isValid = data.phone_validation?.is_valid;
            const countryName = data.phone_location?.country_name;

            if (isValid === false) {
                logger.info({ phone: normalizedPhone, countryName }, 'Phone number is INVALID');
                const result = {
                    isValid: false,
                    error: `The phone number ${normalizedPhone} is not valid for ${countryName || 'the specified country'}.`
                };
                this.setCached(normalizedPhone, result);
                return result;
            }

            logger.info({ phone: normalizedPhone, countryName }, 'Phone number is VALID');
            const result = { isValid: true };
            this.setCached(normalizedPhone, result);
            return result;

        } catch (error) {
            // Handle API errors gracefully - NEVER block user for API issues
            // Only log internally, do not expose to user
            if (error.response) {
                const status = error.response.status;
                const errorData = error.response.data;

                if (status === 429) {
                    logger.warn({ phone: normalizedPhone, module: 'PhoneValidator', operation: 'QUOTA_EXCEEDED' },
                        'Abstract API quota exceeded. Skipping validation - user will proceed.');
                    const result = { isValid: true };
                    this.setCached(normalizedPhone, result);
                    return result;
                }

                if (status === 401 || status === 403) {
                    logger.warn({ phone: normalizedPhone, status, module: 'PhoneValidator', operation: 'AUTH_ERROR' },
                        'Abstract API authentication failed. Check API key. Skipping validation.');
                    const result = { isValid: true };
                    this.setCached(normalizedPhone, result);
                    return result;
                }

                logger.warn({ phone: normalizedPhone, status, errorData, module: 'PhoneValidator', operation: 'API_ERROR' },
                    'Abstract API returned an error. Skipping validation - user will proceed.');
            } else if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
                logger.warn({ phone: normalizedPhone, module: 'PhoneValidator', operation: 'TIMEOUT' },
                    'Abstract API request timed out. Skipping validation - user will proceed.');
            } else {
                logger.warn({ phone: normalizedPhone, message: error.message, module: 'PhoneValidator', operation: 'NETWORK_ERROR' },
                    'Network error during phone validation. Skipping validation - user will proceed.');
            }

            // For ALL API/network issues, allow user to proceed silently
            const result = { isValid: true };
            this.setCached(normalizedPhone, result);
            return result;
        }
    }
}

module.exports = new PhoneValidator();
