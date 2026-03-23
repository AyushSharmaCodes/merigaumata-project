const { supabaseAdmin: supabase } = require('../config/supabase');
const logger = require('../utils/logger');
const { refundPayment } = require('../utils/razorpay-helper');

/**
 * Event Refund Service
 * Handles refunds specific to event registrations (event_refunds table).
 */
class EventRefundService {
    /**
     * Initiate a refund record for an event registration
     * @param {Object} params - { eventId, userId, registrationId, paymentId, amount, correlationId }
     * @returns {Object} Created refund record
     */
    static async initiateRefund({ eventId, userId, registrationId, paymentId, amount, correlationId }) {
        // 1. Check for existing refund to ensure idempotency
        const { data: existingRefund } = await supabase
            .from('event_refunds')
            .select('*')
            .eq('registration_id', registrationId)
            .maybeSingle();

        if (existingRefund) {
            logger.info({ registrationId, refundId: existingRefund.id }, '[EventRefund] Refund already initiated for this registration');
            return existingRefund;
        }

        // 2. Create new refund record
        const { data, error } = await supabase
            .from('event_refunds')
            .insert([{
                event_id: eventId,
                user_id: userId,
                registration_id: registrationId,
                payment_id: paymentId,
                amount: amount,
                status: 'INITIATED',
                correlation_id: correlationId,
                initiated_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (error) {
            logger.error({ err: error, registrationId }, '[EventRefund] Failed to initiate refund record');
            throw error;
        }

        return data;
    }

    /**
     * Mark refund as processing with gateway reference
     */
    static async markProcessing(id, refundId) {
        const { data, error } = await supabase
            .from('event_refunds')
            .update({
                status: 'PROCESSING',
                gateway_reference: refundId,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Mark refund as settled (usually called from webhook)
     */
    static async markSettled(refundId) {
        const { data, error } = await supabase
            .from('event_refunds')
            .update({
                status: 'SETTLED',
                settled_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('gateway_reference', refundId)
            .select()
            .single();

        if (error) throw error;
        return data;
    }
}

module.exports = EventRefundService;
