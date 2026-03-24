import { logger } from "@/lib/logger";
import { create } from "zustand";
import type { User } from "@/types";
import { supabase } from "@/lib/supabase";
import { queryClient } from "@/lib/react-query";
import { apiClient } from "@/lib/api-client";
import { syncSession } from "@/lib/services/auth.service";
import i18n from "@/i18n/config";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errorUtils";

// Helper to check if backend session cookies exist (avoids unnecessary refresh calls)
const hasSessionCookies = (): boolean => {
  const cookies = document.cookie;
  return cookies.includes('logged_in=') ||
    cookies.includes('access_token=') ||
    cookies.includes('refresh_token=');
};

// Helper to check if a JWT is expired (avoids API calls with stale tokens)
// bufferMs: Time buffer before actual expiry to consider token "expired" (default: 30s for clock skew)
const isTokenExpired = (token: string | undefined, bufferMs: number = 30000): boolean => {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    // Token is considered expired if it expires within the buffer window
    return payload.exp * 1000 < Date.now() + bufferMs;
  } catch {
    return true;
  }
};

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  isInitialized: boolean;
  isReactivationRequired: boolean;
  setUser: (user: User | null) => void;
  setReactivationRequired: (required: boolean) => void;
  login: (user: User) => void;
  logout: () => Promise<void>;
  initializeAuth: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
  isAdmin: () => boolean;
  isCustomer: () => boolean;
}

// Store listener cleanup function outside of zustand state
let authListenerUnsubscribe: (() => void) | null = null;
let sessionExpiredHandler: ((event: Event) => void) | null = null;
let sessionRecoveryPromise: Promise<void> | null = null;

const buildUserFromBackend = (userData: any): User => ({
  id: userData.id,
  email: userData.email || '',
  name: userData.name || '',
  phone: userData.phone || undefined,
  role: userData.role || 'customer',
  emailVerified: userData.emailVerified,
  phoneVerified: userData.phoneVerified || false,
  mustChangePassword: userData.mustChangePassword || false,
  deletionStatus: userData.deletionStatus,
  scheduledDeletionAt: userData.scheduledDeletionAt,
  addresses: [],
  language: userData.language,
});

const syncBackendSessionSilently = async (
  session: { access_token: string; refresh_token?: string | null },
  updateState?: (user: User) => void
): Promise<boolean> => {
  try {
    const userData = await syncSession(session.access_token, session.refresh_token || '', true);
    if (!userData) return false;

    const user = buildUserFromBackend(userData);
    updateState?.(user);

    logger.debug('[AuthStore] Silent backend session sync successful');
    return true;
  } catch (error) {
    logger.debug('[AuthStore] Silent backend session sync skipped', error);
    return false;
  }
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isInitializing: false, // Let initializeAuth() set this when it starts
  isInitialized: false, // Not initialized until background verification completes
  isReactivationRequired: false,

  setUser: (user) => {
    set({
      user,
      isAuthenticated: !!user,
      isReactivationRequired: user?.deletionStatus === 'PENDING_DELETION',
    });

    if (user?.language) {
      i18n.changeLanguage(user.language);
      localStorage.setItem("language", user.language);
    }
  },

  setReactivationRequired: (required) =>
    set({ isReactivationRequired: required }),

  login: (user) => {
    set({
      user,
      isAuthenticated: true,
      isInitialized: true,
    });

    if (user.language) {
      i18n.changeLanguage(user.language);
      localStorage.setItem("language", user.language);
    }
  },

  logout: async () => {
    try {
      // Clear local state
      set({
        user: null,
        isAuthenticated: false,
      });
      queryClient.clear();

      // Sign out from Supabase SDK (clears local storage)
      try {
        await supabase.auth.signOut();
      } catch {
        // Ignore SDK errors
      }

      // Clear backend cookies
      try {
        await apiClient.post('/auth/logout');
      } catch (err) {
        logger.warn("Backend logout error (potentially already logged out):", err);
      }

      logger.debug('[AuthStore] Logout completed with cookie and in-memory session cleanup');
    } catch (error) {
      logger.error("Logout error:", error);
    }
  },

  initializeAuth: async () => {
    // 1. Skip if already initialized or in progress (to prevent redundant calls)
    if (get().isInitialized || get().isInitializing) return;

    set({ isInitializing: true });

    try {
      // 2. Cleanup previous listeners
      if (authListenerUnsubscribe) {
        authListenerUnsubscribe();
        authListenerUnsubscribe = null;
      }
      if (sessionExpiredHandler) {
        window.removeEventListener('auth:session-expired', sessionExpiredHandler);
      }

      // 3. Set up session expiry listener (from api-client interceptor)
      sessionExpiredHandler = (event: Event) => {
        const customEvent = event as CustomEvent<{ message?: string; reason?: string }>;
        const errorMessage = customEvent.detail?.message;

        logger.warn('[AuthStore] Session expired event received from API Client', {
          message: errorMessage,
          reason: customEvent.detail?.reason
        });

        // Show user-friendly toast notification
        const displayMessage = getErrorMessage(errorMessage || 'auth.sessionExpiredToast', i18n.t.bind(i18n));

        toast.error(displayMessage, {
          duration: 5000,
          position: 'top-center'
        });

        // HARD REDIRECT: Force browser-level navigation to clear all React state and running queries
        // This prevents infinite retry loops from useQuery
        const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);

        // Construct URL manually to avoid React Router interference during critical failure
        // We use window.location.href to force a full page reload which clears memory
        window.location.href = `/?auth=login&returnUrl=${returnUrl}`;
      };
      window.addEventListener('auth:session-expired', sessionExpiredHandler);

      // 4. Rehydrate from backend cookies first.
      try {
        if (hasSessionCookies()) {
          try {
            const backendResult = await apiClient.post('/auth/refresh', {}, { silent: true } as any);
            const data = backendResult.data;

            if (data.tokens?.access_token && data.tokens?.refresh_token) {
              await supabase.auth.setSession({
                access_token: data.tokens.access_token,
                refresh_token: data.tokens.refresh_token
              });
              logger.debug('[AuthStore] Supabase session hydrated from backend refresh cookies');
            }

            if (data.user) {
              const user = buildUserFromBackend(data.user);

              set({
                user,
                isAuthenticated: true,
                isInitialized: true,
                isReactivationRequired: data.user.deletionStatus === 'PENDING_DELETION',
              });

              logger.debug(`[AuthStore] User initialized from backend cookies (Status: ${data.user.deletionStatus || 'ACTIVE'})`);
              return;
            }
          } catch (backendError: any) {
            logger.debug('[AuthStore] Backend cookie refresh did not restore a session', backendError);

            if ([403, 410].includes(backendError?.response?.status)) {
              await get().logout();
              set({ isInitialized: true });
              return;
            }
          }
        }

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          logger.warn('[AuthStore] Supabase getSession error:', sessionError.message);
        }

        if (session?.user) {
          if (isTokenExpired(session.access_token)) {
            logger.debug('[AuthStore] Supabase session token expired, clearing stale in-memory session');
            await supabase.auth.signOut();
            set({
              user: null,
              isAuthenticated: false,
              isInitialized: true,
            });
            return;
          }

          logger.debug('[AuthStore] Supabase session exists in memory, attempting backend session sync...');
          try {
            const userData = await syncSession(session.access_token, session.refresh_token || '', true);
            if (userData) {
              const user = buildUserFromBackend(userData);

              set({
                user,
                isAuthenticated: true,
                isInitialized: true,
                isReactivationRequired: userData.deletionStatus === 'PENDING_DELETION',
              });

              logger.debug('[AuthStore] Session sync successful');
              return;
            }
          } catch (syncError: any) {
            const errorMessage = syncError?.message || syncError?.error?.message || '';

            if (errorMessage.includes('jwt_claim_invalid') ||
              errorMessage.includes('Invalid claim') ||
              errorMessage.includes('not allowed in JWT')) {
              logger.warn('[AuthStore] JWT claim validation failed, clearing invalid session:', errorMessage);

              try {
                await supabase.auth.signOut();
              } catch {
                // Silent fail
              }

              set({
                user: null,
                isAuthenticated: false,
                isInitialized: true,
              });
              return;
            }

            logger.debug('[AuthStore] Session sync failed (silent):', syncError);
          }
        }

        set({
          user: null,
          isAuthenticated: false,
          isInitialized: true,
        });
        logger.debug('[AuthStore] No valid session found (guest)');
      } catch (error: unknown) {
        set({
          user: null,
          isAuthenticated: false,
          isInitialized: true,
        });
        logger.debug('[AuthStore] Session check failed, treating as guest');
      }

      // 5. Set up Supabase listener (mainly for cross-tab debugging/sync)
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        logger.debug(`[AuthStore] Supabase auth event: ${event}`);

        // CRITICAL FIX: Sync with backend on token refresh (auto-refresh or manual)
        // This ensures backend cookies are always in sync with the frontend session
        if (event === 'TOKEN_REFRESHED' && session) {
          logger.debug('[AuthStore] TOKEN_REFRESHED event, syncing with backend...');
          try {
            await apiClient.post('/auth/sync', {
              access_token: session.access_token,
              refresh_token: session.refresh_token
            });
            logger.debug('[AuthStore] Backend sync successful');
          } catch (error) {
            // If sync fails, it might be due to network or backend issues. 
            // We log it but don't force logout yet, as the frontend token is valid.
            logger.error('[AuthStore] Backend sync failed:', error);
          }
        }
      });

      authListenerUnsubscribe = () => subscription.unsubscribe();

      // 6. PROACTIVE TOKEN REFRESH: Handle inactive tabs returning to focus
      // When user returns to tab after extended period, proactively refresh if token is expired
      const recoverSessionAfterResume = async (reason: string) => {
        if (sessionRecoveryPromise) {
          await sessionRecoveryPromise;
          return;
        }

        sessionRecoveryPromise = (async () => {
          try {
            const state = get();
            const shouldRecover = state.isAuthenticated || !!state.user;
            if (!shouldRecover) return;

            let { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) return;

            if (isTokenExpired(session.access_token, 60000)) {
              logger.debug(`[AuthStore] Session recovery (${reason}) refreshing Supabase session...`);
              const { data, error } = await supabase.auth.refreshSession();
              if (error || !data.session?.access_token) {
                logger.warn(`[AuthStore] Session recovery (${reason}) refresh failed:`, error);
                return;
              }
              session = data.session;
            }

            await syncBackendSessionSilently(session, (user) => {
              set({
                user,
                isAuthenticated: true,
                isInitialized: true,
                isReactivationRequired: user.deletionStatus === 'PENDING_DELETION',
              });
            });
          } catch (error) {
            logger.debug(`[AuthStore] Session recovery (${reason}) failed (non-critical):`, error);
          } finally {
            sessionRecoveryPromise = null;
          }
        })();

        await sessionRecoveryPromise;
      };

      const handleVisibilityChange = async () => {
        if (!document.hidden) {
          await recoverSessionAfterResume('visibilitychange');
        }
      };

      const handleWindowFocus = async () => {
        await recoverSessionAfterResume('focus');
      };

      const handlePageShow = async () => {
        await recoverSessionAfterResume('pageshow');
      };

      const handleOnline = async () => {
        await recoverSessionAfterResume('online');
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('focus', handleWindowFocus);
      window.addEventListener('pageshow', handlePageShow);
      window.addEventListener('online', handleOnline);

      // 7. PERIODIC TOKEN MONITORING: Check token expiry every 5 minutes
      // Refresh if token expires within 10 minutes (backup for autoRefreshToken)
      const tokenMonitorInterval = setInterval(async () => {
        // Only check if tab is visible and user is authenticated
        if (!document.hidden && get().isAuthenticated) {
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.access_token) {
              // Check if token expires in less than 10 minutes
              if (isTokenExpired(session.access_token, 10 * 60 * 1000)) {
                logger.debug('[AuthStore] Token expiring soon, proactively refreshing...');
                const { data: { session: newSession }, error } = await supabase.auth.refreshSession();

                if (error) {
                  logger.warn('[AuthStore] Periodic refresh failed:', error);
                } else if (newSession) {
                  logger.debug('[AuthStore] Periodic refresh successful');
                }
              }
            }
          } catch (error) {
            logger.debug('[AuthStore] Periodic token check failed (non-critical):', error);
          }
        }
      }, 5 * 60 * 1000); // Check every 5 minutes

      // Cleanup function for visibility listener and interval
      const originalUnsubscribe = authListenerUnsubscribe;
      authListenerUnsubscribe = () => {
        originalUnsubscribe?.();
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('focus', handleWindowFocus);
        window.removeEventListener('pageshow', handlePageShow);
        window.removeEventListener('online', handleOnline);
        clearInterval(tokenMonitorInterval);
      };

    } catch (error) {
      logger.error("Initialize auth error:", error);
      set({
        user: null,
        isAuthenticated: false,
        isInitialized: true,
      });
    } finally {
      set({ isInitializing: false });
    }
  },

  updateUser: (updates) => {
    if (updates.language) {
      i18n.changeLanguage(updates.language);
      localStorage.setItem("language", updates.language);
    }
    set((state) => ({
      user: state.user ? { ...state.user, ...updates } : null,
    }));
  },

  isAdmin: () => {
    const state = get();
    return state.isAuthenticated && state.user?.role === "admin";
  },

  isCustomer: () => {
    const state = get();
    return state.isAuthenticated && state.user?.role === "customer";
  },
}));
