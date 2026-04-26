import type { User } from "../model/auth.types";
import { logger } from "@/core/observability/logger";

export interface AuthSessionSnapshot {
    accessToken?: string;
    refreshToken?: string;
}

const SESSION_KEY = "merigaumata_session_v1";
const USER_SNAPSHOT_KEY = "merigaumata_user_snapshot_v1";

export const authSessionService = {
    setSession: (tokens: AuthSessionSnapshot) => {
        if (!tokens) return;
        try {
            localStorage.setItem(SESSION_KEY, JSON.stringify({
                ...tokens,
                timestamp: Date.now()
            }));
            window.dispatchEvent(new Event("auth:session-updated"));
        } catch (e) {
            logger.error("Failed to set auth session", e);
        }
    },

    getSession: (): AuthSessionSnapshot | null => {
        try {
            const data = localStorage.getItem(SESSION_KEY);
            if (!data) return null;
            return JSON.parse(data) as AuthSessionSnapshot;
        } catch {
            return null;
        }
    },

    clearSession: () => {
        localStorage.removeItem(SESSION_KEY);
        window.dispatchEvent(new Event("auth:session-cleared"));
    },

    setUserSnapshot: (user: User | null) => {
        try {
            if (!user) {
                localStorage.removeItem(USER_SNAPSHOT_KEY);
                return;
            }
            localStorage.setItem(USER_SNAPSHOT_KEY, JSON.stringify({
                user,
                timestamp: Date.now()
            }));
        } catch (e) {
            logger.error("Failed to set auth user snapshot", e);
        }
    },

    getUserSnapshot: (): User | null => {
        try {
            const data = localStorage.getItem(USER_SNAPSHOT_KEY);
            if (!data) return null;
            const parsed = JSON.parse(data) as { user?: User };
            return parsed?.user || null;
        } catch {
            return null;
        }
    },

    clearUserSnapshot: () => {
        localStorage.removeItem(USER_SNAPSHOT_KEY);
    },

    /**
     * Logic to reset everything on logout
     */
    logoutCleanup: () => {
        authSessionService.clearSession();
        authSessionService.clearUserSnapshot();
        // Dispatch global logout event for other domains/stores to react
        window.dispatchEvent(new Event("auth:logout"));
    }
};

export const setAuthSession = authSessionService.setSession;
export const getAuthSession = authSessionService.getSession;
export const clearAuthSession = authSessionService.clearSession;
export const setAuthUserSnapshot = authSessionService.setUserSnapshot;
export const getAuthUserSnapshot = authSessionService.getUserSnapshot;
export const clearAuthUserSnapshot = authSessionService.clearUserSnapshot;
