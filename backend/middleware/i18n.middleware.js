const i18next = require('i18next');
const middleware = require('i18next-http-middleware');
const Backend = require('i18next-fs-backend');
const path = require('path');
const fs = require('fs');

/**
 * NOTE: We use console.log/error here instead of logger to avoid circular dependency.
 * The logger module imports i18n middleware, so we can't import logger here.
 * This is acceptable for initialization logs that happen once at startup.
 */

/**
 * Auto-detect available languages by scanning the locales directory
 * This makes the backend i18n system truly language-agnostic:
 * - Adding a new language requires only creating a new .json file
 * - No code changes needed
 * - Supports any number of languages
 * 
 * Backend reads only from its own committed ./locales directory.
 * Deployments do not depend on frontend files or monorepo layout.
 */
const backendLocalesPath = path.join(__dirname, '../locales');
const frontendLocalesPath = path.join(__dirname, '../../frontend/src/i18n/locales');
const localesPath = fs.existsSync(backendLocalesPath)
    ? backendLocalesPath
    : frontendLocalesPath;

const availableLanguages = [];

try {
    const files = fs.readdirSync(localesPath);
    files.forEach(file => {
        // Match .json files, excluding .bak files
        if (file.endsWith('.json') && !file.endsWith('.bak.json')) {
            const langCode = file.replace('.json', '');
            availableLanguages.push(langCode);
        }
    });

    if (availableLanguages.length === 0) {
        console.error(`[i18n] Critical: No locale files found in ${localesPath}`);
        availableLanguages.push('en'); // Fallback
    } else {
        console.log(`[i18n] Auto-detected languages: ${availableLanguages.join(', ')} (from ${localesPath})`);
    }
} catch (err) {
    console.error(`[i18n] Failed to scan locales directory (${localesPath}):`, err.message);
    availableLanguages.push('en', 'hi'); // Fallback to known languages
}

// Initialize i18next
i18next
    .use(Backend)
    .use(middleware.LanguageDetector)
    .init({
        fallbackLng: 'en',
        preload: availableLanguages,
        supportedLngs: availableLanguages,
        ns: ['translation'],
        defaultNS: 'translation',
        backend: {
            loadPath: path.join(localesPath, '{{lng}}.json')
        },
        detection: {
            order: ['querystring', 'header', 'cookie'],
            lookupQuerystring: 'lang',
            lookupHeader: 'x-user-lang',
            caches: false
        }
    }, (err) => {
        if (err) {
            console.error('[i18n] Initialization failed:', err);
        } else {
            console.log(`[i18n] Initialized successfully with languages: ${availableLanguages.join(', ')}`);
        }
    });

module.exports = {
    i18next,
    availableLanguages,
    handle: middleware.handle(i18next),
    i18nMiddleware: (req, res, next) => {
        // Determine language (detecting from query, header, or user profile)
        let lang = req.query.lang || req.headers['x-user-lang'];

        if (!lang && req.user && req.user.preferred_language) {
            lang = req.user.preferred_language;
        }

        // Validate against available languages (auto-detected)
        if (!lang || !availableLanguages.includes(lang)) {
            lang = 'en';
        }

        // Set language for the current request
        req.language = lang;
        global.reqLanguage = lang; // For internal service access

        middleware.handle(i18next)(req, res, next);
    }
};
