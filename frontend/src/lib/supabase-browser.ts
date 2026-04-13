import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { CONFIG } from "@/config";
import { getAuthSession, getAuthSessionChangedEventName } from "@/lib/auth-session";
import { logger } from "@/lib/logger";

let browserClient: SupabaseClient | null = null;
let authListenerRegistered = false;
let lastRealtimeToken: string | null = null;

function applyRealtimeAuthToken(client: SupabaseClient) {
  const nextToken = getAuthSession()?.accessToken || null;

  if (lastRealtimeToken === nextToken) {
    return;
  }

  client.realtime.setAuth(nextToken || CONFIG.SUPABASE_ANON_KEY);
  lastRealtimeToken = nextToken;
}

function registerRealtimeAuthListener(client: SupabaseClient) {
  if (authListenerRegistered || typeof window === "undefined") {
    return;
  }

  window.addEventListener(getAuthSessionChangedEventName(), () => {
    applyRealtimeAuthToken(client);
  });

  authListenerRegistered = true;
}

export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY) {
    return null;
  }

  if (!browserClient) {
    browserClient = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      realtime: {
        params: {
          eventsPerSecond: 5,
        },
      },
    });

    applyRealtimeAuthToken(browserClient);
    registerRealtimeAuthListener(browserClient);

    logger.debug("[Supabase] Browser client initialized for realtime subscriptions");
  }

  applyRealtimeAuthToken(browserClient);
  return browserClient;
}
