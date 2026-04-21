/**
 * Razorpay Webhook Logger Service
 * Logs and verifies Razorpay webhook events for audit trail
 */

const crypto = require('crypto');
const supabase = require('../config/supabase');
const { createModuleLogger } = require('../utils/logging-standards');
const { getTraceContext } = require('../utils/async-context');
const { FinancialEventLogger } = require('./financial-event-logger.service');

const log = createModuleLogger('RazorpayWebhookLogger');

// Webhook event types we process
const WEBHOOK_EVENTS = {
    PAYMENT_CAPTURED: 'payment.captured',
    PAYMENT_FAILED: 'payment.failed',
    REFUND_CREATED: 'refund.created',
    REFUND_PROCESSED: 'refund.processed',
    REFUND_FAILED: 'refund.failed',
    ORDER_PAID: 'order.paid',
    INVOICE_PAID: 'invoice.paid'
};

class RazorpayWebhookLogger {
    /**
     * Verify webhook signature
     * @param {string} body - Raw request body
     * @param {string} signature - X-Razorpay-Signature header
     * @returns {boolean} Whether signature is valid
     */
    static verifySignature(body, signature) {
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
        if (!webhookSecret) {
            log.warn('WEBHOOK_SECRET_MISSING', 'RAZORPAY_WEBHOOK_SECRET not configured');
            return false;
        }

        try {
            const expectedSignature = crypto
                .createHmac('sha256', webhookSecret)
                .update(body)
                .digest('hex');

            return crypto.timingSafeEqual(
                Buffer.from(signature),
                Buffer.from(expectedSignature)
            );
        } catch (error) {
            log.warn('SIGNATURE_VERIFY_ERROR', 'Error verifying webhook signature', { error: error.message });
            return false;
        }
    }

    /**
     * Log webhook event to database (enqueue for durable processing).
     * This INSERT is the queue enqueue operation. The webhook-worker.service.js polls and processes.
     * 
     * @param {Object} event - Parsed webhook event
     * @param {boolean} verified - Whether signature was verified
     * @returns {Object|null} Inserted row, or null if dedup/error
     */
    static async logWebhookEvent(event, verified = false) {
        const { correlationId } = getTraceContext();

        // Extract event_id for dedup
        const eventId = event.payload?.payment?.entity?.id
            || event.payload?.refund?.entity?.id
            || event.payload?.subscription?.entity?.id
            || event.payload?.order?.entity?.id
            || event.payload?.invoice?.entity?.id;

        // Sanitize payload before storage — redact card/bank/PII
        const { sanitizeWebhookPayload } = require('../utils/payment-sanitizer');
        const sanitizedPayload = sanitizeWebhookPayload(event.payload);

        try {
            const { data, error } = await supabase
                .from('webhook_logs')
                .insert({
                    provider: 'razorpay',
                    event_type: event.event,
                    event_id: eventId,
                    payload: sanitizedPayload,
                    signature_verified: verified,
                    correlation_id: correlationId,
                    processed: false,
                    status: verified ? 'PENDING' : 'DONE', // Unverified events are logged but never processed
                    retry_count: 0,
                    created_at: new Date().toISOString()
                })
                .select()
                .single();

            if (error) {
                // Check for unique constraint violation (replay/dedup)
                if (error.code === '23505') {
                    const { emitPaymentEvent } = require('../utils/payment-event-logger');
                    emitPaymentEvent('webhook_deduplicated', {
                        razorpayId: eventId,
                        module: event.event,
                        source: 'webhook_api',
                    });
                    log.info('WEBHOOK_DEDUP', `Duplicate webhook rejected: ${event.event} / ${eventId}`);
                    return { deduplicated: true, eventId };
                }
                log.warn('WEBHOOK_LOG_ERROR', 'Failed to log webhook event', { error: error.message });
                return null;
            }

            log.info('WEBHOOK_QUEUED', `Webhook enqueued: ${event.event}`, {
                webhookLogId: data.id,
                eventType: event.event,
                eventId,
                verified
            });

            return data;
        } catch (error) {
            log.operationError('LOG_WEBHOOK', error);
            return null;
        }
    }

    /**
     * Process a webhook event — DURABLE QUEUE VERSION.
     * 
     * Architecture:
     *   1. Verify signature (reject if invalid)
     *   2. Check for replay (dedup on event_id + event_type)
     *   3. Enqueue into webhook_logs with status='PENDING'
     *   4. Return 200 immediately — business logic runs via webhook-worker.service.js
     * 
     * NO setImmediate. NO in-memory processing. The DB is the queue.
     * If the process crashes after returning 200, the event persists in DB
     * and the worker will pick it up on next poll.
     */
    static async processWebhookEvent(event, rawBody, signature) {
        const { emitPaymentEvent } = require('../utils/payment-event-logger');

        emitPaymentEvent('webhook_received', {
            module: event.event,
            source: 'razorpay',
        });

        log.operationStart('PROCESSWebhook', { eventType: event.event });

        // 1. Verify signature
        const verified = this.verifySignature(rawBody, signature);
        if (!verified) {
            log.warn('WEBHOOK_UNVERIFIED', 'Webhook signature verification failed', {
                eventType: event.event
            });
            // Log unverified event (status='DONE', never processed) for audit
            await this.logWebhookEvent(event, false);
            return { success: false, verified: false, error: 'Invalid signature' };
        }

        // 2. Enqueue the event (INSERT into webhook_logs with status='PENDING')
        // This is the DURABLE enqueue. If process crashes after this point,
        // the event is safely persisted and the worker will process it.
        const webhookLog = await this.logWebhookEvent(event, verified);

        // 3. Handle dedup (replay protection)
        if (webhookLog?.deduplicated) {
            return { success: true, verified, deduplicated: true };
        }

        if (!webhookLog) {
            // Enqueue failed — this is serious but we still return 200 
            // to prevent Razorpay from retrying (they'll send again anyway)
            log.warn('WEBHOOK_ENQUEUE_FAILED', 'Failed to enqueue webhook event — will rely on sweep for recovery');
            return { success: false, verified, error: 'Enqueue failed' };
        }

        emitPaymentEvent('webhook_queued', {
            paymentId: webhookLog.id,
            module: event.event,
            source: 'webhook_api',
        });

        // Return success immediately — worker processes from DB queue
        return { success: true, verified, queued: true, webhookLogId: webhookLog.id };
    }

    /**
     * Handle payment.captured event
     */
    static async _handlePaymentCaptured(payload) {
        const payment = payload.payment?.entity;
        if (!payment) return;

        const orderId = payment.notes?.order_id;
        if (orderId) {
            // Log financial event
            await FinancialEventLogger.logPaymentReceived(orderId, payment.id, payment.amount / 100);

            log.info('PAYMENT_CAPTURED', 'Payment captured via webhook', {
                paymentId: payment.id,
                orderId,
                amount: payment.amount / 100
            });
        }
    }

    /**
     * Handle payment.failed event
     */
    static async _handlePaymentFailed(payload) {
        const payment = payload.payment?.entity;
        if (!payment) return;

        log.warn('PAYMENT_FAILED', 'Payment failed via webhook', {
            paymentId: payment.id,
            errorCode: payment.error_code,
            errorDescription: payment.error_description
        });
    }

    /**
     * Handle refund.processed event
     */
    static async _handleRefundProcessed(payload) {
        const refund = payload.refund?.entity;
        if (!refund) return;

        const orderId = refund.notes?.order_id;

        // Update order payment status
        if (orderId) {
            await supabase
                .from('orders')
                .update({
                    payment_status: 'refunded',
                    updated_at: new Date().toISOString()
                })
                .eq('id', orderId);

            await FinancialEventLogger.logRefundCompleted(orderId, refund.id, refund.amount / 100);

            log.info('REFUND_PROCESSED', 'Refund processed via webhook', {
                refundId: refund.id,
                orderId,
                amount: refund.amount / 100
            });
        }
    }

    /**
     * Handle refund.failed event
     */
    static async _handleRefundFailed(payload) {
        const refund = payload.refund?.entity;
        if (!refund) return;

        log.warn('REFUND_FAILED', 'Refund failed via webhook', {
            refundId: refund.id,
            orderId: refund.notes?.order_id
        });

        // Could notify admin here
    }

    /**
     * Get recent webhook logs
     */
    static async getRecentLogs(limit = 50) {
        const { data, error } = await supabase
            .from('webhook_logs')
            .select('*')
            .eq('provider', 'razorpay')
            .order('created_at', { ascending: false })
            .limit(limit);

        return error ? [] : data;
    }
}

module.exports = { RazorpayWebhookLogger, WEBHOOK_EVENTS };
