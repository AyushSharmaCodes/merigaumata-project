const logger = require('../../utils/logger');

/**
 * Redis Key-Value Store with TTL
 * Acts as a reference implementation for the Storage Interface.
 * 
 * Interface:
 * - set(key, value, ttlMs): Promise<void>
 * - get(key): Promise<any | null>
 * - delete(key): Promise<void>
 */
class RedisStore {
    constructor() {
        try {
            const Redis = require('ioredis');
            const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
            this.client = new Redis(redisUrl, {
                maxRetriesPerRequest: 3,
                retryStrategy(times) {
                    const delay = Math.min(times * 50, 2000);
                    return delay;
                }
            });
            
            this.client.on('error', (err) => {
                logger.error({ err }, '[RedisStore] Redis connection error');
            });
            
            this.client.on('connect', () => {
                logger.info('[RedisStore] Connected to Redis');
            });
            
        } catch (error) {
            logger.error({ err: error }, '[RedisStore] Failed to initialize Redis client. Ensure ioredis is installed.');
            throw error;
        }
    }

    async set(key, value, ttlMs) {
        try {
            const stringValue = JSON.stringify(value);
            if (ttlMs && ttlMs > 0) {
                // Redis uses seconds or milliseconds. psetex uses milliseconds.
                await this.client.psetex(key, ttlMs, stringValue);
            } else {
                await this.client.set(key, stringValue);
            }
        } catch (error) {
            logger.error({ err: error, key }, '[RedisStore] Failed to set key');
        }
    }

    async get(key) {
        try {
            const result = await this.client.get(key);
            if (!result) return null;
            return JSON.parse(result);
        } catch (error) {
            logger.error({ err: error, key }, '[RedisStore] Failed to get key');
            return null;
        }
    }

    async delete(key) {
        try {
            await this.client.del(key);
        } catch (error) {
            logger.error({ err: error, key }, '[RedisStore] Failed to delete key');
        }
    }
}

module.exports = RedisStore;
