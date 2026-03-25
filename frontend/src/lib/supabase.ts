import { logger } from "@/lib/logger";

import { createClient } from '@supabase/supabase-js';

// Environment variables for Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    logger.warn('Supabase URL or Anon Key is missing. Realtime/storage features may not work.');
}

// Create Supabase client singleton
// Uses global variable in development to prevent multiple instances during HMR
//
const createSupabaseClient = () => createClient(supabaseUrl || '', supabaseAnonKey || '', {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
    },
});

export const supabase = (() => {
    if (import.meta.env.DEV) {
        // In development, attach to window to persist across HMR
        const globalWithSupabase = window as typeof window & { __supabase?: ReturnType<typeof createSupabaseClient> };
        if (!globalWithSupabase.__supabase) {
            globalWithSupabase.__supabase = createSupabaseClient();
        }
        return globalWithSupabase.__supabase;
    }
    // In production, just create the client
    return createSupabaseClient();
})();
