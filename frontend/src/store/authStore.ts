import { logger } from "@/lib/logger";
import { create } from "zustand";
import type { User } from "@/types";
import { queryClient } from "@/lib/react-query";
import { apiClient, refreshAuthSession } from "@/lib/api-client";
import i18n from "@/i18n/config";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage, isNetworkError } from "@/lib/errorUtils";
import { clearGuestId } from "@/lib/guestId";
import {
  clearAuthSession,
  clearAuthUserSnapshot,
  getAuthSession,
  getAuthUserSnapshot,
  setAuthUserSnapshot
} from "@/lib/auth-session";
import { useCurrencyStore } from "@/store/currencyStore";

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

let sessionExpiredHandler: ((event: Event) => void) | null = null;
let authLifecycleCleanup: (() => void) | null = null;
let sessionRecoveryPromise: Promise<void> | null = null;
let authChannel: BroadcastChannel | null = null;
let lastRecoveryAttempt = 0;
let lastSessionNetworkFailureAt = 0;
const RECOVERY_COOLDOWN_MS = 2000;
const SESSION_NETWORK_FAILURE_COOLDOWN_MS = 15000;

const markSessionNetworkFailure = () => {
  lastSessionNetworkFailureAt = Date.now();
};

const clearSessionNetworkFailure = () => {
  lastSessionNetworkFailureAt = 0;
};

const hasRecentSessionNetworkFailure = () =>
  lastSessionNetworkFailureAt > 0 &&
  Date.now() - lastSessionNetworkFailureAt < SESSION_NETWORK_FAILURE_COOLDOWN_MS;

const getStoredLanguagePreference = (): string | null => {
  try {
    return localStorage.getItem("language");
  } catch {
    return null;
  }
};

const getStoredCurrencyPreference = (): string | null => {
  try {
    return localStorage.getItem("preferredCurrency");
  } catch {
    return null;
  }
};

const applyLanguagePreference = (user: User | null) => {
  const storedLanguage = getStoredLanguagePreference();
  if (storedLanguage && user) {
    user.language = storedLanguage;
  }

  if (storedLanguage) {
    if (i18n.language !== storedLanguage) {
      i18n.changeLanguage(storedLanguage);
    }
    return;
  }

  if (user?.language) {
    i18n.changeLanguage(user.language);
    localStorage.setItem("language", user.language);
  }
};

const broadcastAuthState = (user: User | null, isAuthenticated: boolean) => {
  if (authChannel) {
    authChannel.postMessage({ type: "AUTH_STATE_CHANGED", user, isAuthenticated });
  }
};

const applyCurrencyPreference = (user: User | null) => {
  const storedCurrency = getStoredCurrencyPreference();

  if (storedCurrency || !user?.preferredCurrency) {
    return;
  }

  localStorage.setItem("preferredCurrency", user.preferredCurrency);
};

const buildUserFromBackend = (userData: any): User => ({
  id: userData.id,
  email: userData.email || "",
  name: userData.name || "",
  phone: userData.phone || undefined,
  role: userData.role || "customer",
  emailVerified: userData.emailVerified,
  phoneVerified: userData.phoneVerified || false,
  mustChangePassword: userData.mustChangePassword || false,
  authProvider: userData.authProvider,
  deletionStatus: userData.deletionStatus,
  scheduledDeletionAt: userData.scheduledDeletionAt,
  addresses: [],
  image: userData.image || userData.avatarUrl || userData.avatar_url,
  firstName: userData.firstName || userData.first_name,
  lastName: userData.lastName || userData.last_name,
  language: userData.language,
  preferredCurrency: userData.preferredCurrency || userData.preferred_currency,
});

const refreshSession = async (silent = true): Promise<User | null> => {
  const response = await refreshAuthSession(silent, {
    reason: "initialize_auth",
    optionalUnauthenticated: true,
  });

  clearSessionNetworkFailure();

  return response.data?.user ? buildUserFromBackend(response.data.user) : null;
};

const isUnauthenticatedRefresh = (error: any): boolean => {
  const status = error?.response?.status;
  return status === 401 || status === 403 || status === 410;
};

const getBootstrapAuthState = () => {
  if (typeof window === "undefined") {
    return {
      user: null as User | null,
      isAuthenticated: false,
      isInitialized: false,
    };
  }

  const session = getAuthSession();
  const cachedUser = getAuthUserSnapshot();

  if (!session || !cachedUser) {
    return {
      user: null as User | null,
      isAuthenticated: false,
      isInitialized: false,
    };
  }

  applyLanguagePreference(cachedUser);
  applyCurrencyPreference(cachedUser);

  return {
    user: cachedUser,
    isAuthenticated: true,
    isInitialized: false,
  };
};

const bootstrapAuthState = getBootstrapAuthState();

export const useAuthStore = create<AuthState>((set, get) => ({
  user: bootstrapAuthState.user,
  isAuthenticated: bootstrapAuthState.isAuthenticated,
  isInitializing: false,
  isInitialized: bootstrapAuthState.isInitialized,
  isReactivationRequired: bootstrapAuthState.user?.deletionStatus === "PENDING_DELETION",

  setUser: (user) => {
    applyLanguagePreference(user);
    applyCurrencyPreference(user);
    setAuthUserSnapshot(user);
    set({
      user,
      isAuthenticated: !!user,
      isReactivationRequired: user?.deletionStatus === "PENDING_DELETION",
    });
  },

  setReactivationRequired: (required) => set({ isReactivationRequired: required }),

  login: (user) => {
    applyLanguagePreference(user);
    applyCurrencyPreference(user);
    setAuthUserSnapshot(user);
    set({
      user,
      isAuthenticated: true,
      isInitialized: true,
      isReactivationRequired: user.deletionStatus === "PENDING_DELETION",
    });

    // Proactively recover the session from cookies if the local state is missing it
    // but the user just logged in. This ensures consistent auth state for immediate requests.
    void refreshAuthSession(true, {
      reason: "post_login_session_recovery",
      optionalUnauthenticated: false,
    }).then((response) => {
      if (response.data?.user) {
        const recoveredUser = buildUserFromBackend(response.data.user);
        applyLanguagePreference(recoveredUser);
        applyCurrencyPreference(recoveredUser);
        setAuthUserSnapshot(recoveredUser);
        set({
          user: recoveredUser,
          isAuthenticated: true,
          isInitialized: true,
          isReactivationRequired: recoveredUser.deletionStatus === "PENDING_DELETION",
        });
        broadcastAuthState(recoveredUser, true);
      }
    }).catch((error) => {
      if (isNetworkError(error)) {
        markSessionNetworkFailure();
      }
      logger.warn("[AuthStore] Post-login session recovery failed", error);
    });
  },

  logout: async () => {
    clearAuthSession();
    clearAuthUserSnapshot();
    useCurrencyStore.getState().clearSessionCache();
    set({
      user: null,
      isAuthenticated: false,
      isReactivationRequired: false,
    });
    queryClient.clear();
    clearGuestId();

    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("auth:logout"));
      broadcastAuthState(null, false);
    }

    try {
      await apiClient.post("/auth/logout");
    } catch (err) {
      logger.warn("Backend logout error (potentially already logged out):", err);
    }
  },

  initializeAuth: async () => {
    if (get().isInitialized || get().isInitializing) return;

    set({ isInitializing: true });

    try {
      if (typeof window !== "undefined" && !authChannel) {
        authChannel = new BroadcastChannel("merigaumata_auth_v1");
        authChannel.onmessage = (event) => {
          if (event.data?.type === "AUTH_STATE_CHANGED") {
            const { user, isAuthenticated } = event.data;
            logger.debug("[AuthStore] Received cross-tab auth state update", { isAuthenticated });
            set({ user, isAuthenticated, isInitialized: true });
          }
        };
      }

      authLifecycleCleanup?.();
      authLifecycleCleanup = null;

      if (sessionExpiredHandler) {
        window.removeEventListener("auth:session-expired", sessionExpiredHandler);
      }

      sessionExpiredHandler = (event: Event) => {
        const customEvent = event as CustomEvent<{ message?: string; reason?: string }>;
        const errorMessage = customEvent.detail?.message;

        toast({
          title: i18n.t("common.error"),
          description: getErrorMessage(errorMessage || "auth.sessionExpiredToast", i18n.t.bind(i18n)),
          variant: "destructive",
        });

        const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = `/?auth=login&returnUrl=${returnUrl}`;
      };
      window.addEventListener("auth:session-expired", sessionExpiredHandler);

      try {
        const user = await refreshSession(true);
        if (user) {
          logger.info("[AuthStore] Session recovered during initialization", { userId: user.id, role: user.role });
          applyLanguagePreference(user);
          applyCurrencyPreference(user);
          setAuthUserSnapshot(user);
          set({
            user,
            isAuthenticated: true,
            isInitialized: true,
            isReactivationRequired: user.deletionStatus === "PENDING_DELETION",
          });
          broadcastAuthState(user, true);
        } else {
          logger.debug("[AuthStore] No session to recover during initialization");
          clearAuthUserSnapshot();
          set({ user: null, isAuthenticated: false, isInitialized: true });
        }
      } catch (backendError: any) {
        if (isNetworkError(backendError)) {
          markSessionNetworkFailure();
          logger.warn("[AuthStore] Initial session recovery skipped due to backend connectivity issue", backendError);
          set({ isInitialized: true });
          return;
        }

        if ([403, 410].includes(backendError?.response?.status)) {
          await get().logout();
        }

        if (isUnauthenticatedRefresh(backendError)) {
          clearAuthSession();
          clearAuthUserSnapshot();
          useCurrencyStore.getState().clearSessionCache();
          set({ user: null, isAuthenticated: false, isInitialized: true });
        } else {
          logger.warn("[AuthStore] Initial session recovery failed with non-terminal error", backendError);
          set({ user: null, isAuthenticated: false, isInitialized: true });
        }
      }

      const recoverSessionAfterResume = async (reason: string) => {
        const now = Date.now();
        if (now - lastRecoveryAttempt < RECOVERY_COOLDOWN_MS) {
          logger.debug(`[AuthStore] Session recovery (${reason}) skipped (cooldown active)`);
          return;
        }

        if (hasRecentSessionNetworkFailure()) {
          logger.debug(`[AuthStore] Session recovery (${reason}) skipped (backend retry cooldown active)`);
          return;
        }

        if (sessionRecoveryPromise) {
          await sessionRecoveryPromise;
          return;
        }

        lastRecoveryAttempt = now;
        sessionRecoveryPromise = (async () => {
          try {
            const state = get();
            const shouldRecover = state.isAuthenticated || !!state.user;
            if (!shouldRecover) return;

            const user = await refreshSession(true);
            if (user) {
              applyLanguagePreference(user);
              applyCurrencyPreference(user);
              setAuthUserSnapshot(user);
              set({
                user,
                isAuthenticated: true,
                isInitialized: true,
                isReactivationRequired: user.deletionStatus === "PENDING_DELETION",
              });
              broadcastAuthState(user, true);
            }
          } catch (error) {
            if (isNetworkError(error)) {
              markSessionNetworkFailure();
            }
            logger.debug(`[AuthStore] Session recovery (${reason}) failed (non-critical):`, error);
          } finally {
            sessionRecoveryPromise = null;
          }
        })();

        await sessionRecoveryPromise;
      };

      const handleVisibilityChange = async () => {
        if (!document.hidden) {
          await recoverSessionAfterResume("visibilitychange");
        }
      };

      const handleWindowFocus = async () => {
        await recoverSessionAfterResume("focus");
      };

      const handlePageShow = async () => {
        await recoverSessionAfterResume("pageshow");
      };

      const handleOnline = async () => {
        await recoverSessionAfterResume("online");
      };

      document.addEventListener("visibilitychange", handleVisibilityChange);
      window.addEventListener("focus", handleWindowFocus);
      window.addEventListener("pageshow", handlePageShow);
      window.addEventListener("online", handleOnline);

      const tokenMonitorInterval = window.setInterval(async () => {
        if (!document.hidden && get().isAuthenticated) {
          if (hasRecentSessionNetworkFailure()) {
            logger.debug("[AuthStore] Periodic auth refresh skipped (backend retry cooldown active)");
            return;
          }

          try {
            await refreshSession(true);
          } catch (error) {
            if (isNetworkError(error)) {
              markSessionNetworkFailure();
            }
            logger.debug("[AuthStore] Periodic auth refresh failed (non-critical):", error);
          }
        }
      }, 5 * 60 * 1000);

      authLifecycleCleanup = () => {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        window.removeEventListener("focus", handleWindowFocus);
        window.removeEventListener("pageshow", handlePageShow);
        window.removeEventListener("online", handleOnline);
        window.clearInterval(tokenMonitorInterval);
        
        if (authChannel) {
          authChannel.close();
          authChannel = null;
        }
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

    if (updates.preferredCurrency) {
      localStorage.setItem("preferredCurrency", updates.preferredCurrency);
    }

    const currentUser = get().user;
    const nextUser = currentUser ? { ...currentUser, ...updates } : null;
    setAuthUserSnapshot(nextUser);
    set({ user: nextUser });
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
