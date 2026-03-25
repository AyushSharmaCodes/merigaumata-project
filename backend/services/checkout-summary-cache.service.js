const CHECKOUT_SUMMARY_CACHE_TTL_MS = parseInt(process.env.CHECKOUT_SUMMARY_CACHE_TTL_MS || '3000', 10);
const summaryCache = new Map();

function buildCheckoutSummaryCacheKey({ userId = null, guestId = null, addressId = null, language = 'en' } = {}) {
    return JSON.stringify({
        userId: userId || null,
        guestId: guestId || null,
        addressId: addressId || null,
        language: language || 'en'
    });
}

function getCheckoutSummaryCache({ userId = null, guestId = null, addressId = null, language = 'en' } = {}) {
    const key = buildCheckoutSummaryCacheKey({ userId, guestId, addressId, language });
    const cached = summaryCache.get(key);

    if (!cached) return null;
    if (cached.expiresAt <= Date.now()) {
        summaryCache.delete(key);
        return null;
    }

    return cached.value;
}

function setCheckoutSummaryCache({ userId = null, guestId = null, addressId = null, language = 'en' } = {}, value) {
    const key = buildCheckoutSummaryCacheKey({ userId, guestId, addressId, language });
    summaryCache.set(key, {
        value,
        expiresAt: Date.now() + CHECKOUT_SUMMARY_CACHE_TTL_MS
    });
}

function invalidateCheckoutSummaryCache({ userId = null, guestId = null } = {}) {
    for (const key of summaryCache.keys()) {
        try {
            const parsed = JSON.parse(key);
            const sameUser = userId ? parsed.userId === userId : true;
            const sameGuest = guestId ? parsed.guestId === guestId : true;

            if (sameUser && sameGuest) {
                summaryCache.delete(key);
            }
        } catch {
            summaryCache.delete(key);
        }
    }
}

module.exports = {
    buildCheckoutSummaryCacheKey,
    getCheckoutSummaryCache,
    setCheckoutSummaryCache,
    invalidateCheckoutSummaryCache
};
