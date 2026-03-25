#!/usr/bin/env node

/**
 * Locale Sync Script
 * 
 * Copies locale files from frontend to backend for deployment.
 * This ensures backend has its own copy of locale files when
 * frontend and backend are deployed to separate platforms.
 * 
 * Usage:
 *   node scripts/sync-locales.js
 * 
 * This script should be run:
 * - Before backend deployment (in CI/CD pipeline)
 * - During backend build process
 * - When locale files are updated
 */

const fs = require('fs');
const path = require('path');

const FRONTEND_LOCALES = path.join(__dirname, '../../frontend/src/i18n/locales');
const BACKEND_LOCALES = path.join(__dirname, '../locales');
const LANGUAGES = ['en', 'hi', 'ta', 'te'];

/**
 * Deep merge source into target
 * @param {Object} target - The destination object (backend)
 * @param {Object} source - The source object (frontend)
 * @returns {Object} The merged target
 */
function mergeLocales(target, source) {
    for (const key in source) {
        if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            if (!(key in target) || typeof target[key] !== 'object') {
                target[key] = {};
            }
            mergeLocales(target[key], source[key]);
        } else {
            target[key] = source[key];
        }
    }
    return target;
}

console.log('[Locale Sync] Starting locale file synchronization...');
console.log(`[Locale Sync] Source: ${FRONTEND_LOCALES}`);
console.log(`[Locale Sync] Target: ${BACKEND_LOCALES}`);

// Create backend locales directory if it doesn't exist
if (!fs.existsSync(BACKEND_LOCALES)) {
    fs.mkdirSync(BACKEND_LOCALES, { recursive: true });
    console.log(`[Locale Sync] Created directory: ${BACKEND_LOCALES}`);
}

// Check if frontend locales directory exists
if (!fs.existsSync(FRONTEND_LOCALES)) {
    console.error(`[Locale Sync] ERROR: Frontend locales directory not found: ${FRONTEND_LOCALES}`);
    console.error('[Locale Sync] This script must be run from the monorepo root or backend directory.');
    process.exit(1);
}

LANGUAGES.forEach(lang => {
    const file = `${lang}.json`;
    const sourcePath = path.join(FRONTEND_LOCALES, file);
    const targetPath = path.join(BACKEND_LOCALES, file);

    if (!fs.existsSync(sourcePath)) {
        console.warn(`[Locale Sync] ⚠️  Source not found: ${file}`);
        return;
    }

    try {
        const frontendContent = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
        let backendContent = {};

        if (fs.existsSync(targetPath)) {
            try {
                backendContent = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
            } catch (err) {
                console.warn(`[Locale Sync] ⚠️  Existing ${file} is not valid JSON, overwriting.`);
            }
        }

        // Deep merge: Frontend keys overwrite backend, backend-only keys are preserved
        const mergedContent = mergeLocales(backendContent, frontendContent);

        fs.writeFileSync(targetPath, JSON.stringify(mergedContent, null, 2) + '\n', 'utf8');
        console.log(`[Locale Sync] ✓ Synchronized: ${file}`);
    } catch (err) {
        console.error(`[Locale Sync] ✗ Failed to sync ${file}:`, err.message);
    }
});

console.log('\n[Locale Sync] ✓ Synchronization complete!');
