/**
 * Refund Calculator Service
 * Handles tax-proportional refund calculations for partial and full returns
 */

class RefundCalculator {
    /**
     * Calculate refund breakdown for a single item
     * @param {Object} orderItem - The original order item with tax snapshot
     * @param {number} returnQuantity - Quantity being returned
     * @returns {Object} Refund breakdown (taxable, cgst, sgst, igst, total)
     */
    static calculateItemRefund(orderItem, returnQuantity) {
        if (!orderItem || returnQuantity <= 0) {
            return {
                taxableRefund: 0,
                cgstRefund: 0,
                sgstRefund: 0,
                igstRefund: 0,
                totalRefund: 0
            };
        }

        const quantity = orderItem.quantity;
        const refundRatio = returnQuantity / quantity;

        const proportional = (amount) => {
            return Number(((amount || 0) * refundRatio).toFixed(2));
        };

        // Fallback: If taxable_amount is missing, try price_per_unit then unit_price snapshot
        let baseAmount = (orderItem.taxable_amount !== null && orderItem.taxable_amount !== undefined)
            ? orderItem.taxable_amount
            : (orderItem.price_per_unit || orderItem.product?.price || 0);

        const taxableRefund = proportional(baseAmount);
        const cgstRefund = proportional(orderItem.cgst);
        const sgstRefund = proportional(orderItem.sgst);
        const igstRefund = proportional(orderItem.igst);

        // Calculate total from components
        let totalRefund = Number((taxableRefund + cgstRefund + sgstRefund + igstRefund).toFixed(2));

        // Final Safety Check: If total_amount snapshot exists, ensure we aren't under-refunding
        const snapshotTotal = Number(orderItem.total_amount || 0);
        if (snapshotTotal > 0 && totalRefund < proportional(snapshotTotal)) {
            totalRefund = proportional(snapshotTotal);
        }

        // Final fallback: if everything is still 0/NaN, try a pure price-based calculation
        if ((!totalRefund || isNaN(totalRefund)) && baseAmount > 0) {
            totalRefund = proportional(baseAmount);
        }

        return {
            taxableRefund,
            cgstRefund,
            sgstRefund,
            igstRefund,
            totalRefund
        };
    }

    /**
     * Calculate total refund for a list of return items
     * @param {Array} orderItems - Full list of order items
     * @param {Array} returnItems - List of items to return [{ orderItemId, quantity }]
     */
    static calculateReturnTotal(orderItems, returnItems) {
        let summary = {
            totalTaxableRefund: 0,
            totalCgstRefund: 0,
            totalSgstRefund: 0,
            totalIgstRefund: 0,
            totalRefund: 0
        };

        const itemBreakdowns = [];

        for (const returnItem of returnItems) {
            const originalItem = orderItems.find(i => i.id === returnItem.orderItemId);
            if (!originalItem) continue;

            const breakdown = this.calculateItemRefund(originalItem, returnItem.quantity);

            summary.totalTaxableRefund += breakdown.taxableRefund;
            summary.totalCgstRefund += breakdown.cgstRefund;
            summary.totalSgstRefund += breakdown.sgstRefund;
            summary.totalIgstRefund += breakdown.igstRefund;
            summary.totalRefund += breakdown.totalRefund;

            itemBreakdowns.push({
                orderItemId: originalItem.id,
                quantity: returnItem.quantity,
                ...breakdown
            });
        }

        // Round final totals to 2 decimals
        summary.totalTaxableRefund = Number(summary.totalTaxableRefund.toFixed(2));
        summary.totalCgstRefund = Number(summary.totalCgstRefund.toFixed(2));
        summary.totalSgstRefund = Number(summary.totalSgstRefund.toFixed(2));
        summary.totalIgstRefund = Number(summary.totalIgstRefund.toFixed(2));
        summary.totalRefund = Number(summary.totalRefund.toFixed(2));

        return {
            summary,
            items: itemBreakdowns
        };
    }
}

module.exports = { RefundCalculator };
