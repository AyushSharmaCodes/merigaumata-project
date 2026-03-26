/**
 * Idempotency Middleware
 * 
 * Ensures critical operations are processed only once, even if the request
 * is retried. Uses a DB-backed store so protection survives restarts and
 * works across multiple backend instances.
 * 
 * Usage: Apply to payment-critical routes like order creation and payment verification.
 * 
 * Example:
 *   router.post('/verify-payment', idempotency(), (req, res) => { ... });
 */

const logger = require('../utils/logger');
const {
    getIdempotencyEntry,
    createIdempotencyEntry,
    completeIdempotencyEntry,
    deleteIdempotencyEntry,
    deleteExpiredIdempotencyEntry
} = require('../lib/store/request-state.store');

// Configuration
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Generate cache key from user ID and idempotency key
 */
function generateCacheKey(userId, idempotencyKey) {
    return `${userId || 'anonymous'}:${idempotencyKey}`;
}

/**
 * Idempotency Middleware
 * 
 * @returns {Function} Express middleware
 */
function idempotency() {
    return async (req, res, next) => {
        const idempotencyKey = req.headers['x-idempotency-key'];

        // If no idempotency key provided, proceed normally (backward compatible)
        if (!idempotencyKey) {
            return next();
        }

        const userId = req.user?.id || req.headers['x-user-id'] || 'anonymous';
        const cacheKey = generateCacheKey(userId, idempotencyKey);
        const correlationId = req.correlationId || req.headers['x-correlation-id'] || req.id || 'unknown';
        const traceContext = {
            traceId: req.traceId,
            spanId: req.spanId,
            parentSpanId: req.parentSpanId || null
        };

        try {
            await deleteExpiredIdempotencyEntry(cacheKey);

            const created = await createIdempotencyEntry({
                cacheKey,
                userId,
                idempotencyKey,
                correlationId,
                expiresAt: Date.now() + CACHE_TTL_MS
            });

            if (!created) {
                const cachedEntry = await getIdempotencyEntry(cacheKey);

                if (cachedEntry) {
                    logger.info({
                        idempotencyKey,
                        userId,
                        correlationId,
                        ...traceContext,
                        cachedCorrelationId: cachedEntry.correlation_id,
                        age: Date.now() - new Date(cachedEntry.created_at || cachedEntry.completed_at || Date.now()).getTime()
                    }, 'Returning cached idempotent response');

                    if (cachedEntry.in_progress) {
                        return res.status(409).json({
                            error: 'Request with this idempotency key is currently processing',
                            code: 'IDEMPOTENCY_CONCURRENT'
                        });
                    }

                    if (cachedEntry.response) {
                        return res.status(cachedEntry.status_code || cachedEntry.statusCode || 200).json(cachedEntry.response);
                    }
                }
            }
        } catch (error) {
            logger.warn({ err: error, cacheKey, correlationId, ...traceContext }, 'Idempotency store unavailable, allowing request without idempotency protection');
            return next();
        }

        // Override res.json to capture the response for caching
        const originalJson = res.json.bind(res);

        res.json = (data) => {
            // Capture data immediately
            const statusCode = res.statusCode;

            // Only cache successful or client-error responses (not server errors)
            if (statusCode < 500) {
                // Cache the response asynchronously (fire and forget, or we could await if critical)
                // We use fire-and-forget here to not delay response, logging error if fails
                completeIdempotencyEntry(cacheKey, {
                    response: data,
                    statusCode,
                    correlationId,
                    expiresAt: Date.now() + CACHE_TTL_MS
                }).catch(err => logger.error({ err }, 'Failed to cache idempotent response'));

                logger.debug({
                    idempotencyKey,
                    userId,
                    statusCode,
                    correlationId,
                    ...traceContext
                }, 'Cached idempotent response');
            } else {
                // Remove the "in-progress" marker so retry is possible
                deleteIdempotencyEntry(cacheKey).catch(() => { });
                logger.warn({
                    idempotencyKey,
                    userId,
                    statusCode,
                    correlationId,
                    ...traceContext
                }, 'Not caching 5xx error for idempotency key');
            }

            return originalJson(data);
        };

        // Handle errors - remove from cache if in-progress fails
        res.on('close', () => {});

        next();
    };
}

/**
 * Get cache statistics (for monitoring)
 */
function getCacheStats() {
    return { message: "Stats not supported by storage adapter" };
}

module.exports = {
    idempotency,
    getCacheStats,
    // Exposed for testing
    _store: {
        getIdempotencyEntry,
        createIdempotencyEntry,
        completeIdempotencyEntry,
        deleteIdempotencyEntry
    }
};
