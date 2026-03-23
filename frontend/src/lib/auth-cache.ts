import type { User } from "@/types";
import { logger } from "@/lib/logger";

interface CachedAuthState {
    user: User | null;
    isAuthenticated: boolean;
    cachedAt: number;
    expiresAt: number;
}

const CACHE_KEY = 'auth_cache';

/**
 * Auth Cache Utility
 * Persists authentication state to localStorage for instant restoration on page load
 * This eliminates the 1-1.5s delay from re-verifying auth on every page refresh
 */
export const AuthCache = {
    /**
     * Store auth state in localStorage with expiry
     * @param user - User object or null
     * @param expiresAt - Unix timestamp when cache should expire
     */
    set(user: User | null, expiresAt: number): void {
        try {
            const cacheData: CachedAuthState = {
                user,
                isAuthenticated: !!user,
                cachedAt: Date.now(),
                expiresAt,
            };
            localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
        } catch (error) {
            // Silent fail - localStorage might be disabled or full
            logger.warn('Failed to cache auth state', { module: 'AuthCache', err: error });
        }
    },

    /**
     * Retrieve cached auth state if valid
     * @returns Cached auth state or null if expired/invalid
     */
    get(): CachedAuthState | null {
        try {
            const cached = localStorage.getItem(CACHE_KEY);
            if (!cached) return null;

            const data: CachedAuthState = JSON.parse(cached);

            // Check if cache has expired
            if (data.expiresAt && data.expiresAt < Date.now()) {
                // logger.debug('[AuthCache] Cache expired, clearing...');
                this.clear();
                return null;
            }

            // Additional validation: ensure cache is less than 24 hours old (safety check)
            const maxAge = 24 * 60 * 60 * 1000; // 24 hours
            if (Date.now() - data.cachedAt > maxAge) {
                // logger.debug('[AuthCache] Cache too old (>24h), clearing...');
                this.clear();
                return null;
            }

            return data;
        } catch (error) {
            logger.warn('Failed to read auth cache', { module: 'AuthCache', err: error });
            this.clear();
            return null;
        }
    },

    /**
     * Clear cached auth state
     */
    clear(): void {
        try {
            localStorage.removeItem(CACHE_KEY);
        } catch (error) {
            // Silent fail
        }
    },

    /**
     * Check if valid cache exists (without retrieving it)
     */
    exists(): boolean {
        return this.get() !== null;
    },
};

/**
 * Extract token expiry from JWT access token
 * @param token - JWT access token
 * @returns Unix timestamp (ms) when token expires, or null if invalid
 */
export const getTokenExpiry = (token: string | undefined): number | null => {
    if (!token) return null;

    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        // Convert from seconds to milliseconds and subtract 30s buffer for clock skew
        return (payload.exp * 1000) - 30000;
    } catch {
        return null;
    }
};
