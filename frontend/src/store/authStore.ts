import { logger } from "@/lib/logger";
import { create } from "zustand";
import type { User } from "@/types";
import { queryClient } from "@/lib/react-query";
import { apiClient, refreshAuthSession } from "@/lib/api-client";
import i18n from "@/i18n/config";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errorUtils";
import { clearGuestId } from "@/lib/guestId";

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
const RECOVERY_COOLDOWN_MS = 2000;

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

  return response.data?.user ? buildUserFromBackend(response.data.user) : null;
};

const isUnauthenticatedRefresh = (error: any): boolean => {
  const status = error?.response?.status;
  return status === 401 || status === 403 || status === 410;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isInitializing: false,
  isInitialized: false,
  isReactivationRequired: false,

  setUser: (user) => {
    applyLanguagePreference(user);
    applyCurrencyPreference(user);
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
        set({
          user: recoveredUser,
          isAuthenticated: true,
          isInitialized: true,
          isReactivationRequired: recoveredUser.deletionStatus === "PENDING_DELETION",
        });
        broadcastAuthState(recoveredUser, true);
      }
    }).catch((error) => {
      logger.warn("[AuthStore] Post-login session recovery failed", error);
    });
  },

  logout: async () => {
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

        toast.error(getErrorMessage(errorMessage || "auth.sessionExpiredToast", i18n.t.bind(i18n)), {
          duration: 5000,
          position: "top-center",
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
          set({
            user,
            isAuthenticated: true,
            isInitialized: true,
            isReactivationRequired: user.deletionStatus === "PENDING_DELETION",
          });
          broadcastAuthState(user, true);
        } else {
          logger.debug("[AuthStore] No session to recover during initialization");
          set({ user: null, isAuthenticated: false, isInitialized: true });
        }
      } catch (backendError: any) {

        if ([403, 410].includes(backendError?.response?.status)) {
          await get().logout();
        }

        if (isUnauthenticatedRefresh(backendError)) {
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
              set({
                user,
                isAuthenticated: true,
                isInitialized: true,
                isReactivationRequired: user.deletionStatus === "PENDING_DELETION",
              });
              broadcastAuthState(user, true);
            }
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
          try {
            await refreshSession(true);
          } catch (error) {
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
