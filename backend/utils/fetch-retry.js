const logger = require('./logger');

/**
 * A fetch wrapper that implements retry logic with exponential backoff.
 * This is primarily intended to handle transient infrastructure errors (e.g., 525 SSL handshake failed from Cloudflare)
 * when interacting with the Supabase API.
 * 
 * @param {string|URL|Request} url The URL to fetch.
 * @param {RequestInit} [options] Fetch options.
 * @param {number} [retries=3] Maximum number of retries.
 * @param {number} [backoff=1000] Initial backoff delay in milliseconds.
 * @returns {Promise<Response>}
 */
const fetchWithRetry = async (url, options = {}, retries = 3, backoff = 1000) => {
    // If global fetch isn't available (e.g., older Node without generic fetch polyfill), 
    // supabase-js uses node-fetch or cross-fetch implicitly. We assume global.fetch is available in Node 18+.
    const nativeFetch = global.fetch;
    if (!nativeFetch) {
        throw new Error('global.fetch is not defined. Ensure you are running Node 18+ or importing a fetch polyfill.');
    }

    try {
        const response = await nativeFetch(url, options);

        // Retry on 5xx server errors (transient usually) or 429 Too Many Requests
        if (!response.ok && (response.status >= 500 || response.status === 429)) {
            if (retries > 0) {
                logger.warn({
                    status: response.status,
                    url: typeof url === 'string' ? url : url.toString(),
                    retriesLeft: retries - 1
                }, `Transient HTTP Error intercepted. Retrying in ${backoff}ms...`);

                // Wait for the backoff period
                await new Promise(resolve => setTimeout(resolve, backoff));

                // Exponential backoff
                return fetchWithRetry(url, options, retries - 1, backoff * 2);
            }
        }

        return response;
    } catch (error) {
        // Retry on network/system errors (e.g., connection reset, DNS failure)
        // System errors often map closely to fetch failures (TypeError/FetchError)
        const isNetworkError = error.name === 'TypeError' || error.message.includes('fetch');

        if (isNetworkError && retries > 0) {
            logger.warn({
                error: error.message,
                url: typeof url === 'string' ? url : url.toString(),
                retriesLeft: retries - 1
            }, `Network Error intercepted. Retrying in ${backoff}ms...`);

            // Wait for the backoff period
            await new Promise(resolve => setTimeout(resolve, backoff));

            // Exponential backoff
            return fetchWithRetry(url, options, retries - 1, backoff * 2);
        }

        // If out of retries or not a network/transient error, throw it
        throw error;
    }
};

module.exports = { fetchWithRetry };
