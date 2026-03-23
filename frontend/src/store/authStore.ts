import { logger } from "@/lib/logger";
import { create } from "zustand";
import type { User } from "@/types";
import { supabase } from "@/lib/supabase";
import { queryClient } from "@/lib/react-query";
import { apiClient } from "@/lib/api-client";
import { syncSession } from "@/lib/services/auth.service";
import { AuthCache, getTokenExpiry } from "@/lib/auth-cache";
import i18n from "@/i18n/config";
import { toast } from "sonner";

// Helper to check if session cookies exist (avoids 401 on first visit)
const hasSessionCookies = (): boolean => {
  const cookies = document.cookie;
  return cookies.includes('sb-access-token') ||
    cookies.includes('sb-refresh-token') ||
    cookies.includes('access_token') ||
    cookies.includes('refresh_token');
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

// Initialize store with cached auth state for instant restoration
// Auth cache provides instant auth state on page load (~0ms vs ~500ms verification)
const cachedAuth = AuthCache.get();

export const useAuthStore = create<AuthState>((set, get) => ({
  // Restore from cache immediately (if valid)
  user: cachedAuth?.user || null,
  isAuthenticated: cachedAuth?.isAuthenticated || false,
  isInitializing: false, // Let initializeAuth() set this when it starts
  isInitialized: false, // Not initialized until background verification completes
  isReactivationRequired: cachedAuth?.user?.deletionStatus === 'PENDING_DELETION' || false,

  setUser: (user) => {
    set({
      user,
      isAuthenticated: !!user,
      isReactivationRequired: user?.deletionStatus === 'PENDING_DELETION',
    });

    // Cache auth state when user is set (with 24 hour expiry)
    if (user) {
      AuthCache.set(user, Date.now() + (24 * 60 * 60 * 1000));
    } else {
      AuthCache.clear();
    }

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

    // Cache auth state with 24 hour expiry (will be updated on token refresh)
    AuthCache.set(user, Date.now() + (24 * 60 * 60 * 1000));

    if (user.language) {
      i18n.changeLanguage(user.language);
      localStorage.setItem("language", user.language);
    }
  },

  logout: async () => {
    try {
      // Clear auth cache first
      AuthCache.clear();

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

      // Complete local storage wipe
      localStorage.clear();
      sessionStorage.removeItem('active_coupons'); // Explicitly clear coupons
      sessionStorage.clear();

      logger.debug('[AuthStore] Logout completed with full storage wipe (no automatic refresh)');
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
        // Try to translate the error message if it's an i18n key
        const displayMessage = errorMessage && errorMessage.startsWith('errors.')
          ? i18n.t(errorMessage)
          : (errorMessage || i18n.t('auth.sessionExpiredToast'));

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

      // 4. OPTIMIZED: Run Supabase and backend checks in parallel (saves 300-500ms)
      try {
        const [sessionResult, backendResult] = await Promise.allSettled([
          supabase.auth.getSession(),
          // Only call backend if we have session cookies (optimization)
          hasSessionCookies()
            ? apiClient.post('/auth/refresh', {}, { silent: true } as any)
            : Promise.resolve(null)
        ]);

        // Process Supabase session result
        if (sessionResult.status === 'rejected') {
          logger.warn('[AuthStore] Supabase session check failed:', sessionResult.reason);
          set({ user: null, isAuthenticated: false, isInitialized: true });
          return;
        }

        const { data: { session }, error: sessionError } = sessionResult.value;

        if (sessionError) {
          logger.warn('[AuthStore] Supabase getSession error:', sessionError.message);

          const isRefreshError =
            sessionError.message.includes('Invalid Refresh Token') ||
            sessionError.message.includes('Refresh Token Not Found') ||
            sessionError.message.includes('not found');

          if (isRefreshError) {
            logger.warn('[AuthStore] Detected invalid refresh token, forcing logout cleanup');
            AuthCache.clear();
            await get().logout();
            set({ isInitializing: false, isInitialized: true });
            return;
          }
        }

        if (session?.user) {
          // User has Supabase session, now verify with backend and sync profile

          // Check if we have session cookies - if not, skip refresh and go straight to sync
          if (!hasSessionCookies()) {
            // But first, check if the token is expired - if so, don't bother making API calls
            if (isTokenExpired(session.access_token)) {
              logger.debug('[AuthStore] Supabase session token expired, clearing stale session');
              await supabase.auth.signOut();
              set({
                user: null,
                isAuthenticated: false,
                isInitialized: true,
              });
              return;
            }

            logger.debug('[AuthStore] Supabase session exists but no backend cookies, attempting session sync...');
            try {
              const userData = await syncSession(session.access_token, session.refresh_token || '', true);
              if (userData) {
                const user: User = {
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
                };

                set({
                  user,
                  isAuthenticated: true,
                  isInitialized: true,
                  isReactivationRequired: userData.deletionStatus === 'PENDING_DELETION',
                });

                // Cache the synced auth state
                const expiry = getTokenExpiry(session.access_token);
                if (expiry) {
                  AuthCache.set(user, expiry);
                }

                logger.debug('[AuthStore] Session sync successful (no prior cookies)');
                return;
              }
            } catch (syncError: any) {
              // CRITICAL FIX: Handle JWT claim validation errors
              const errorMessage = syncError?.message || syncError?.error?.message || '';

              if (errorMessage.includes('jwt_claim_invalid') ||
                errorMessage.includes('Invalid claim') ||
                errorMessage.includes('not allowed in JWT')) {
                logger.warn('[AuthStore] JWT claim validation failed, clearing invalid session:', errorMessage);

                // Clear the invalid session from Supabase
                try {
                  await supabase.auth.signOut();
                } catch {
                  // Silent fail
                }

                // Clear any cached auth
                AuthCache.clear();

                set({
                  user: null,
                  isAuthenticated: false,
                  isInitialized: true,
                });
                return;
              }

              logger.debug('[AuthStore] Session sync failed (silent):', syncError);
              // Fall through to guest state
            }

            set({
              user: null,
              isAuthenticated: false,
              isInitialized: true,
            });
            return;
          }

          // Process parallel backend result (if it was attempted)
          if (backendResult.status === 'fulfilled' && backendResult.value) {
            try {
              const data = backendResult.value.data;

              if (data.user) {
                // CRITICAL FIX: Update Supabase SDK with new tokens from backend
                // This prevents "Reuse Detection" lockout when the SDK tries to use an old refresh token
                if (data.tokens?.access_token && data.tokens?.refresh_token) {
                  await supabase.auth.setSession({
                    access_token: data.tokens.access_token,
                    refresh_token: data.tokens.refresh_token
                  });
                  logger.debug('[AuthStore] Supabase session synced with new tokens from backend refresh');
                }

                const user: User = {
                  id: data.user.id,
                  email: data.user.email || '',
                  name: data.user.name || '',
                  phone: data.user.phone || undefined,
                  role: data.user.role || 'customer',
                  emailVerified: data.user.emailVerified,
                  phoneVerified: data.user.phoneVerified || false,
                  mustChangePassword: data.user.mustChangePassword || false,
                  deletionStatus: data.user.deletionStatus,
                  scheduledDeletionAt: data.user.scheduledDeletionAt,

                  addresses: [],
                  language: data.user.language,
                };

                set({
                  user,
                  isAuthenticated: true,
                  isInitialized: true,
                  isReactivationRequired: data.user.deletionStatus === 'PENDING_DELETION',
                });

                // Cache the verified state with token expiry
                const expiry = getTokenExpiry(session?.access_token);
                if (expiry) {
                  AuthCache.set(user, expiry);
                }

                logger.debug(`[AuthStore] User initialized and verified with backend (Status: ${data.user.deletionStatus || 'ACTIVE'})`);
                return; // Success, exit early
              }
            } catch (parseError) {
              // Fall through to error handling
            }
          }

          // Backend verification failed - try fallback sync
          const verifyError: any = backendResult.status === 'rejected' ? backendResult.reason : null;
          if (verifyError) {
            // FALLBACK: If refresh fails with 401 (e.g. cookies missing) but we HAVE a session,
            // try to sync the session instead of giving up.
            if (verifyError.response?.status === 401 && session.access_token) {
              logger.info('[AuthStore] Backend verification failed (401), attempting silent session re-sync...');
              try {
                const userData = await syncSession(session.access_token, session.refresh_token || '', true);
                if (userData) {
                  const user: User = {
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
                  };

                  set({
                    user,
                    isAuthenticated: true,
                    isInitialized: true,
                    isReactivationRequired: userData.deletionStatus === 'PENDING_DELETION',
                  });

                  // Cache the re-synced state
                  const expiry = getTokenExpiry(session.access_token);
                  if (expiry) {
                    AuthCache.set(user, expiry);
                  }

                  logger.debug('[AuthStore] Session re-sync successful');
                  return; // Exit successful
                }
              } catch (syncError: any) {
                // CRITICAL FIX: Handle JWT claim validation errors in fallback sync too
                const errorMessage = syncError?.message || syncError?.error?.message || '';

                if (errorMessage.includes('jwt_claim_invalid') ||
                  errorMessage.includes('Invalid claim') ||
                  errorMessage.includes('not allowed in JWT')) {
                  logger.warn('[AuthStore] JWT claim validation failed in fallback sync, clearing invalid session:', errorMessage);

                  // Clear the invalid session
                  try {
                    await supabase.auth.signOut();
                  } catch {
                    // Silent fail
                  }

                  AuthCache.clear();

                  set({
                    user: null,
                    isAuthenticated: false,
                    isInitialized: true,
                  });
                  return;
                }

                logger.debug('[AuthStore] Session re-sync fallback failed (silent):', syncError);
              }
            }

            logger.warn('[AuthStore] Backend verification failed:', verifyError.response?.data?.error || verifyError.message);

            // If backend says 403/410, the session is definitively invalid or account is gone
            if ([403, 410].includes(verifyError.response?.status)) {
              await get().logout(); // Full cleanup for critical errors
            }

            set({
              user: null,
              isAuthenticated: false,
              isInitialized: true,
            });
          }
        } else {
          set({
            user: null,
            isAuthenticated: false,
            isInitialized: true,
          });
          logger.debug('[AuthStore] No valid session found (guest)');
        }
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
      const handleVisibilityChange = async () => {
        if (!document.hidden && get().isAuthenticated) {
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.access_token) {
              // Check if token is expired or close to expiry (60s buffer)
              if (isTokenExpired(session.access_token, 60000)) {
                logger.debug('[AuthStore] Token expired on tab focus, proactively refreshing...');
                const { data: { session: newSession }, error } = await supabase.auth.refreshSession();

                if (error) {
                  logger.warn('[AuthStore] Proactive refresh failed on visibility change:', error);
                  // Don't force logout - let the next API call handle it via interceptor
                } else if (newSession) {
                  logger.debug('[AuthStore] Proactive refresh successful on tab focus');
                  // Update auth cache with new session
                  const expiry = getTokenExpiry(newSession.access_token);
                  if (expiry && get().user) {
                    AuthCache.set(get().user!, expiry);
                  }
                }
              }
            }
          } catch (error) {
            logger.debug('[AuthStore] Visibility change token check failed (non-critical):', error);
          }
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);

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
                  // Update auth cache
                  const expiry = getTokenExpiry(newSession.access_token);
                  if (expiry && get().user) {
                    AuthCache.set(get().user!, expiry);
                  }
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
