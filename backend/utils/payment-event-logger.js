/**
 * Payment Event Logger — Structured lifecycle event tracking
 * 
 * Provides a consistent, auditable event trail for all payment operations.
 * Each event is both logged (structured JSON) and optionally stored in DB
 * for dashboard metrics.
 * 
 * Event taxonomy:
 *   webhook_received → webhook_queued → webhook_processing → webhook_processed / webhook_failed
 *   payment_created → payment_pending → payment_success / payment_failed / payment_expired
 *   orphan_detected → orphan_matched / orphan_flagged / orphan_refunded
 *   sweep_started → sweep_completed
 */

const { createModuleLogger } = require('./logging-standards');
const { maskPaymentId } = require('./payment-sanitizer');

const log = createModuleLogger('PaymentEvents');

// In-memory metrics counters (reset on process restart)
const metrics = {
    webhook_received: 0,
    webhook_processed: 0,
    webhook_failed: 0,
    webhook_deduplicated: 0,
    retry_scheduled: 0,
    dead_lettered: 0,
    payment_success: 0,
    payment_failed: 0,
    payment_expired: 0,
    orphan_detected: 0,
    orphan_matched: 0,
    orphan_refunded: 0,
    sweep_runs: 0,
    sweep_recovered: 0,
    _processingTimes: [],  // Last 100 processing durations
};

/**
 * Emit a structured payment lifecycle event.
 * @param {string} eventType - Event name from taxonomy
 * @param {Object} data - Event context data
 * @param {string} [data.paymentId] - Internal payment UUID
 * @param {string} [data.razorpayId] - Razorpay payment/order ID  
 * @param {string} [data.module] - Source module (checkout, event, donation)
 * @param {number} [data.durationMs] - Processing duration
 * @param {string} [data.source] - Event trigger (webhook, verify, sweep, cron)
 * @param {Object} [data.extra] - Additional context
 */
function emitPaymentEvent(eventType, data = {}) {
    const event = {
        event: eventType,
        timestamp: new Date().toISOString(),
        paymentId: data.paymentId || null,
        razorpayId: data.razorpayId ? maskPaymentId(data.razorpayId) : null,
        module: data.module || null,
        source: data.source || null,
        durationMs: data.durationMs || null,
        ...data.extra,
    };

    // Track metrics
    if (metrics[eventType] !== undefined) {
        metrics[eventType]++;
    }

    // Track processing times for avg calculation
    if (data.durationMs && eventType === 'webhook_processed') {
        metrics._processingTimes.push(data.durationMs);
        if (metrics._processingTimes.length > 100) {
            metrics._processingTimes.shift();
        }
    }

    // Log at appropriate level
    switch (eventType) {
        case 'webhook_failed':
        case 'orphan_detected':
        case 'dead_lettered':
            log.warn(eventType.toUpperCase(), formatMessage(eventType, data), event);
            break;
        case 'payment_success':
        case 'webhook_processed':
        case 'orphan_matched':
        case 'sweep_completed':
        case 'retry_scheduled':
            log.info(eventType.toUpperCase(), formatMessage(eventType, data), event);
            break;
        default:
            log.debug(eventType.toUpperCase(), formatMessage(eventType, data), event);
    }

    return event;
}

function formatMessage(eventType, data) {
    const id = data.razorpayId ? maskPaymentId(data.razorpayId) : data.paymentId || '?';
    const mod = data.module ? ` [${data.module}]` : '';
    return `${eventType}${mod}: ${id}`;
}

/**
 * Get current metrics snapshot.
 * @returns {Object} Metrics with computed averages
 */
function getMetrics() {
    const times = metrics._processingTimes;
    const avgProcessingMs = times.length > 0
        ? Math.round(times.reduce((a, b) => a + b, 0) / times.length)
        : 0;

    const total = metrics.webhook_processed + metrics.webhook_failed;
    const successRate = total > 0
        ? (metrics.webhook_processed / total * 100).toFixed(1) + '%'
        : '0%';

    return {
        webhooks: {
            received: metrics.webhook_received,
            processed: metrics.webhook_processed,
            failed: metrics.webhook_failed,
            deduplicated: metrics.webhook_deduplicated,
            retryScheduled: metrics.retry_scheduled,
            deadLettered: metrics.dead_lettered,
            successRate,
            avgProcessingMs,
        },
        payments: {
            success: metrics.payment_success,
            failed: metrics.payment_failed,
            expired: metrics.payment_expired,
        },
        orphans: {
            detected: metrics.orphan_detected,
            matched: metrics.orphan_matched,
            refunded: metrics.orphan_refunded,
        },
        sweeps: {
            runs: metrics.sweep_runs,
            recovered: metrics.sweep_recovered,
        },
    };
}

/**
 * Reset metrics (for testing).
 */
function resetMetrics() {
    Object.keys(metrics).forEach(key => {
        if (key === '_processingTimes') {
            metrics[key] = [];
        } else {
            metrics[key] = 0;
        }
    });
}

module.exports = {
    emitPaymentEvent,
    getMetrics,
    resetMetrics,
};
