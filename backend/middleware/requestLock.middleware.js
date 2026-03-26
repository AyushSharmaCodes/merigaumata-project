/**
 * Request Lock Middleware
 * 
 * Prevents concurrent duplicate operations by the same user across devices/tabs.
 * Uses a DB-backed lock store so protection survives restarts and works across
 * multiple backend instances.
 * 
 * Usage: Apply to routes that should not be executed concurrently by the same user.
 * 
 * Example:
 *   router.post('/checkout', requestLock('checkout'), (req, res) => { ... });
 */

const logger = require('../utils/logger');
const {
    getRequestLock,
    acquireRequestLock: createRequestLock,
    releaseRequestLock: deleteRequestLock,
    deleteExpiredRequestLock
} = require('../lib/store/request-state.store');
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
async function acquireLock(lockKey, userId, operation, correlationId) {
    try {
        await deleteExpiredRequestLock(lockKey);

        const lock = await createRequestLock({
            lockKey,
            userId,
            operation,
            correlationId,
            expiresAt: Date.now() + LOCK_TTL_MS
        });

        return lock ? true : false;
    } catch (error) {
        logger.warn({ err: error, lockKey, userId, operation }, 'Request lock store unavailable, allowing request without lock');
        return null;
    }
}

/**
 * Release a lock
 */
async function releaseLock(lockKey, correlationId) {
    try {
        await deleteRequestLock(lockKey, correlationId);
        return true;
    } catch (error) {
        logger.warn({ err: error, lockKey, correlationId }, 'Failed to release request lock');
        return false;
    }
}

/**
 * Request Lock Middleware Factory
 * 
 * @param {string} operation - The operation name for the lock key
 * @returns {Function} Express middleware
 */
function requestLock(operation) {
    return async (req, res, next) => {
        // Test harnesses and non-Express mocks may not implement the response
        // lifecycle hooks needed for deterministic lock cleanup.
        if (typeof res.on !== 'function') {
            return next();
        }

        // Get user ID from authenticated request
        const userId = req.user?.id || req.headers['x-user-id'];

        if (!userId) {
            // If no user ID, skip locking (let auth middleware handle it)
            return next();
        }

        const correlationId = req.correlationId || req.headers['x-correlation-id'] || req.id || 'unknown';

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
        const acquired = await acquireLock(lockKey, userId, operationName, correlationId);

        if (acquired === null) {
            return next();
        }

        if (!acquired) {
            logger.warn({
                userId,
                operation: operationName,
                correlationId,
                traceId: req.traceId,
                spanId: req.spanId,
                parentSpanId: req.parentSpanId || null
            }, 'Request blocked - concurrent operation in progress');

            return res.status(409).json({
                error: 'A similar operation is already in progress. Please wait for it to complete.',
                code: 'CONCURRENT_REQUEST_BLOCKED',
                retryAfter: Math.ceil(LOCK_TTL_MS / 1000)
            });
        }

        logger.debug({
            userId,
            operation: operationName,
            correlationId,
            traceId: req.traceId,
            spanId: req.spanId,
            parentSpanId: req.parentSpanId || null
        }, 'Request lock acquired');

        // Store lock info for cleanup on response
        req._lockKey = lockKey;
        req._lockCorrelationId = correlationId;

        // Release lock on response finish (success or error)
        let cleanedUp = false;
        const cleanup = async () => {
            if (cleanedUp || !req._lockKey) {
                return;
            }

            cleanedUp = true;

            try {
                await releaseLock(req._lockKey, req._lockCorrelationId);
                logger.debug({
                    userId,
                    operation: operationName,
                    correlationId: req._lockCorrelationId,
                    traceId: req.traceId,
                    spanId: req.spanId,
                    parentSpanId: req.parentSpanId || null
                }, 'Request lock released');
            } catch (error) {
                logger.warn({
                    err: error,
                    userId,
                    operation: operationName,
                    correlationId: req._lockCorrelationId,
                    traceId: req.traceId,
                    spanId: req.spanId,
                    parentSpanId: req.parentSpanId || null
                }, 'Failed to release request lock');
            }
        };

        const originalJson = typeof res.json === 'function' ? res.json.bind(res) : null;
        const originalSend = typeof res.send === 'function' ? res.send.bind(res) : null;
        const originalEnd = typeof res.end === 'function' ? res.end.bind(res) : null;

        if (originalJson) {
            res.json = (payload) => {
                void cleanup();
                return originalJson(payload);
            };
        }

        if (originalSend) {
            res.send = (payload) => {
                void cleanup();
                return originalSend(payload);
            };
        }

        if (originalEnd) {
            res.end = (payload) => {
                void cleanup();
                return originalEnd(payload);
            };
        }

        res.on('finish', cleanup);
        res.on('close', cleanup);

        next();
    };
}

/**
 * Get current lock status (for debugging/monitoring)
 */
function getLockStatus() {
    return { message: "Lock inspection not exposed by request-state store" };
}

module.exports = {
    requestLock,
    getLockStatus,
    // Exposed for testing
    _acquireLock: acquireLock,
    _releaseLock: releaseLock,
    _lockStore: {
        getRequestLock,
        acquireRequestLock: createRequestLock,
        releaseRequestLock: deleteRequestLock
    }
};
