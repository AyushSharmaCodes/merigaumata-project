const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const EventRefundService = require('./event-refund.service');
const { getRazorpayInstance } = require('../utils/razorpay-helper');

/**
 * Reconciliation Service
 * Syncs internal refund status with payment gateway settlement status
 */
class ReconciliationService {
    /**
     * Run full reconciliation cycle
     */
    static async runReconciliation() {
        logger.info({ module: 'Reconciliation', operation: 'START' }, 'Starting refund reconciliation cycle');

        // 1. Fetch refunds in IN_PROGRESS or INITIATED state
        const { data: pendingRefunds, error } = await supabase
            .from('event_refunds')
            .select('*')
            .in('status', ['INITIATED', 'PROCESSING']);

        if (error) {
            logger.error({ err: error }, 'Failed to fetch pending refunds for reconciliation');
            return;
        }

        logger.info({ count: pendingRefunds?.length || 0 }, 'Found pending refunds to reconcile');

        const results = {
            total: pendingRefunds?.length || 0,
            settled: 0,
            failed: 0,
            skipped: 0
        };

        const razorpay = getRazorpayInstance();

        for (const refund of pendingRefunds) {
            try {
                if (!refund.gateway_reference) {
                    logger.warn({ refundId: refund.id }, 'Refund has no gateway reference, skipping');
                    results.skipped++;
                    continue;
                }

                // Query Razorpay for refund status
                const rpRefund = await razorpay.refunds.fetch(refund.gateway_reference);

                logger.debug({
                    refundId: refund.id,
                    gatewayStatus: rpRefund.status
                }, 'Fetched refund status from Razorpay');

                if (rpRefund.status === 'processed') {
                    await EventRefundService.markSettled(refund.gateway_reference);
                    results.settled++;
                } else if (rpRefund.status === 'failed') {
                    await EventRefundService.markFailed(refund.gateway_reference, rpRefund.notes?.reason || 'Gateway refund failed');
                    results.failed++;

                    // Alert on failure
                    this.raiseAlert('REFUNDFailed', refund, rpRefund);
                } else {
                    results.skipped++;
                }

            } catch (err) {
                logger.error({ err: err.message, refundId: refund.id }, 'Error reconciling single refund');
                results.skipped++;
            }
        }

        logger.info({
            module: 'Reconciliation',
            operation: 'END',
            results
        }, 'Finished refund reconciliation cycle');

        return results;
    }

    /**
     * Simple alert mechanism (could be Slack, Email, etc.)
     */
    static raiseAlert(type, refund, details) {
        logger.error({
            module: 'Alert',
            type,
            refundId: refund.id,
            details
        }, `CRITICAL: Refund Reconciliation Alert - ${type}`);
    }
}

module.exports = ReconciliationService;
