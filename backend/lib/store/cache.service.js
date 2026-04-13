const MemoryStore = require('./memory.store');
const RedisStore = require('./redis.store');
const logger = require('../../utils/logger');

class CacheService {
    static instance = null;

    static getInstance() {
        if (!CacheService.instance) {
            const useRedis = process.env.CACHE_PROVIDER === 'redis';
            
            if (useRedis) {
                try {
                    CacheService.instance = new RedisStore();
                    logger.info('[CacheService] Initialized Redis cache strategy');
                } catch (error) {
                    logger.warn({ err: error }, '[CacheService] Redis initialization failed, falling back to MemoryStore');
                    CacheService.instance = new MemoryStore();
                }
            } else {
                CacheService.instance = new MemoryStore();
                logger.info('[CacheService] Initialized MemoryStore cache strategy');
            }
        }
        
        return CacheService.instance;
    }
}

module.exports = CacheService;
