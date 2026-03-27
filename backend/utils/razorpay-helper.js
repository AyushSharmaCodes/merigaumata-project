/**
 * Razorpay Helper Utilities
 * Centralized functions for Razorpay payment operations with delayed capture pattern
 */

const Razorpay = require('razorpay');
const logger = require('./logger');
const { wrapRazorpayWithTimeout } = require('./razorpay-timeout');

// Initialize Razorpay
const razorpay = wrapRazorpayWithTimeout(new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
}));

/**
 * Create a Razorpay order with manual capture (payment_capture: 0)
 * Payment will be authorized but NOT captured until explicitly captured
 * @param {number} amount - Amount in INR (will be converted to paise)
 * @param {string} receipt - Unique receipt identifier
 * @param {object} notes - Optional notes for the order
 * @returns {Promise<object>} Razorpay order object
 */
async function createManualCaptureOrder(amount, receipt, notes = {}) {
    try {
        logger.info({ amount, receipt }, '[RazorpayHelper] Creating manual capture order');

        const options = {
            amount: Math.round(amount * 100), // Amount in paise
            currency: 'INR',
            receipt: receipt,
            payment_capture: 0, // MANUAL CAPTURE - only captures after DB success
            notes: notes
        };

        const order = await razorpay.orders.create(options);

        logger.info({
            orderId: order.id,
            amount: order.amount,
            captureMode: 'manual'
        }, '[RazorpayHelper] Order created with manual capture');

        return order;
    } catch (error) {
        logger.error({ err: error }, '[RazorpayHelper] Failed to create order');
        throw new Error(`Failed to create payment order: ${error.message}`);
    }
}

/**
 * Create a Razorpay order with auto capture (for backward compatibility)
 * @param {number} amount - Amount in INR
 * @param {string} receipt - Unique receipt identifier
 * @param {object} notes - Optional notes
 * @returns {Promise<object>} Razorpay order object
 */
async function createAutoCaptureOrder(amount, receipt, notes = {}) {
    try {
        const options = {
            amount: Math.round(amount * 100),
            currency: 'INR',
            receipt: receipt,
            payment_capture: 1, // AUTO CAPTURE
            notes: notes
        };

        const order = await razorpay.orders.create(options);
        logger.info({ orderId: order.id }, '[RazorpayHelper] Order created with auto capture');
        return order;
    } catch (error) {
        logger.error({ err: error }, '[RazorpayHelper] Failed to create auto-capture order');
        throw new Error(`Failed to create payment order: ${error.message}`);
    }
}

/**
 * Capture an authorized payment
 * Call this ONLY after all database operations succeed
 * @param {string} paymentId - Razorpay payment ID (pay_xxx)
 * @param {number} amount - Amount to capture in INR
 * @returns {Promise<object>} Captured payment object
 */
async function capturePayment(paymentId, amount) {
    try {
        logger.info({ paymentId, amount }, '[RazorpayHelper] Capturing payment');

        const payment = await razorpay.payments.capture(paymentId, Math.round(amount * 100), 'INR');

        logger.info({
            paymentId: payment.id,
            status: payment.status,
            amount: payment.amount
        }, '[RazorpayHelper] Payment captured successfully');

        return payment;
    } catch (error) {
        logger.error({ err: error, paymentId }, '[RazorpayHelper] Failed to capture payment');
        throw new Error(`Failed to capture payment: ${error.message}`);
    }
}

/**
 * Void an authorized (uncaptured) payment
 * Use this when DB operations fail - no refund needed since payment wasn't captured
 * Note: Razorpay doesn't have a direct "void" API - uncaptured payments auto-void after 5 days
 * This function logs the void intent and can be extended for tracking
 * @param {string} paymentId - Razorpay payment ID
 * @param {string} reason - Reason for voiding
 * @returns {Promise<object>} Status object
 */
async function voidAuthorization(paymentId, reason = 'DB operation failed') {
    try {
        logger.info({ paymentId, reason }, '[RazorpayHelper] Voiding authorized payment (not captured)');

        // Razorpay auto-voids uncaptured payments after 5 days
        // We log this for tracking purposes
        // If immediate refund is needed, the payment would need to be captured first

        // Fetch payment to verify it's not captured
        const payment = await razorpay.payments.fetch(paymentId);

        if (payment.status === 'authorized') {
            logger.info({
                paymentId,
                status: 'voided',
                note: 'Payment will auto-void in 5 days or can be manually released via Razorpay Dashboard'
            }, '[RazorpayHelper] Authorization marked for void');

            return {
                success: true,
                status: 'voided',
                paymentId,
                message: 'Authorization voided - payment was not captured'
            };
        } else if (payment.status === 'captured') {
            // Payment was already captured - need to refund instead
            logger.warn({ paymentId }, '[RazorpayHelper] Payment already captured - initiating refund instead');
            return await refundPayment(paymentId, null, { reason });
        } else {
            return {
                success: true,
                status: payment.status,
                paymentId,
                message: `Payment in status: ${payment.status}`
            };
        }
    } catch (error) {
        logger.error({ err: error, paymentId }, '[RazorpayHelper] Failed to void authorization');
        // Don't throw - void failures shouldn't break the flow
        return {
            success: false,
            error: error.message,
            paymentId
        };
    }
}

/**
 * Refund a captured payment
 * Use this for refunds on already-captured payments
 * @param {string} paymentId - Razorpay payment ID
 * @param {number|null} amount - Amount to refund in INR (null for full refund)
 * @param {object} notes - Refund notes
 * @returns {Promise<object>} Refund object
 */
async function refundPayment(paymentId, amount = null, notes = {}) {
    try {
        logger.info({ paymentId, amount }, '[RazorpayHelper] Initiating refund');

        const refundOptions = {
            speed: 'normal',
            notes: notes
        };

        if (amount) {
            refundOptions.amount = Math.round(amount * 100);
        }

        const refund = await razorpay.payments.refund(paymentId, refundOptions);

        logger.info({
            refundId: refund.id,
            paymentId,
            amount: refund.amount,
            status: refund.status
        }, '[RazorpayHelper] Refund initiated successfully');

        return refund;
    } catch (error) {
        logger.error({ err: error, paymentId }, '[RazorpayHelper] Failed to process refund');
        throw new Error(`Failed to process refund: ${error.message}`);
    }
}

/**
 * Fetch payment details
 * @param {string} paymentId - Razorpay payment ID
 * @returns {Promise<object>} Payment object
 */
async function fetchPayment(paymentId) {
    try {
        return await razorpay.payments.fetch(paymentId);
    } catch (error) {
        logger.error({ err: error, paymentId }, '[RazorpayHelper] Failed to fetch payment');
        throw error;
    }
}

/**
 * Get the Razorpay instance for advanced operations
 * @returns {Razorpay} Razorpay instance
 */
function getRazorpayInstance() {
    return razorpay;
}

module.exports = {
    createManualCaptureOrder,
    createAutoCaptureOrder,
    capturePayment,
    voidAuthorization,
    refundPayment,
    fetchPayment,
    getRazorpayInstance,
    razorpay // Direct access for operations not covered by helpers
};
