
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

// Admin client for privileged operations (bypasses RLS)
const _supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    },
    global: {
        fetch: fetchWithRetry
    }
});

// Standard client (also using service role by default in this backend architecture)
// This ensures backward compatibility for all routes/services using require('../config/supabase')
const supabase = withQueryLogging(_supabaseAdmin);
const supabaseAdmin = supabase; // They are the same now, but kept both exports for clarity

module.exports = {
    supabase,
    supabaseAdmin
};
