const { supabaseAdmin, _supabaseAdmin } = require('../config/supabase');
const logger = require('../utils/logger');

/**
 * System Switches Service
 * Handles fetching, caching, and mapping boolean/string operational toggles.
 * If a DB fetch fails or isn't built into the table yet, it falls back to the local process.env.
 */

let switchesCache = null;
let lastCacheUpdate = 0;
const CACHE_TTL = 5000; // 5 seconds

// Baseline expected switches. This must match the DB seeded values securely.
const EXPECTED_SWITCHES = [
    'ENABLE_INTERNAL_SCHEDULER',
    'ENABLE_RESERVATION_CLEANUP',
    'RAZORPAY_SMS_NOTIFY',
    'RAZORPAY_EMAIL_NOTIFY',
    'AUTO_REPLY_ENABLED',
    'INVOICE_STORAGE_STRATEGY',
    'CURRENCY_PRIMARY_PROVIDER',
    'LOG_PROVIDER',
    'CACHE_PROVIDER',
    'BRAND_LOGO_URL',
    'ALLOWED_ORIGINS',
    'SELLER_STATE_CODE',
    'SELLER_GSTIN',
    'SELLER_CIN',
    'NEW_RELIC_ENABLED',
    'SUPPORT_EMAIL',
    'AUTH_COOKIE_SAMESITE',
    'AUTH_COOKIE_SECURE'
];

function tryParseJSON(str) {
    if (typeof str !== 'string') return str;
    try {
        return JSON.parse(str);
    } catch {
        // Return raw string if it's not valid JSON (e.g., plain text words)
        return str;
    }
}

/**
 * Fetches the raw switches from the Database (or relies on the local cache).
 */
async function fetchAllSwitchesFromDB() {
    const now = Date.now();
    if (switchesCache && (now - lastCacheUpdate < CACHE_TTL)) {
        return switchesCache;
    }

    try {
        const { data, error } = await _supabaseAdmin
            .from('system_switches')
            .select('key, value');

        if (error) {
            // Check if the relation simply doesn't exist yet (migration not applied)
            if (error.code === '42P01') {
                logger.warn('system_switches table not found. Defaulting to process.env switches.');
            } else {
                throw error;
            }
        }

        const dbSwitches = {};
        if (data) {
            for (const row of data) {
                // Supabase JSONB comes through naturally parsed, but handle raw strings just in case.
                dbSwitches[row.key] = typeof row.value === 'object' ? row.value : tryParseJSON(row.value);
            }
        }

        switchesCache = dbSwitches;
        lastCacheUpdate = now;
        return switchesCache;
    } catch (error) {
        logger.error({ err: error }, '[System Switches] Error fetching database switches. Falling back purely to process.env');
        return {}; // Return empty and let it fallback to process.env
    }
}

/**
 * Initializes the switch cache, usually called during server startup.
 */
async function initialize() {
    logger.info({ module: 'System Switches', operation: 'INIT' }, 'Fetching system switches from database...');
    await fetchAllSwitchesFromDB();
    const count = switchesCache ? Object.keys(switchesCache).length : 0;
    logger.info({ module: 'System Switches', operation: 'INIT', count }, 'System switches initialization complete.');
}

/**
 * Synchronously retrieves a switch from the local memory cache.
 * Falls back to process.env if cache is empty or key is missing.
 */
function getSwitchSync(keyName, defaultValue = null) {
    // 1. Check DB Cache first
    if (switchesCache && Object.prototype.hasOwnProperty.call(switchesCache, keyName)) {
        return switchesCache[keyName];
    }

    // 2. Check process.env fallback
    if (process.env[keyName] !== undefined) {
        const envVal = process.env[keyName];
        if (envVal === 'true') return true;
        if (envVal === 'false') return false;
        return envVal;
    }

    // 3. Absolute fallback
    return defaultValue;
}

/**
 * Retrieves a specific system toggle (Async).
 * Evaluates in order: DB Cache -> Local Node process.env -> Fallback defaultValue
 */
async function getSwitch(keyName, defaultValue = null) {
    const memorySwitches = await fetchAllSwitchesFromDB();

    // 1. Check if the database has explicitly mapped a value
    if (memorySwitches && Object.prototype.hasOwnProperty.call(memorySwitches, keyName)) {
        return memorySwitches[keyName];
    }

    // 2. Check if a hard override or local .env fallback exists
    if (process.env[keyName] !== undefined) {
        const envVal = process.env[keyName];
        if (envVal === 'true') return true;
        if (envVal === 'false') return false;
        return envVal;
    }

    // 3. Absolute fallback
    return defaultValue;
}

/**
 * Clears the local hot-cache, usually called globally during a realtime connection event.
 */
function clearSwitchesCache() {
    switchesCache = null;
    lastCacheUpdate = 0;
}

module.exports = {
    initialize,
    getSwitch,
    getSwitchSync,
    clearSwitchesCache,
    EXPECTED_SWITCHES
};
