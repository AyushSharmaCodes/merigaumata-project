/**
 * Razorpay Webhook Logger Service
 * Logs and verifies Razorpay webhook events for audit trail
 */

const crypto = require('crypto');
const supabase = require('../config/supabase');
const { createModuleLogger } = require('../utils/logging-standards');
const { getTraceContext } = require('../utils/async-context');
const { FinancialEventLogger } = require('./financial-event-logger.service');
const webhookService = require('./webhook.service');

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
     * Log webhook event to database
     * @param {Object} event - Parsed webhook event
     * @param {boolean} verified - Whether signature was verified
     */
    static async logWebhookEvent(event, verified = false) {
        const { correlationId } = getTraceContext();

        try {
            const { data, error } = await supabase
                .from('webhook_logs')
                .insert({
                    provider: 'razorpay',
                    event_type: event.event,
                    event_id: event.payload?.payment?.entity?.id || event.payload?.refund?.entity?.id,
                    payload: event.payload,
                    signature_verified: verified,
                    correlation_id: correlationId,
                    processed: false,
                    created_at: new Date().toISOString()
                })
                .select()
                .single();

            if (error) {
                log.warn('WEBHOOK_LOG_ERROR', 'Failed to log webhook event', { error: error.message });
                return null;
            }

            log.info('WEBHOOK_LOGGED', `Webhook event logged: ${event.event}`, {
                webhookLogId: data.id,
                eventType: event.event,
                verified
            });

            return data;
        } catch (error) {
            log.operationError('LOG_WEBHOOK', error);
            return null;
        }
    }

    /**
     * Process a webhook event and trigger appropriate actions
     */
    static async processWebhookEvent(event, rawBody, signature) {
        log.operationStart('PROCESSWebhook', { eventType: event.event });

        // 1. Verify signature
        const verified = this.verifySignature(rawBody, signature);
        if (!verified) {
            log.warn('WEBHOOK_UNVERIFIED', 'Webhook signature verification failed', {
                eventType: event.event
            });
            // CRITICAL: Log the unverified event but DO NOT process the business logic
            await this.logWebhookEvent(event, false);
            return { success: false, verified: false, error: 'Invalid signature' };
        }

        // 2. Log the event
        const webhookLog = await this.logWebhookEvent(event, verified);

        // 3. Process Logic
        try {
            // Delegate business logic to the central Webhook Service
            // This ensures all event types (Donations, Registrations, Orders) are handled consistently
            await webhookService.handleEvent(event);

            // Mark as processed
            if (webhookLog) {
                await supabase
                    .from('webhook_logs')
                    .update({ processed: true, processed_at: new Date().toISOString() })
                    .eq('id', webhookLog.id);
            }

            return { success: true, verified, processed: true };

        } catch (error) {
            log.operationError('PROCESS_WEBHOOK', error);
            // We return success: false, but flag `shouldRetry: true` to trigger a 500 response from the router. 
            // This guarantees Razorpay will organically retry transient failure states like Database Outages.
            return { success: false, verified, error: error.message, shouldRetry: true };
        }
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
