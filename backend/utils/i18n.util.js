const logger = require('./logger');

/**
 * Recursively applies localized text from `_i18n` fields to their base properties.
 *
 * @param {Object|Array} data - The data object or array from the database.
 * @param {string} lang - The target language code (e.g., 'en', 'hi').
 * @param {boolean} stripI18n - Whether to delete the `_i18n` property from the result payload. Default is true.
 * @returns {Object|Array|null} A new deep-cloned object/array with translations applied.
 */
function applyTranslations(data, lang, stripI18n = true) {
    if (!data) return data;

    // Handle arrays
    if (Array.isArray(data)) {
        return data.map(item => applyTranslations(item, lang, stripI18n));
    }

    // Handle single objects (deep clone to avoid mutation of cached data)
    // Only process plain objects
    if (typeof data !== 'object' || data === null || data instanceof Date) {
        return data; // Return primitives or non-plain-objects as is
    }

    const result = { ...data };

    for (const key in result) {
        if (!Object.prototype.hasOwnProperty.call(result, key)) continue;

        if (key.endsWith('_i18n') && result[key]) {
            const baseField = key.replace('_i18n', '');

            // Ensure the translations object is actually an object and not a stringified JSON (from some legacy DB cols)
            let translations = result[key];
            if (typeof translations === 'string') {
                try {
                    translations = JSON.parse(translations);
                } catch (e) {
                    logger.warn({ key, err: e.message }, '[i18n] Failed to parse translation string');
                    translations = {};
                }
            }

            // Apply translation if it exists for the requested language
            if (translations && typeof translations === 'object' && translations[lang]) {
                result[baseField] = translations[lang];
            } else if (translations && typeof translations === 'object' && translations['en']) {
                // Fallback to english if available
                result[baseField] = translations['en'];
            }

            // Strip the bulky i18n object from final response to save bandwidth
            if (stripI18n) {
                delete result[key];
            } else {
                result[key] = translations; // ensure it is object if stringified early
            }
        } else if (typeof result[key] === 'object' && result[key] !== null) {
            // Recursively translate nested objects (e.g., category inside product)
            result[key] = applyTranslations(result[key], lang, stripI18n);
        }
    }

    return result;
}

/**
 * Simple key-based translation for one-off messages.
 * Uses global.reqLanguage if available.
 *
 * @param {string} key - The i18n key.
 * @param {Object} params - Translation parameters.
 * @returns {string} The translated message.
 */
function translate(key, params = {}) {
    const { i18next } = require('../middleware/i18n.middleware');
    return i18next.t(key, { lng: global.reqLanguage || 'en', ...params }) || key;
}

/**
 * Generates an object with translations for all available languages.
 * Useful for storing multilingual notes in the database.
 *
 * @param {string} key - The i18n key.
 * @param {Object} params - Translation parameters.
 * @returns {Object} An object like { en: "...", hi: "..." }.
 */
function generateI18nObject(key, params = {}) {
    const { i18next, availableLanguages } = require('../middleware/i18n.middleware');
    const result = {};

    availableLanguages.forEach(lang => {
        result[lang] = i18next.t(key, { ...params, lng: lang });
    });

    return result;
}

module.exports = {
    applyTranslations,
    translate,
    generateI18nObject
};
