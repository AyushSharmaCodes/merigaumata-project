import { logger } from "@/core/observability/logger";
import { create } from "zustand";
import { queryClient } from "@/core/query/react-query";
import i18n from "@/app/i18n/config";
import { toast } from "@/shared/hooks/use-toast";
import { getErrorMessage, isNetworkError } from "@/core/utils/errorUtils";
import { clearGuestId } from "@/shared/lib/guest-id";

// Domain Imports
import { User } from "../model/auth.types";
import { authService } from "../services/auth.service";
import { authSessionService } from "../services/auth-session.service";

// Cross-Domain / App Imports
import { useCurrencyStore } from "@/core/store/currency.store";

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

const hasRecentSessionNetworkFailure = () =>
  lastSessionNetworkFailureAt > 0 &&
  Date.now() - lastSessionNetworkFailureAt < SESSION_NETWORK_FAILURE_COOLDOWN_MS;

const getStoredPreference = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const applyUserPreferences = (user: User | null) => {
  if (!user) return;
  
  const storedLanguage = getStoredPreference("language");
  if (storedLanguage) {
    user.language = storedLanguage;
    if (i18n.language !== storedLanguage) {
      i18n.changeLanguage(storedLanguage);
    }
  } else if (user.language) {
    i18n.changeLanguage(user.language);
    localStorage.setItem("language", user.language);
  }

  const storedCurrency = getStoredPreference("preferredCurrency");
  if (!storedCurrency && user.preferredCurrency) {
    localStorage.setItem("preferredCurrency", user.preferredCurrency);
  }
};

const broadcastAuthState = (user: User | null, isAuthenticated: boolean) => {
  if (authChannel) {
    authChannel.postMessage({ type: "AUTH_STATE_CHANGED", user, isAuthenticated });
  }
};

const getBootstrapAuthState = () => {
  if (typeof window === "undefined") {
    return { user: null, isAuthenticated: false, isInitialized: false };
  }

  const session = authSessionService.getSession();
  const cachedUser = authSessionService.getUserSnapshot();

  if (!session || !cachedUser) {
    return { user: null, isAuthenticated: false, isInitialized: false };
  }

  applyUserPreferences(cachedUser);

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
    applyUserPreferences(user);
    authSessionService.setUserSnapshot(user);
    set({
      user,
      isAuthenticated: !!user,
      isReactivationRequired: user?.deletionStatus === "PENDING_DELETION",
    });
  },

  setReactivationRequired: (required) => set({ isReactivationRequired: required }),

  login: (user) => {
    applyUserPreferences(user);
    authSessionService.setUserSnapshot(user);
    set({
      user,
      isAuthenticated: true,
      isInitialized: true,
      isReactivationRequired: user.deletionStatus === "PENDING_DELETION",
    });

    // Proactively recover the session
    authService.refreshSession(true).then((recoveredUser) => {
      if (recoveredUser) {
        applyUserPreferences(recoveredUser);
        authSessionService.setUserSnapshot(recoveredUser);
        set({
          user: recoveredUser,
          isAuthenticated: true,
          isInitialized: true,
          isReactivationRequired: recoveredUser.deletionStatus === "PENDING_DELETION",
        });
        broadcastAuthState(recoveredUser, true);
      }
    }).catch((error) => {
      if (isNetworkError(error)) markSessionNetworkFailure();
      logger.warn("[AuthStore] Post-login session recovery failed", error);
    });
  },

  logout: async () => {
    authSessionService.logoutCleanup();
    useCurrencyStore.getState().clearSessionCache();
    set({ user: null, isAuthenticated: false, isReactivationRequired: false });
    queryClient.clear();
    clearGuestId();
    broadcastAuthState(null, false);
    await authService.logout();
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
        const user = await authService.refreshSession(true);
        if (user) {
          applyUserPreferences(user);
          authSessionService.setUserSnapshot(user);
          set({
            user,
            isAuthenticated: true,
            isInitialized: true,
            isReactivationRequired: user.deletionStatus === "PENDING_DELETION",
          });
          broadcastAuthState(user, true);
        } else {
          authSessionService.clearUserSnapshot();
          set({ user: null, isAuthenticated: false, isInitialized: true });
        }
      } catch (backendError: any) {
        if (isNetworkError(backendError)) {
          markSessionNetworkFailure();
          set({ isInitialized: true });
          return;
        }
        set({ user: null, isAuthenticated: false, isInitialized: true });
      }

      const recoverSessionAfterResume = async (reason: string) => {
        const now = Date.now();
        if (now - lastRecoveryAttempt < RECOVERY_COOLDOWN_MS || hasRecentSessionNetworkFailure()) return;
        if (sessionRecoveryPromise) {
          await sessionRecoveryPromise;
          return;
        }
        lastRecoveryAttempt = now;
        sessionRecoveryPromise = (async () => {
          try {
            if (!get().isAuthenticated && !get().user) return;
            const user = await authService.refreshSession(true);
            if (user) {
              applyUserPreferences(user);
              authSessionService.setUserSnapshot(user);
              set({
                user,
                isAuthenticated: true,
                isInitialized: true,
                isReactivationRequired: user.deletionStatus === "PENDING_DELETION",
              });
              broadcastAuthState(user, true);
            }
          } catch (error) {
            if (isNetworkError(error)) markSessionNetworkFailure();
            logger.debug(`[AuthStore] Session recovery (${reason}) failed:`, error);
          } finally {
            sessionRecoveryPromise = null;
          }
        })();
        await sessionRecoveryPromise;
      };

      const handleResume = () => recoverSessionAfterResume("resume");
      document.addEventListener("visibilitychange", handleResume);
      window.addEventListener("focus", handleResume);
      window.addEventListener("pageshow", handleResume);
      window.addEventListener("online", handleResume);

      const tokenMonitorInterval = window.setInterval(async () => {
        if (!document.hidden && get().isAuthenticated && !hasRecentSessionNetworkFailure()) {
          try {
            await authService.refreshSession(true);
          } catch (error) {
            if (isNetworkError(error)) markSessionNetworkFailure();
          }
        }
      }, 5 * 60 * 1000);

      authLifecycleCleanup = () => {
        document.removeEventListener("visibilitychange", handleResume);
        window.removeEventListener("focus", handleResume);
        window.removeEventListener("pageshow", handleResume);
        window.removeEventListener("online", handleResume);
        window.clearInterval(tokenMonitorInterval);
        if (authChannel) {
          authChannel.close();
          authChannel = null;
        }
      };
    } catch (error) {
      logger.error("Initialize auth error:", error);
      set({ user: null, isAuthenticated: false, isInitialized: true });
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
    const nextUser = get().user ? { ...get().user!, ...updates } : null;
    authSessionService.setUserSnapshot(nextUser);
    set({ user: nextUser });
  },

  isAdmin: () => get().isAuthenticated && get().user?.role === "admin",
  isCustomer: () => get().isAuthenticated && get().user?.role === "customer",
}));
