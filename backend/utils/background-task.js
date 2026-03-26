const logger = require('./logger');
const { createExecutionContext, runWithContext } = require('./async-context');

/**
 * Run deferred work on the next event-loop turn while preserving trace lineage.
 * This is the safe replacement for ad hoc setImmediate fire-and-forget blocks.
 */
function scheduleBackgroundTask({ operationName, task, context = {}, errorMessage = 'Background task failed' }) {
    const executionContext = createExecutionContext(operationName, context);

    setImmediate(() => {
        Promise.resolve(
            runWithContext(executionContext, task)
        ).catch((err) => {
            logger.error({
                err,
                operationName,
                traceId: executionContext.traceId,
                spanId: executionContext.spanId,
                parentSpanId: executionContext.parentSpanId,
                correlationId: executionContext.correlationId,
                userId: executionContext.userId
            }, errorMessage);
        });
    });
}

module.exports = {
    scheduleBackgroundTask
};
