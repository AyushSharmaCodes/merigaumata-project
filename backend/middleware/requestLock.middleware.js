/**
 * Request Lock Middleware
 * 
 * Prevents concurrent duplicate operations by the same user across devices/tabs.
 * Uses an abstract lock store (currently in-memory, upgradeable to Redis) with TTL.
 * 
 * Usage: Apply to routes that should not be executed concurrently by the same user.
 * 
 * Example:
 *   router.post('/checkout', requestLock('checkout'), (req, res) => { ... });
 */

const logger = require('../utils/logger');
const MemoryStore = require('../lib/store/memory.store');

// Init Store (Adapter Pattern)
const lockStore = new MemoryStore();
const LOCK_TTL_MS = 30000; // 30 seconds

/**
 * Generate lock key from user ID and operation
 */
function generateLockKey(userId, operation) {
    return `${userId}:${operation}`;
}

/**
 * Acquire a lock for the given key
 * @returns {Promise<boolean>} true if lock acquired, false if already locked
 */
async function acquireLock(lockKey, correlationId) {
    const existingLock = await lockStore.get(lockKey);

    // If lock exists (and presumably valid due to Store TTL), block
    if (existingLock) {
        return false;
    }

    // Acquire lock with TTL
    await lockStore.set(lockKey, {
        timestamp: Date.now(),
        correlationId
    }, LOCK_TTL_MS);

    return true;
}

/**
 * Release a lock
 */
async function releaseLock(lockKey, correlationId) {
    const lock = await lockStore.get(lockKey);

    // Only release if the lock belongs to this request
    if (lock && lock.correlationId === correlationId) {
        await lockStore.delete(lockKey);
        return true;
    }

    return false;
}

/**
 * Request Lock Middleware Factory
 * 
 * @param {string} operation - The operation name for the lock key
 * @returns {Function} Express middleware
 */
function requestLock(operation) {
    return async (req, res, next) => {
        // Get user ID from authenticated request
        const userId = req.user?.id || req.headers['x-user-id'];

        if (!userId) {
            // If no user ID, skip locking (let auth middleware handle it)
            return next();
        }

        const correlationId = req.headers['x-correlation-id'] || req.id || 'unknown';

        // Determine operation name (static string or dynamic function)
        let operationName = operation;
        if (typeof operation === 'function') {
            try {
                operationName = operation(req);
            } catch (err) {
                logger.error({ err, userId }, 'Failed to generate dynamic lock key');
                return next(err);
            }
        }

        const lockKey = generateLockKey(userId, operationName);

        // Try to acquire lock
        const acquired = await acquireLock(lockKey, correlationId);

        if (!acquired) {
            const existingLock = await lockStore.get(lockKey);
            logger.warn({
                userId,
                operation: operationName,
                correlationId,
                existingCorrelationId: existingLock?.correlationId
            }, 'Request blocked - concurrent operation in progress');

            return res.status(409).json({
                error: 'A similar operation is already in progress. Please wait for it to complete.',
                code: 'CONCURRENT_REQUEST_BLOCKED',
                retryAfter: Math.ceil(LOCK_TTL_MS / 1000)
            });
        }

        logger.debug({ userId, operation: operationName, correlationId }, 'Request lock acquired');

        // Store lock info for cleanup on response
        req._lockKey = lockKey;
        req._lockCorrelationId = correlationId;

        // Release lock on response finish (success or error)
        const cleanup = async () => {
            if (req._lockKey) {
                await releaseLock(req._lockKey, req._lockCorrelationId);
                logger.debug({ userId, operation: operationName }, 'Request lock released');
            }
        };

        res.on('finish', cleanup);
        res.on('close', cleanup);

        next();
    };
}

/**
 * Get current lock status (for debugging/monitoring)
 * Note: MemoryStore doesn't expose iteration, so this is limited.
 */
function getLockStatus() {
    // With generic store adapter, full listing might not be available efficiently.
    // Returning stub or summary stats if abstraction allows.
    // For MemoryStore, we technically have access to .store property if we break encapsulation,
    // but for "Cloud Ready" compliance, we should assume we can't iterate.
    return { message: "Lock inspection not supported by storage adapter" };
}

module.exports = {
    requestLock,
    getLockStatus,
    // Exposed for testing
    _acquireLock: acquireLock,
    _releaseLock: releaseLock,
    _lockStore: lockStore
};
