/**
 * TTL Cache — Lightweight in-memory cache with per-key TTL
 * 
 * Zero dependencies. Used for payment status polling to reduce DB load.
 * Terminal statuses (SUCCESS, FAILED, EXPIRED, REFUNDED) are cached with long TTL.
 * Non-terminal statuses use short TTL to ensure freshness.
 * 
 * NOT suitable for distributed caching — single-instance only.
 * For multi-instance, add Redis layer.
 */

class TTLCache {
    /**
     * @param {number} defaultTtlMs - Default TTL in milliseconds
     * @param {number} maxSize - Maximum cache entries (LRU eviction when exceeded)
     */
    constructor(defaultTtlMs = 5000, maxSize = 10000) {
        this._cache = new Map();
        this._defaultTtlMs = defaultTtlMs;
        this._maxSize = maxSize;
        this._hits = 0;
        this._misses = 0;
    }

    /**
     * Get a cached value. Returns undefined if expired or missing.
     * @param {string} key
     * @returns {*} Cached value or undefined
     */
    get(key) {
        const entry = this._cache.get(key);
        if (!entry) {
            this._misses++;
            return undefined;
        }

        if (Date.now() > entry.expiresAt) {
            this._cache.delete(key);
            this._misses++;
            return undefined;
        }

        this._hits++;
        return entry.value;
    }

    /**
     * Set a cached value with optional custom TTL.
     * @param {string} key
     * @param {*} value
     * @param {number} [ttlMs] - Override default TTL for this entry
     */
    set(key, value, ttlMs) {
        // LRU eviction: delete oldest entries when at capacity
        if (this._cache.size >= this._maxSize && !this._cache.has(key)) {
            const oldestKey = this._cache.keys().next().value;
            this._cache.delete(oldestKey);
        }

        // Move to end (most recently used) by deleting and re-inserting
        this._cache.delete(key);
        this._cache.set(key, {
            value,
            expiresAt: Date.now() + (ttlMs || this._defaultTtlMs)
        });
    }

    /**
     * Delete a specific key.
     * @param {string} key
     */
    delete(key) {
        this._cache.delete(key);
    }

    /**
     * Clear all cached entries.
     */
    clear() {
        this._cache.clear();
        this._hits = 0;
        this._misses = 0;
    }

    /**
     * Get cache statistics for monitoring.
     */
    stats() {
        const total = this._hits + this._misses;
        return {
            size: this._cache.size,
            maxSize: this._maxSize,
            hits: this._hits,
            misses: this._misses,
            hitRate: total > 0 ? (this._hits / total * 100).toFixed(1) + '%' : '0%'
        };
    }
}

module.exports = TTLCache;
