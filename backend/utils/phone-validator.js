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
    }

    /**
     * Validate a phone number
     * @param {string} phone - Phone number to validate
     * @returns {Promise<{isValid: boolean, error?: string}>}
     */
    async validate(phone) {
        logger.info({ phone }, 'PhoneValidator.validate called');
        if (!phone) {
            return { isValid: false, error: 'Please enter a phone number.' };
        }

        if (!this.apiKey) {
            logger.warn('ABSTRACT_API_PHONE_KEY is not set. Skipping phone validation.');
            return { isValid: true }; // Graceful bypass if not configured
        }

        if (!this.apiUrl) {
            logger.warn('ABSTRACT_API_PHONE_URL is not set. Skipping phone validation.');
            return { isValid: true };
        }

        try {
            logger.info({ phone }, 'Initiating phone validation with Abstract API');

            const response = await axios.get(this.apiUrl, {
                params: {
                    api_key: this.apiKey,
                    phone: phone
                },
                timeout: 5000 // 5 seconds timeout
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
                logger.info({ phone, countryName }, 'Phone number is INVALID');
                return {
                    isValid: false,
                    error: `The phone number ${phone} is not valid for ${countryName || 'the specified country'}.`
                };
            }

            logger.info({ phone, countryName }, 'Phone number is VALID');
            return { isValid: true };

        } catch (error) {
            // Handle API errors gracefully - NEVER block user for API issues
            // Only log internally, do not expose to user
            if (error.response) {
                const status = error.response.status;
                const errorData = error.response.data;

                if (status === 429) {
                    logger.warn({ phone, module: 'PhoneValidator', operation: 'QUOTA_EXCEEDED' },
                        'Abstract API quota exceeded. Skipping validation - user will proceed.');
                    return { isValid: true };
                }

                if (status === 401 || status === 403) {
                    logger.warn({ phone, status, module: 'PhoneValidator', operation: 'AUTH_ERROR' },
                        'Abstract API authentication failed. Check API key. Skipping validation.');
                    return { isValid: true };
                }

                logger.warn({ phone, status, errorData, module: 'PhoneValidator', operation: 'API_ERROR' },
                    'Abstract API returned an error. Skipping validation - user will proceed.');
            } else if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
                logger.warn({ phone, module: 'PhoneValidator', operation: 'TIMEOUT' },
                    'Abstract API request timed out. Skipping validation - user will proceed.');
            } else {
                logger.warn({ phone, message: error.message, module: 'PhoneValidator', operation: 'NETWORK_ERROR' },
                    'Network error during phone validation. Skipping validation - user will proceed.');
            }

            // For ALL API/network issues, allow user to proceed silently
            return { isValid: true };
        }
    }
}

module.exports = new PhoneValidator();
