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
    const proxyCache = new WeakMap();

    const createProxy = (target, path) => {
        if (!target || (typeof target !== 'object' && typeof target !== 'function')) {
            return target;
        }

        if (proxyCache.has(target)) {
            return proxyCache.get(target);
        }

        const proxy = new Proxy(target, {
            get(currentTarget, prop, receiver) {
                const value = Reflect.get(currentTarget, prop, receiver);

                if (typeof value === 'function') {
                    return (...args) => withTimeout(
                        Promise.resolve(value.apply(currentTarget, args)),
                        timeoutMs,
                        `${path}.${String(prop)}`
                    );
                }

                if (value && typeof value === 'object') {
                    return createProxy(value, `${path}.${String(prop)}`);
                }

                return value;
            }
        });

        proxyCache.set(target, proxy);
        return proxy;
    };

    logger.info({ timeout: timeoutMs }, 'Razorpay API wrapper initialized with timeout protection');

    return createProxy(razorpay, 'Razorpay');
}

module.exports = {
    withTimeout,
    wrapRazorpayWithTimeout,
    DEFAULT_RAZORPAY_TIMEOUT
};
