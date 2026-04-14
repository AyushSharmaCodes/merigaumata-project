// Helper utilities for managing authentication sessions
// Note: While the application is moving towards HttpOnly cookies, 
// these helpers manage the transition by storing local flags for synchronization.

export interface AuthSessionSnapshot {
    accessToken?: string;
    refreshToken?: string;
}

const SESSION_KEY = "merigaumata_session_v1";

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
