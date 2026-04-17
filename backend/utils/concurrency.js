/**
 * Concurrency Utilities
 */

/**
 * Optimistic Retry Strategy
 * @param {Function} task - Async function to execute
 * @param {number} maxRetries - Maximum retry attempts
 * @returns {Promise<any>}
 */
const withOptimisticRetry = async (task, maxRetries = 3) => {
    let lastError;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await task();
        } catch (error) {
            // Check for Postgres/Supabase version conflict (if we implement it via a function)
            // Or a generic 409/Concurrency error from our service
            if (error.code === '409' || error.message?.includes('version conflict') || error.message?.includes('concurrent update')) {
                lastError = error;
                // Jittered Exponential Backoff
                const delay = Math.pow(2, attempt) * 50 + Math.random() * 25;
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            throw error; // Rethrow if not a concurrency issue
        }
    }
    
    // If we exhausted retries
    const conflictError = new Error('CONCURRENCY_CONFLICT: Maximum retries exhausted for optimistic update.');
    conflictError.status = 409;
    throw conflictError;
};

module.exports = { withOptimisticRetry };
