// Helper utilities for managing authentication sessions
// Note: While the application is moving towards HttpOnly cookies, 
// these helpers manage the transition by storing local flags for synchronization.
import type { User } from "@/types";

export interface AuthSessionSnapshot {
    accessToken?: string;
    refreshToken?: string;
}

const SESSION_KEY = "merigaumata_session_v1";
const USER_SNAPSHOT_KEY = "merigaumata_user_snapshot_v1";

/**
 * Persists the authentication session tokens
 * In "Hardened" (HttpOnly) mode, this primarily serves as a "Logged In" flag
 * and a way to sync state across tabs.
 */
export const setAuthSession = (tokens: AuthSessionSnapshot) => {
    if (!tokens) return;
    
    try {
        // We only store tokens in localStorage if they are explicitly provided.
        // In full HttpOnly mode, tokens might be undefined and handled by Cookies instead.
        localStorage.setItem(SESSION_KEY, JSON.stringify({
            ...tokens,
            timestamp: Date.now()
        }));
        
        // Dispatch event for cross-tab sync if needed (authStore handles this via BroadcastChannel usually)
        window.dispatchEvent(new Event("auth:session-updated"));
    } catch (e) {
        console.error("Failed to set auth session", e);
    }
};

/**
 * Retrieves the current session snapshot
 */
export const getAuthSession = (): AuthSessionSnapshot | null => {
    try {
        const data = localStorage.getItem(SESSION_KEY);
        if (!data) return null;
        return JSON.parse(data) as AuthSessionSnapshot;
    } catch {
        return null;
    }
};

/**
 * Clears the session snapshot
 */
export const clearAuthSession = () => {
    localStorage.removeItem(SESSION_KEY);
    window.dispatchEvent(new Event("auth:session-cleared"));
};

/**
 * Persists the last known authenticated user to enable fast client-side hydration
 * while the backend session refresh is still in flight.
 */
export const setAuthUserSnapshot = (user: User | null) => {
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
        console.error("Failed to set auth user snapshot", e);
    }
};

/**
 * Retrieves the last known authenticated user snapshot.
 */
export const getAuthUserSnapshot = (): User | null => {
    try {
        const data = localStorage.getItem(USER_SNAPSHOT_KEY);
        if (!data) return null;

        const parsed = JSON.parse(data) as { user?: User };
        return parsed?.user || null;
    } catch {
        return null;
    }
};

/**
 * Clears the stored user snapshot.
 */
export const clearAuthUserSnapshot = () => {
    localStorage.removeItem(USER_SNAPSHOT_KEY);
};
