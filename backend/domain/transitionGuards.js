const { QC_STATUS, QC_TERMINAL } = require('./qcStatus');
const { REFUND_STATUS } = require('./refundStatus');

/**
 * Transition Guards for State Machine
 */
const TransitionGuards = {
    /**
     * Can process a refund for this order/return?
     */
    canProcessRefund: (order, returnObj) => {
        // Pre-shipped cancellations are always refundable
        if (order.status.startsWith('cancelled')) {
            return true;
        }

        // Return flow: Must have terminal QC and no existing refund
        if (returnObj && returnObj.refund_status === REFUND_STATUS.NOT_STARTED) {
            // Check outcome exclusions
            const nonRefundableOutcomes = ['ZERO_REFUND', 'RETURN_BACK_TO_CUSTOMER', 'DISPOSE_OR_LIQUIDATE'];
            if (nonRefundableOutcomes.includes(returnObj.return_outcome)) {
                return false;
            }

            // Must have terminal QC status
            return QC_TERMINAL.includes(returnObj.qc_status);
        }

        return false;
    },

    /**
     * Can initiate QC for this return?
     */
    canInitiateQC: (order, returnObj) => {
        // Logistics check: Item must have reached the warehouse (RETURNED or PARTIALLY_RETURNED)
        const logisticsComplete = ['returned', 'partially_returned'].includes(order.status);
        
        return logisticsComplete && returnObj.qc_status === QC_STATUS.NOT_STARTED;
    }
};

module.exports = TransitionGuards;
