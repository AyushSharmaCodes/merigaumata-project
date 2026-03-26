const {
    client,
    rawClient,
    supabase,
    supabaseAdmin,
    _supabaseAdmin
} = require('../lib/supabase');

// Export the proxied supabase client as the main export for backward compatibility
module.exports = supabase;

// Also provide named exports for cases where both or specific clients are needed.
// `client` is the canonical singleton; the legacy names remain aliases.
module.exports.client = client;
module.exports.rawClient = rawClient;
module.exports.supabase = supabase;
module.exports.supabaseAdmin = supabaseAdmin;
module.exports._supabaseAdmin = _supabaseAdmin;
