/**
 * Coupon Service
 * Handles all coupon-related business logic including validation, discount calculation, and usage tracking
 */
const supabase = require('../lib/supabase');
const logger = require('../utils/logger');
const { rememberForRequest } = require('../utils/request-cache');

// In-memory cache for coupon rules (TTL: 60s)
const couponCache = new Map();
const CACHE_TTL = 60 * 1000;

// Cache for active coupons list (TTL: 5 minutes)
const activeCouponsCache = {
    data: null,
    timestamp: 0,
    ttl: 5 * 60 * 1000 // 5 minutes
};

const CouponMessages = require('../constants/messages/CouponMessages');
const { LOGS } = require('../constants/messages');

/**
 * Get priority weight for a coupon type
 * VARIANT (4) > PRODUCT (3) > CATEGORY (2) > CART (1) > FREE_DELIVERY (0)
 */
function getCouponPriority(type) {
    const priorities = {
        'variant': 4,
        'product': 3,
        'category': 2,
        'cart': 1,
        'free_delivery': 0  // Lowest priority - applies to delivery, not products
    };
    return priorities[type] || 0;
}

/**
 * Clear a specific coupon from the cache
 * Also invalidates the active coupons list cache
 */
function invalidateCouponCache(code) {
    if (code) {
        couponCache.delete(code.toUpperCase());
    }
    // Invalidate active coupons list whenever any coupon is modified
    activeCouponsCache.data = null;
    activeCouponsCache.timestamp = 0;
}

/**
 * Periodic cache cleanup (removes entries older than TTL)
 */
const couponCacheCleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, value] of couponCache.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
            couponCache.delete(key);
        }
    }
}, 5 * 60 * 1000); // Run every 5 minutes

if (typeof couponCacheCleanupInterval.unref === 'function') {
    couponCacheCleanupInterval.unref();
}

/**
 * Get a coupon from cache or database (without full validation)
 * Used for quick discount recalculations when quantity changes
 * @param {string} code - Coupon code
 * @returns {Promise<object|null>} - Coupon object or null
 */
async function getCachedCoupon(code) {
    if (!code || typeof code !== 'string') return null;

    const cacheKey = code.toUpperCase();
    return rememberForRequest(`coupon:${cacheKey}:cached`, async () => {
        const now = Date.now();

        if (couponCache.has(cacheKey)) {
            const cached = couponCache.get(cacheKey);
            if (now - cached.timestamp < CACHE_TTL) {
                return cached.data;
            }
            couponCache.delete(cacheKey);
        }

        const { data, error } = await supabase
            .from('coupons')
            .select('*')
            .ilike('code', cacheKey)
            .single();

        if (error || !data) return null;

        couponCache.set(cacheKey, {
            data,
            timestamp: now
        });

        return data;
    });
}

async function fetchCouponByCode(code, { forceLive = false } = {}) {
    const normalizedCode = String(code || '').toUpperCase();
    if (!normalizedCode) return null;

    const requestKey = `coupon:${normalizedCode}:${forceLive ? 'live' : 'normal'}`;

    return rememberForRequest(requestKey, async () => {
        const now = Date.now();

        if (!forceLive && couponCache.has(normalizedCode)) {
            const cached = couponCache.get(normalizedCode);
            if (now - cached.timestamp < CACHE_TTL) {
                return cached.data;
            }
            couponCache.delete(normalizedCode);
        }

        const { data, error } = await supabase
            .from('coupons')
            .select('*')
            .ilike('code', normalizedCode)
            .single();

        if (error || !data) return null;

        couponCache.set(normalizedCode, {
            data,
            timestamp: now
        });

        return data;
    });
}

/**
 * Validate if a coupon can be applied to the given cart
 * @param {string} code - Coupon code
 * @param {string} userId - User ID
 * @param {Array} cartItems - Array of cart items with product details
 * @param {number} cartTotal - Total cart value before discount
 * @param {boolean} forceLive - If true, skip cache (defaults to false)
 * @returns {Promise<{valid: boolean, coupon?: object, error?: string}>}
 */
async function validateCoupon(code, userId, cartItems, cartTotal, forceLive = false) {
    try {
        if (!code || typeof code !== 'string') {
            return { valid: false, error: CouponMessages.COUPON_REQUIRED };
        }

        const coupon = await fetchCouponByCode(code, { forceLive });

        if (!coupon) {
            return { valid: false, error: CouponMessages.INVALID_COUPON };
        }

        // Check if coupon is active
        if (!coupon.is_active) {
            return { valid: false, error: CouponMessages.COUPON_INACTIVE };
        }

        // Check expiry date
        const currentDate = new Date();
        const validFrom = new Date(coupon.valid_from);
        const validUntil = new Date(coupon.valid_until);

        if (currentDate < validFrom) {
            return { valid: false, error: CouponMessages.COUPON_NOT_STARTED };
        }

        if (currentDate > validUntil) {
            return { valid: false, error: CouponMessages.COUPON_EXPIRED };
        }

        // Check usage limit
        if (coupon.usage_limit !== null && coupon.usage_count >= coupon.usage_limit) {
            return { valid: false, error: CouponMessages.COUPON_LIMIT_REACHED };
        }

        // Check minimum purchase amount (except for free_delivery)
        if (coupon.type !== 'free_delivery' && coupon.min_purchase_amount && cartTotal < coupon.min_purchase_amount) {
            return {
                valid: false,
                error: CouponMessages.COUPON_MIN_PURCHASE,
                errorParams: { minAmount: coupon.min_purchase_amount }
            };
        }

        // Type-specific validation
        if (coupon.type === 'variant') {
            // Check if the specific variant is in the cart
            const hasVariant = cartItems.some(item => item.variant_id && item.variant_id === coupon.target_id);
            if (!hasVariant) {
                return { valid: false, error: CouponMessages.COUPON_VARIANT_MISMATCH };
            }
        }

        if (coupon.type === 'product') {
            // Check if the specific product is in the cart
            const hasProduct = cartItems.some(item => item.product_id === coupon.target_id);
            if (!hasProduct) {
                return { valid: false, error: CouponMessages.COUPON_PRODUCT_MISMATCH };
            }
        }

        if (coupon.type === 'category') {
            // Check if any product from the category is in the cart
            const hasCategory = cartItems.some(item => item.product && item.product.category === coupon.target_id);
            if (!hasCategory) {
                return {
                    valid: false,
                    error: CouponMessages.COUPON_CATEGORY_MISMATCH,
                    errorParams: { category: coupon.target_id }
                };
            }
        }

        if (coupon.type === 'free_delivery') {
            // Free delivery applies to all orders - no specific validation needed
            // Just ensure cart is not empty (already validated by caller)
            return { valid: true, coupon, priority: getCouponPriority(coupon.type) };
        }

        return { valid: true, coupon, priority: getCouponPriority(coupon.type) };
    } catch (error) {
        logger.error({ err: error, code }, LOGS.COUPON_VALIDATION_ERROR);
        return { valid: false, error: error.message || CouponMessages.VALIDATION_FAILED };
    }
}

/**
 * Calculate discount breakdown based on coupon type and cart items
 * @param {object} coupon - Coupon object
 * @param {Array} cartItems - Array of cart items with product details
 * @param {number} cartTotal - Total cart value (sum of item prices)
 * @returns {Object} - { totalDiscount, itemDiscounts: [{variant_id, product_id, discount, coupon_code}] }
 */
function calculateCouponDiscount(coupon, cartItems, cartTotal) {
    let totalDiscount = 0;
    const itemDiscounts = [];

    if (coupon.type === 'cart') {
        // Apply to entire cart (weighted distribution or flat on total)
        // For simplicity and matching current logic, we apply to total
        totalDiscount = (cartTotal * coupon.discount_percentage) / 100;

        if (coupon.max_discount_amount && totalDiscount > coupon.max_discount_amount) {
            totalDiscount = coupon.max_discount_amount;
        }

        // Distribute the cart discount proportionally across all items
        cartItems.forEach(item => {
            // Defensive: ensure price is never undefined
            const price = (item.variant?.selling_price ?? item.product?.price ?? 0);
            const quantity = item.quantity || 1;
            const itemSubtotal = price * quantity;
            const itemProportion = cartTotal > 0 ? (itemSubtotal / cartTotal) : 0;
            const itemDiscount = Math.round((totalDiscount * itemProportion) * 100) / 100;

            itemDiscounts.push({
                variant_id: item.variant_id || null,
                product_id: item.product_id,
                discount: itemDiscount,
                coupon_code: coupon.code,
                coupon_id: coupon.id,
                type: 'cart'
            });
        });
    } else if (coupon.type === 'variant' || coupon.type === 'product') {
        // Apply only to the specific variant or product
        cartItems.forEach(item => {
            const matches = (coupon.type === 'variant' && item.variant_id === coupon.target_id) ||
                (coupon.type === 'product' && item.product_id === coupon.target_id);

            if (matches) {
                // Defensive: ensure price is never undefined
                const price = (item.variant?.selling_price ?? item.product?.price ?? 0);
                const quantity = item.quantity || 1;
                const itemSubtotal = price * quantity;
                let discount = (itemSubtotal * coupon.discount_percentage) / 100;

                if (coupon.max_discount_amount && discount > coupon.max_discount_amount) {
                    discount = coupon.max_discount_amount;
                }

                const roundedDiscount = Math.round(discount * 100) / 100;
                totalDiscount += roundedDiscount;

                itemDiscounts.push({
                    variant_id: item.variant_id || null,
                    product_id: item.product_id,
                    discount: roundedDiscount,
                    coupon_code: coupon.code,
                    coupon_id: coupon.id,
                    type: coupon.type
                });
            }
        });
    } else if (coupon.type === 'category') {
        // Apply to all products in the category
        cartItems.forEach(item => {
            if (item.product && item.product.category === coupon.target_id) {
                const price = item.variant ? item.variant.selling_price : item.product.price;
                const itemSubtotal = price * item.quantity;
                let discount = (itemSubtotal * coupon.discount_percentage) / 100;

                // Note: Currently, the system seems to apply max_discount_amount per coupon application.
                // If it's category-wide, does max_discount_amount apply to the sum or per item?
                // Standard behavior is per coupon application (on the sum of eligible items).
                // I'll calculate total eligible first to apply max cap correctly.
            }
        });

        const eligibleItems = cartItems.filter(item => item.product && item.product.category === coupon.target_id);
        const eligibleTotal = eligibleItems.reduce((sum, item) => {
            // Defensive: ensure price is never undefined
            const price = (item.variant?.selling_price ?? item.product?.price ?? 0);
            const quantity = item.quantity || 1;
            return sum + (price * quantity);
        }, 0);

        let categoryTotalDiscount = (eligibleTotal * coupon.discount_percentage) / 100;
        if (coupon.max_discount_amount && categoryTotalDiscount > coupon.max_discount_amount) {
            categoryTotalDiscount = coupon.max_discount_amount;
        }

        totalDiscount = Math.round(categoryTotalDiscount * 100) / 100;

        // Distribute the category discount proportionally across eligible items
        eligibleItems.forEach(item => {
            // Defensive: ensure price is never undefined
            const price = (item.variant?.selling_price ?? item.product?.price ?? 0);
            const quantity = item.quantity || 1;
            const itemSubtotal = price * quantity;
            const itemProportion = eligibleTotal > 0 ? (itemSubtotal / eligibleTotal) : 0;
            const itemDiscount = Math.round((totalDiscount * itemProportion) * 100) / 100;

            itemDiscounts.push({
                variant_id: item.variant_id || null,
                product_id: item.product_id,
                discount: itemDiscount,
                coupon_code: coupon.code,
                coupon_id: coupon.id,
                type: 'category'
            });
        });
    } else if (coupon.type === 'free_delivery') {
        // Free delivery is handled separately in pricing calculator
        // No product discount to calculate here
        totalDiscount = 0;
    }

    return {
        totalDiscount: Math.round(totalDiscount * 100) / 100,
        itemDiscounts
    };
}

/**
 * Increment the usage count for a coupon
 * @param {string} couponId - Coupon ID
 */
async function incrementUsageCount(couponId) {
    try {
        const { error } = await supabase.rpc('increment_coupon_usage', { p_coupon_id: couponId });

        if (error) {
            logger.error({ err: error }, LOGS.COUPON_USAGE_RECORD_ERROR);
        }
    } catch (error) {
        logger.error({ err: error }, LOGS.COUPON_USAGE_RECORD_ERROR);
    }
}

/**
 * Get all active, non-expired coupons for promotional banners
 * CACHED: 5-minute TTL to reduce database load
 * NOTE: This cache is for DISPLAY purposes only. Payment-time coupon validation
 * always uses forceLive=true to check database directly (see createOrder function).
 * @returns {Promise<Array>} - Array of active coupons
 */
async function getActiveCoupons() {
    try {
        // Check cache first
        const now = Date.now();
        if (activeCouponsCache.data && (now - activeCouponsCache.timestamp < activeCouponsCache.ttl)) {
            logger.debug(LOGS.COUPON_CACHE_HIT);
            return activeCouponsCache.data;
        }

        // Cache miss - fetch from database
        const currentTime = new Date().toISOString();

        const { data: coupons, error } = await supabase
            .from('coupons')
            .select('*')
            .eq('is_active', true)
            .lte('valid_from', currentTime)
            .gte('valid_until', currentTime)
            .order('created_at', { ascending: false });

        if (error) {
            logger.error({ err: error }, 'Error fetching active coupons from database:');
            throw error;
        }

        if (!coupons || coupons.length === 0) {
            activeCouponsCache.data = [];
            activeCouponsCache.timestamp = now;
            return [];
        }

        // Parallel enrichment of product and variant names
        const productIds = coupons.filter(c => c.type === 'product' && c.target_id).map(c => c.target_id);
        const variantIds = coupons.filter(c => c.type === 'variant' && c.target_id).map(c => c.target_id);

        const [productsRes, variantsRes] = await Promise.all([
            productIds.length > 0
                ? supabase.from('products').select('id, title').in('id', productIds)
                : Promise.resolve({ data: [] }),
            variantIds.length > 0
                ? supabase.from('product_variants').select('id, size_label, products:product_id(title)').in('id', variantIds)
                : Promise.resolve({ data: [] })
        ]);

        if (productsRes.error) logger.error('productsRes error:', productsRes.error);
        if (variantsRes.error) logger.error('variantsRes error:', variantsRes.error);

        const productMap = new Map((productsRes.data || []).map(p => [p.id, p.title]));
        const variantMap = new Map((variantsRes.data || []).map(v => [
            v.id,
            v.products?.title ? `${v.products.title} (${v.size_label})` : v.size_label
        ]));

        logger.info({
            total_active: coupons.length,
            product_names: productMap.size,
            variant_names: variantMap.size
        }, LOGS.COUPON_FETCH_ACTIVE);

        // Filter and enrich coupons with target names
        const availableCoupons = coupons.filter(coupon => {
            const hasLimit = coupon.usage_limit !== null;
            const isWithinLimit = !hasLimit || (coupon.usage_count < coupon.usage_limit);

            if (!isWithinLimit) {
                logger.info({
                    code: coupon.code,
                    usage: coupon.usage_count,
                    limit: coupon.usage_limit
                }, LOGS.COUPON_EXCLUDED_LIMIT);
            }

            return isWithinLimit;
        }).map(coupon => {
            // Add descriptive name based on type
            let targetName = '';
            if (coupon.type === 'product') {
                targetName = productMap.get(coupon.target_id) || '';
            } else if (coupon.type === 'variant') {
                targetName = variantMap.get(coupon.target_id) || '';
            }

            return {
                ...coupon,
                target_name: targetName
            };
        });

        // Update cache
        activeCouponsCache.data = availableCoupons;
        activeCouponsCache.timestamp = now;
        logger.info({
            available: availableCoupons.length,
            codes: availableCoupons.map(c => c.code)
        }, LOGS.COUPON_ACTIVE_RETURN);

        return availableCoupons;
    } catch (error) {
        logger.error({ err: error }, LOGS.COUPON_GET_ACTIVE_ERROR);
        return [];
    }
}

/**
 * Record coupon usage in the tracking table
 * @param {string} couponId - Coupon ID
 * @param {string} userId - User ID
 * @param {string} orderId - Order ID
 * @param {number} discountApplied - Discount amount
 */
async function recordCouponUsage(couponId, userId, orderId, discountApplied) {
    try {
        const { error } = await supabase
            .from('coupon_usage')
            .insert([{
                coupon_id: couponId,
                user_id: userId,
                order_id: orderId,
                discount_applied: discountApplied
            }]);

        if (error) {
            logger.error({ err: error }, LOGS.COUPON_USAGE_RECORD_ERROR);
        }
    } catch (error) {
        logger.error({ err: error }, LOGS.COUPON_USAGE_RECORD_ERROR);
    }
}

module.exports = {
    validateCoupon,
    calculateCouponDiscount,
    incrementUsageCount,
    getActiveCoupons,
    recordCouponUsage,
    getCouponPriority,
    invalidateCouponCache,
    getCachedCoupon
};
