const translate = require('google-translate-api-x');
const logger = require('../utils/logger');

/**
 * Service to handle dynamic content translation
 */
class TranslationService {
    /**
     * Translate text to target language
     * @param {string} text - Text to translate
     * @param {string} targetLang - Target language code (e.g., 'hi', 'ta')
     * @returns {Promise<string>} - Translated text
     */
    async translateText(text, targetLang) {
        if (!text || !targetLang) {
            return text;
        }

        logger.debug({ text, targetLang, type: typeof text }, 'Translating text');

        try {
            const res = await translate(text, { to: targetLang });
            logger.debug({ res, type: typeof res }, 'Translation result');
            
            // If res is an array (multiple strings translated), return the array mapped to text strings
            if (Array.isArray(res)) {
                const results = res.map(r => r?.text || r);
                return Array.isArray(text) ? results : results[0];
            }
            return res?.text || res;
        } catch (error) {
            logger.warn({ err: error, textLength: Array.isArray(text) ? text.length : text?.length, targetLang }, 'Translation failed');
            return text; // Fallback to original
        }
    }

    /**
     * Translate profile name fields and all addresses in a single batch
     * @param {Object} profile - User profile object
     * @param {string} targetLang - Target language code
     * @returns {Promise<Object>} - Profile with translated names and addresses
     */
    async translateProfileResult(profile, targetLang) {
        if (!targetLang || targetLang === 'en' || !profile) {
            return profile;
        }

        logger.info({ userId: profile.id, targetLang }, 'Translating profile data in batch');

        try {
            // 1. Collect all translatable strings
            const stringsToTranslate = [];
            const mapping = [];

            // Helper to add string and keep track of where it belongs
            const add = (text, owner, key) => {
                if (text && typeof text === 'string' && text.trim().length > 0) {
                    stringsToTranslate.push(text);
                    mapping.push({ owner, key });
                }
            };

            // Profile info
            add(profile.firstName, profile, 'firstName');
            add(profile.lastName, profile, 'lastName');

            // Addresses info
            if (profile.addresses && Array.isArray(profile.addresses)) {
                profile.addresses.forEach((addr, index) => {
                    add(addr.streetAddress, addr, 'streetAddress');
                    add(addr.apartment, addr, 'apartment');
                    add(addr.city, addr, 'city');
                    add(addr.state, addr, 'state');
                    add(addr.country, addr, 'country');
                    add(addr.label, addr, 'label');
                });
            }

            if (stringsToTranslate.length === 0) return profile;

            // 2. Translate everything in one go
            const translatedStrings = await this.translateText(stringsToTranslate, targetLang);

            // 3. Map translated strings back
            // Handle both single string (if only one was sent) and array responses
            const results = Array.isArray(translatedStrings) ? translatedStrings : [translatedStrings];

            results.forEach((translated, index) => {
                const { owner, key } = mapping[index];
                if (translated) {
                    owner[key] = translated;
                }
            });

            // 4. Re-construct full name
            profile.name = `${profile.firstName}${profile.lastName ? ' ' + profile.lastName : ''}`.trim();

            return profile;
        } catch (error) {
            logger.error({ err: error, userId: profile.id }, 'Batch profile translation failed');
            return profile;
        }
    }
}

module.exports = new TranslationService();
