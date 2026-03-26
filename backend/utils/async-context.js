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
 * Create a new root span when work starts without an active request context
 * @param {string} operationName - Name of the operation for logging
 * @param {Object} overrides - Optional context overrides
 * @returns {Object} Root span context
 */
function createRootSpan(operationName, overrides = {}) {
    const traceId = overrides.traceId || crypto.randomUUID();

    return {
        traceId,
        spanId: overrides.spanId || generateSpanId(),
        parentSpanId: overrides.parentSpanId || null,
        correlationId: overrides.correlationId || traceId,
        userId: overrides.userId || null,
        operationName,
        startTime: Date.now(),
        ...overrides
    };
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
 * Create a span for work that may or may not already have active trace context.
 * Falls back to a fresh root span for detached/background execution.
 * @param {string} operationName - Name of the operation for logging
 * @param {Object} overrides - Optional context overrides
 * @returns {Object} Span context
 */
function createExecutionContext(operationName, overrides = {}) {
    const parent = getContext();

    if (parent?.traceId && parent.traceId !== 'no-trace') {
        return {
            traceId: overrides.traceId || parent.traceId,
            spanId: overrides.spanId || generateSpanId(),
            parentSpanId: overrides.parentSpanId || parent.spanId || null,
            correlationId: overrides.correlationId || parent.correlationId || parent.traceId,
            userId: overrides.userId !== undefined ? overrides.userId : (parent.userId || null),
            operationName,
            startTime: Date.now(),
            ...overrides
        };
    }

    return createRootSpan(operationName, overrides);
}

/**
 * Run work inside a span context. Creates a child span when a parent exists,
 * otherwise starts a fresh root span.
 * @param {string} operationName - Name of the operation
 * @param {Function} callback - Work to execute
 * @param {Object} overrides - Optional context overrides
 * @returns {*} Callback result
 */
function runInSpan(operationName, callback, overrides = {}) {
    return runWithContext(createExecutionContext(operationName, overrides), callback);
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
    runInSpan,
    getTraceContext,
    createRootSpan,
    createChildSpan,
    createExecutionContext,
    getDuration,
    generateSpanId
};
