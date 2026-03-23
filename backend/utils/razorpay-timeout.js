/**
 * Razorpay API Timeout Wrapper
 * Adds timeout protection to Razorpay API calls to prevent hanging requests
 */

const logger = require('./logger');

/**
 * Default timeout for Razorpay API calls (30 seconds)
 */
const DEFAULT_RAZORPAY_TIMEOUT = parseInt(process.env.RAZORPAY_API_TIMEOUT) || 30000;

/**
 * Wraps a promise with a timeout
 * @param {Promise} promise - The promise to wrap
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {string} operation - Operation name for logging
 * @returns {Promise} Promise that rejects if timeout is exceeded
 */
function withTimeout(promise, timeoutMs = DEFAULT_RAZORPAY_TIMEOUT, operation = 'Razorpay API call') {
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            setTimeout(() => {
                const error = new Error(`${operation} timed out after ${timeoutMs}ms`);
                error.code = 'ETIMEDOUT';
                error.timeout = timeoutMs;
                reject(error);
            }, timeoutMs);
        })
    ]);
}

/**
 * Wraps Razorpay instance methods with timeout protection
 * @param {object} razorpay - Razorpay instance
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {object} Wrapped Razorpay instance
 */
function wrapRazorpayWithTimeout(razorpay, timeoutMs = DEFAULT_RAZORPAY_TIMEOUT) {
    const wrapped = {};

    // Wrap invoices methods
    wrapped.invoices = {
        create: (payload) => withTimeout(
            razorpay.invoices.create(payload),
            timeoutMs,
            'Razorpay invoices.create'
        ),
        fetch: (invoiceId) => withTimeout(
            razorpay.invoices.fetch(invoiceId),
            timeoutMs,
            'Razorpay invoices.fetch'
        ),
        issue: (invoiceId) => withTimeout(
            razorpay.invoices.issue(invoiceId),
            timeoutMs,
            'Razorpay invoices.issue'
        )
    };

    // Wrap payments methods
    wrapped.payments = {
        fetch: (paymentId) => withTimeout(
            razorpay.payments.fetch(paymentId),
            timeoutMs,
            'Razorpay payments.fetch'
        ),
        refund: (paymentId, options) => withTimeout(
            razorpay.payments.refund(paymentId, options),
            timeoutMs,
            'Razorpay payments.refund'
        ),
        capture: (paymentId, amount, currency) => withTimeout(
            razorpay.payments.capture(paymentId, amount, currency),
            timeoutMs,
            'Razorpay payments.capture'
        )
    };

    // Wrap orders methods
    wrapped.orders = {
        create: (payload) => withTimeout(
            razorpay.orders.create(payload),
            timeoutMs,
            'Razorpay orders.create'
        ),
        fetch: (orderId) => withTimeout(
            razorpay.orders.fetch(orderId),
            timeoutMs,
            'Razorpay orders.fetch'
        )
    };

    logger.info({ timeout: timeoutMs }, 'Razorpay API wrapper initialized with timeout protection');

    return wrapped;
}

module.exports = {
    withTimeout,
    wrapRazorpayWithTimeout,
    DEFAULT_RAZORPAY_TIMEOUT
};
