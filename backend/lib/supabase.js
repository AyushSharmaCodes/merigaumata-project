
const logger = require('../utils/logger');
const { createClient } = require('@supabase/supabase-js');
const { withQueryLogging } = require('../utils/supabase-client-proxy');

const { fetchWithRetry } = require('../utils/fetch-retry');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    logger.warn('Supabase URL, Anon Key, or Service Role Key is missing in backend environment.');
}

// Create the raw client once at module load time so every importer receives the
// same singleton instance from Node's module cache.
const rawClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    },
    global: {
        fetch: fetchWithRetry
    }
});

// The backend currently uses one proxied singleton client for both standard and
// admin code paths. Keep the old names as aliases so existing imports continue
// to work, but make the canonical singleton explicit.
const singletonClient = withQueryLogging(rawClient);
const supabase = singletonClient;
const supabaseAdmin = singletonClient;
const _supabaseAdmin = rawClient;

module.exports = Object.freeze({
    client: singletonClient,
    rawClient,
    supabase,
    supabaseAdmin,
    _supabaseAdmin
});
