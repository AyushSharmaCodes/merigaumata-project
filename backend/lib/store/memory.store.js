/**
 * In-Memory Key-Value Store with TTL
 * Acts as a reference implementation for the Storage Interface.
 * 
 * Interface:
 * - set(key, value, ttlMs): Promise<void>
 * - get(key): Promise<any | null>
 * - delete(key): Promise<void>
 */
class MemoryStore {
    constructor() {
        this.store = new Map();
        this.timers = new Map();
    }

    async set(key, value, ttlMs) {
        // Clear existing timer if any
        if (this.timers.has(key)) {
            clearTimeout(this.timers.get(key));
            this.timers.delete(key);
        }

        this.store.set(key, value);

        if (ttlMs && ttlMs > 0) {
            const timer = setTimeout(() => {
                this.store.delete(key);
                this.timers.delete(key);
            }, ttlMs);

            // Unref to avoid holding process open (optional, but good for libs)
            if (timer.unref) timer.unref();

            this.timers.set(key, timer);
        }
    }

    async get(key) {
        return this.store.get(key) || null;
    }

    async delete(key) {
        if (this.timers.has(key)) {
            clearTimeout(this.timers.get(key));
            this.timers.delete(key);
        }
        this.store.delete(key);
    }
}

module.exports = MemoryStore;
