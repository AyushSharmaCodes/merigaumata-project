const { AsyncLocalStorage } = require('async_hooks');
const crypto = require('crypto');

// Create a singleton instance of AsyncLocalStorage
const context = new AsyncLocalStorage();

/**
 * Get the current request context (if any)
 */
function getContext() {
    return context.getStore();
}

/**
 * Run a function within a new context
 */
function runWithContext(data, callback) {
    return context.run(data, callback);
}

/**
 * Get current trace context from AsyncLocalStorage
 * Returns default values if no context is active
 */
function getTraceContext() {
    const store = context.getStore();
    if (!store) {
        return {
            traceId: 'no-trace',
            spanId: 'no-span',
            parentSpanId: null,
            correlationId: 'no-correlation',
            userId: null
        };
    }
    return {
        traceId: store.traceId || 'no-trace',
        spanId: store.spanId || 'no-span',
        parentSpanId: store.parentSpanId || null,
        correlationId: store.correlationId || 'no-correlation',
        userId: store.userId || null,
        startTime: store.startTime
    };
}

/**
 * Generate a short span ID (16 hex characters)
 */
function generateSpanId() {
    return crypto.randomBytes(8).toString('hex');
}

/**
 * Create a child span for nested operations
 * @param {string} operationName - Name of the operation for logging
 * @returns {Object} Child span context
 */
function createChildSpan(operationName) {
    const parent = getTraceContext();
    const childSpanId = generateSpanId();

    return {
        traceId: parent.traceId,
        spanId: childSpanId,
        parentSpanId: parent.spanId,
        correlationId: parent.correlationId,
        userId: parent.userId,
        operationName,
        startTime: Date.now()
    };
}

/**
 * Calculate duration from context start time
 */
function getDuration() {
    const store = context.getStore();
    if (store?.startTime) {
        return Date.now() - store.startTime;
    }
    return 0;
}

module.exports = {
    context,
    getContext,
    runWithContext,
    getTraceContext,
    createChildSpan,
    getDuration,
    generateSpanId
};
