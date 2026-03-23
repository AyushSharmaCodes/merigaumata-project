const logger = require('../utils/logger');

/**
 * Event Pricing Service
 * Handles tax-inclusive pricing calculations for events.
 * 
 * Business Rule:
 * - Admin enters the TOTAL price (GST Inclusive).
 * - Backend calculates Base Price and GST Amount internally.
 * - Base Price = Total / (1 + GST Rate / 100)
 * - GST Amount = Total - Base Price
 */
class EventPricingService {
    /**
     * Calculate tax breakdown for a given total amount and GST rate
     * @param {number} totalAmount - The total price entered by admin (GST Inclusive)
     * @param {number} gstRate - Selected GST slab (0, 5, 12, 18, 28)
     * @returns {Object} { basePrice, gstAmount, totalAmount, gstRate }
     */
    static calculateBreakdown(totalAmount, gstRate = 0) {
        if (!totalAmount || totalAmount <= 0) {
            return {
                basePrice: 0,
                gstAmount: 0,
                totalAmount: 0,
                gstRate: 0
            };
        }

        const rate = parseFloat(gstRate) || 0;
        const total = parseFloat(totalAmount);

        // Reverse calculation
        // Total = Base + (Base * Rate / 100)
        // Total = Base * (1 + Rate / 100)
        // Base = Total / (1 + Rate / 100)

        const basePrice = total / (1 + (rate / 100));
        const gstAmount = total - basePrice;

        const result = {
            basePrice: parseFloat(basePrice.toFixed(2)),
            gstAmount: parseFloat(gstAmount.toFixed(2)),
            totalAmount: parseFloat(total.toFixed(2)),
            gstRate: rate
        };

        logger.debug({
            module: 'EventPricing',
            operation: 'CALCULATE_BREAKDOWN',
            input: { totalAmount, gstRate },
            output: result
        }, 'Calculated event pricing breakdown');

        return result;
    }
}

module.exports = EventPricingService;
