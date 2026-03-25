import { logger } from "@/lib/logger";
/**
 * Client-side Cache Helper
 * Provides localStorage/sessionStorage caching with TTL expiration
 */

interface CacheEntry<T> {
    data: T;
    timestamp: number;
    ttl: number;
}

interface CacheOptions {
    /** Time-to-live in milliseconds (default: 1 hour) */
    ttl?: number;
    /** Use sessionStorage instead of localStorage (default: true) */
    useSessionStorage?: boolean;
}

class CacheHelper {
    private static readonly DEFAULT_TTL = 60 * 60 * 1000; // 1 hour

    private static getStorage(useSessionStorage = true): Storage | null {
        if (typeof window === "undefined") {
            return null;
        }

        return useSessionStorage ? window.sessionStorage : window.localStorage;
    }

    /**
     * Get data from cache
     * @returns Cached data if valid, null if expired or not found
     */
    static get<T>(key: string, useSessionStorage = true): T | null {
        try {
            const storage = this.getStorage(useSessionStorage);
            if (!storage) {
                return null;
            }
            const item = storage.getItem(key);

            if (!item) {
                return null;
            }

            const entry: CacheEntry<T> = JSON.parse(item);
            const now = Date.now();

            // Check if expired
            if (now - entry.timestamp > entry.ttl) {
                // logger.debug(`[Cache] EXPIRED: ${key}`);
                storage.removeItem(key);
                return null;
            }

            // logger.debug(`[Cache] HIT: ${key}`);
            return entry.data;
        } catch (error) {
            logger.error(`Cache read error for ${key}`, { module: 'CacheHelper', err: error });
            return null;
        }
    }

    /**
     * Set data in cache with TTL
     */
    static set<T>(key: string, data: T, options: CacheOptions = {}): void {
        try {
            const { ttl = this.DEFAULT_TTL, useSessionStorage = true } = options;

            const entry: CacheEntry<T> = {
                data,
                timestamp: Date.now(),
                ttl,
            };

            const storage = this.getStorage(useSessionStorage);
            if (!storage) {
                return;
            }
            storage.setItem(key, JSON.stringify(entry));
            // logger.debug(`[Cache] SET: ${key} (TTL: ${ttl}ms)`);
        } catch (error) {
            logger.error(`Cache write error for ${key}`, { module: 'CacheHelper', err: error });
        }
    }

    /**
     * Remove specific cache entry
     */
    static remove(key: string, useSessionStorage = true): void {
        try {
            const storage = this.getStorage(useSessionStorage);
            if (!storage) {
                return;
            }
            storage.removeItem(key);
            // logger.debug(`[Cache] REMOVED: ${key}`);
        } catch (error) {
            logger.error(`Cache removal error for ${key}`, { module: 'CacheHelper', err: error });
        }
    }

    /**
     * Clear all cache entries matching a prefix
     */
    static clearByPrefix(prefix: string, useSessionStorage = true): void {
        try {
            const storage = this.getStorage(useSessionStorage);
            if (!storage) {
                return;
            }
            const keysToRemove: string[] = [];

            for (let i = 0; i < storage.length; i++) {
                const key = storage.key(i);
                if (key && key.startsWith(prefix)) {
                    keysToRemove.push(key);
                }
            }

            keysToRemove.forEach(key => storage.removeItem(key));
            // logger.debug(`[Cache] CLEARED ${keysToRemove.length} entries with prefix: ${prefix}`);
        } catch (error) {
            logger.error(`Cache clear by prefix error for ${prefix}`, { module: 'CacheHelper', err: error });
        }
    }

    /**
     * Clear all cache entries
     */
    static clearAll(useSessionStorage = true): void {
        try {
            const storage = this.getStorage(useSessionStorage);
            if (!storage) {
                return;
            }
            storage.clear();
            // logger.debug('[Cache] CLEARED ALL');
        } catch (error) {
            logger.error('Cache clear all error', { module: 'CacheHelper', err: error });
        }
    }

    /**
     * Get or fetch data with cache
     * @param key Cache key
     * @param fetchFn Function to fetch data if cache miss
     * @param options Cache options
     * @returns Cached or freshly fetched data
     */
    static async getOrFetch<T>(
        key: string,
        fetchFn: () => Promise<T>,
        options: CacheOptions = {}
    ): Promise<T> {
        // Try cache first
        const cached = this.get<T>(key, options.useSessionStorage);
        if (cached !== null) {
            return cached;
        }

        // Cache miss - fetch fresh data
        // logger.debug(`[Cache] MISS: ${key} - fetching fresh data`);
        const data = await fetchFn();

        // Store in cache
        this.set(key, data, options);

        return data;
    }

    /**
     * Clear only expired cache entries
     */
    static clearExpired(useSessionStorage = true): void {
        try {
            const storage = this.getStorage(useSessionStorage);
            if (!storage) {
                return;
            }
            const keysToRemove: string[] = [];
            const now = Date.now();

            for (let i = 0; i < storage.length; i++) {
                const key = storage.key(i);
                if (key) {
                    try {
                        const item = storage.getItem(key);
                        if (item) {
                            const entry: CacheEntry<any> = JSON.parse(item);
                            // Check if it looks like a cache entry and is expired
                            if (entry.timestamp && entry.ttl && (now - entry.timestamp > entry.ttl)) {
                                keysToRemove.push(key);
                            }
                        }
                    } catch {
                        // Not a cache entry, skip
                    }
                }
            }

            keysToRemove.forEach(key => storage.removeItem(key));
            if (keysToRemove.length > 0) {
                // logger.debug(`[Cache] Cleared ${keysToRemove.length} expired entries`);
            }
        } catch (error) {
            logger.error('Cache clear expired error', { module: 'CacheHelper', err: error });
        }
    }

    /**
     * Initialize cache cleanup on page load
     * Clears all cached data when page is hard-reloaded (F5, Ctrl+R)
     * to ensure fresh data after explicit user reload
     */
    static initPageReloadHandler(clearOnReload = true): void {
        if (typeof window === 'undefined') return;

        // Detect page reload (vs SPA navigation)
        const navigationEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
        const isReload = navigationEntries.length > 0 && navigationEntries[0].type === 'reload';

        if (isReload && clearOnReload) {
            // logger.debug('[Cache] Page reload detected - clearing cache for fresh data');
            // Clear application cache from both session and local storage.
            this.remove('active_coupons');
            this.remove('user_addresses');
            this.remove('active_coupons', false);
            this.remove('user_addresses', false);
        } else {
            // On normal page load, just clear expired entries from both stores.
            this.clearExpired();
            this.clearExpired(false);
        }
    }
}

export default CacheHelper;
