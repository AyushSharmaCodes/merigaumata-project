const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const { validateCoupon, calculateCouponDiscount, getCachedCoupon } = require('./coupon.service');
const settingsService = require('./settings.service');
const { DeliveryChargeService } = require('./delivery-charge.service');
const { CART, LOGS, COMMON, INVENTORY } = require('../constants/messages');
const { PricingCalculator } = require('./pricing-calculator.service');
const { applyTranslations } = require('../utils/i18n.util');
const { invalidateCheckoutSummaryCache } = require('./checkout-summary-cache.service');

const CART_CACHE_TTL_MS = Number(process.env.CART_CACHE_TTL_MS || 3000);
const cartCache = new Map();
const MAX_CART_CACHE_SIZE = 1000;

// Periodically evict expired entries so RAM is reclaimed quietly
const _cartCacheSweep = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of cartCache.entries()) {
        if (now >= entry.expiresAt) cartCache.delete(key);
    }
}, 60_000);
if (_cartCacheSweep.unref) _cartCacheSweep.unref();

const CART_PRODUCT_SELECT = `
    id,
    title,
    title_i18n,
    price,
    mrp,
    images,
    category,
    delivery_charge,
    inventory,
    default_tax_applicable,
    default_gst_rate,
    default_price_includes_tax,
    default_hsn_code
`;

const CART_VARIANT_SELECT = `
    id,
    size_label,
    size_label_i18n,
    selling_price,
    mrp,
    variant_image_url,
    delivery_charge,
    tax_applicable,
    gst_rate,
    price_includes_tax,
    hsn_code,
    stock_quantity,
    is_default
`;

const CART_SELECT = `
    id,
    user_id,
    guest_id,
    applied_coupon_code,
    updated_at,
    cart_items (
        id,
        product_id,
        variant_id,
        quantity,
        added_at,
        products (${CART_PRODUCT_SELECT}),
        product_variants (${CART_VARIANT_SELECT})
    )
`;

function buildCartCacheKey(userId, guestId, lang) {
    return `${userId || 'guest'}:${guestId || 'none'}:${lang || 'en'}`;
}

function getCachedCart(userId, guestId, lang) {
    const key = buildCartCacheKey(userId, guestId, lang);
    const cached = cartCache.get(key);
    if (!cached) return null;

    if (cached.expiresAt <= Date.now()) {
        cartCache.delete(key);
        return null;
    }

    return cached.value;
}

function setCachedCart(userId, guestId, lang, value) {
    if (cartCache.size >= MAX_CART_CACHE_SIZE) {
        // Enforce basic LRU eviction
        const firstKey = cartCache.keys().next().value;
        cartCache.delete(firstKey);
    }
    cartCache.set(buildCartCacheKey(userId, guestId, lang), {
        value,
        expiresAt: Date.now() + CART_CACHE_TTL_MS
    });
}

function invalidateCartCache(userId, guestId) {
    const keyPrefix = `${userId || 'guest'}:${guestId || 'none'}:`;
    for (const key of cartCache.keys()) {
        if (key.startsWith(keyPrefix)) {
            cartCache.delete(key);
        }
    }

    invalidateCheckoutSummaryCache({ userId: userId || null, guestId: guestId || null });
}

/**
 * Get delivery settings (hits DB via SettingsService)
 */
async function getCachedDeliverySettings() {
    return await settingsService.getDeliverySettings();
}

function invalidateDeliverySettingsCache() {
    // No-op as we removed in-memory cache for production robustness
}

async function validateMergedCartItems(itemsToUpsert) {
    const variantIds = itemsToUpsert.filter(item => item.variant_id).map(item => item.variant_id);
    const productIds = itemsToUpsert.filter(item => !item.variant_id).map(item => item.product_id);

    const [variantsResult, productsResult] = await Promise.all([
        variantIds.length > 0
            ? supabase.from('product_variants').select('id, stock_quantity').in('id', variantIds)
            : Promise.resolve({ data: [], error: null }),
        productIds.length > 0
            ? supabase.from('products').select('id, inventory').in('id', productIds)
            : Promise.resolve({ data: [], error: null })
    ]);

    if (variantsResult.error) throw variantsResult.error;
    if (productsResult.error) throw productsResult.error;

    const variantStock = new Map((variantsResult.data || []).map(variant => [variant.id, Number(variant.stock_quantity || 0)]));
    const productStock = new Map((productsResult.data || []).map(product => [product.id, Number(product.inventory || 0)]));

    const invalidItem = itemsToUpsert.find((item) => {
        const availableStock = item.variant_id
            ? variantStock.get(item.variant_id)
            : productStock.get(item.product_id);

        return availableStock === undefined || item.quantity > availableStock;
    });

    if (invalidItem) {
        const error = new Error(CART.INSUFFICIENT_STOCK);
        error.status = 409;
        throw error;
    }
}

/**
 * Get or create a cart for the user
 * @param {string} userId - User ID
 * @returns {Promise<object>} - Cart object with items
 */


/**
 * Cart Service
 * Handles all shopping cart operations including adding/removing items, coupon application, and total calculations
 */

/**
 * Get or create a cart for the user or guest
 * @param {string|null} userId - User ID (optional if guestId provided)
 * @param {string|null} guestId - Guest ID (optional if userId provided)
 * @param {Object} options
 * @param {boolean} options.createIfMissing - Whether to create a cart record when none exists
 * @returns {Promise<object>} - Cart object with items
 */
async function getUserCart(userId, guestId, { createIfMissing = true } = {}) {
    try {
        if (!userId && !guestId) throw new Error(CART.USER_GUEST_ID_REQUIRED);

        const lang = global.reqLanguage || 'en';
        const cachedCart = createIfMissing ? getCachedCart(userId, guestId, lang) : null;
        if (cachedCart) {
            return cachedCart;
        }

        let query = supabase.from('carts').select(CART_SELECT);

        if (userId) {
            query = query.eq('user_id', userId);
        } else {
            query = query.eq('guest_id', guestId).is('user_id', null);
        }

        let { data: cart, error } = await query.single();

        // If cart not found, create one when requested
        if (!cart && !error) {
            if (!createIfMissing) {
                return null;
            }
            // Logic to create cart
            const newCartData = userId ? { user_id: userId } : { guest_id: guestId };
            const { data: newCart, error: createError } = await supabase
                .from('carts')
                .insert(newCartData)
                .select()
                .single();

            if (createError) {
                // Handle concurrent creation (race condition)
                if (createError.code === '23505') { // Unique violation
                    // Retry fetch
                    return getUserCart(userId, guestId);
                }
                throw createError;
            }
            cart = newCart;
            cart.cart_items = [];
        } else if (error && error.code !== 'PGRST116') { // PGRST116 is "Row not found" (single() returns this if no rows)
            // Actually Supabase JS .single() returns error if no rows or multiple rows.
            // If error is null, cart exists. If error, check code.
            throw error;
        } else if (error && error.code === 'PGRST116') {
            if (!createIfMissing) {
                return null;
            }
            // Not found, create
            const newCartData = userId ? { user_id: userId } : { guest_id: guestId };
            const { data: newCart, error: createError } = await supabase
                .from('carts')
                .insert(newCartData)
                .select()
                .single();

            if (createError) {
                if (createError.code === '23505') return getUserCart(userId, guestId);
                throw createError;
            }
            cart = newCart;
            cart.cart_items = [];
        }

        // Ensure cart_items is an array
        if (!cart.cart_items) {
            cart.cart_items = [];
        }

        if (lang !== 'en') {
            cart.cart_items = applyTranslations(cart.cart_items, lang);
        }

        // Sort items locally
        cart.cart_items.sort((a, b) => new Date(a.added_at) - new Date(b.added_at));

        if (createIfMissing) {
            setCachedCart(userId, guestId, lang, cart);
        }
        return cart;
    } catch (error) {
        logger.error({ err: error, userId, guestId }, LOGS.CART_GET_ERROR);
        throw error;
    }
}

/**
 * Add an item to the cart
 * @param {string|null} userId 
 * @param {string|null} guestId
 * @param {string} productId 
 * @param {number} quantity 
 * @param {string} [variantId]
 */
/**
 * Add an item to the cart (Optimized via RPC)
 * @param {string|null} userId 
 * @param {string|null} guestId
 * @param {string} productId 
 * @param {number} quantity 
 * @param {string} [variantId]
 */
async function addToCart(userId, guestId, productId, quantity = 1, variantId = null) {
    try {
        logger.info({ userId, guestId, productId, quantity, variantId }, 'Adding item to cart (Optimized)');

        const { data: cart, error: rpcError } = await supabase.rpc('upsert_cart_item_v1', {
            p_user_id: userId || null,
            p_guest_id: guestId || null,
            p_product_id: productId,
            p_variant_id: variantId || null,
            p_quantity: quantity,
            p_mode: 'ADD'
        });

        if (rpcError) {
            logger.error({ err: rpcError }, 'UPSERT_CART_ITEM_RPC_FAILED');
            if (rpcError.message === 'INSUFFICIENT_STOCK') {
                throw new Error(CART.INSUFFICIENT_STOCK);
            }
            if (rpcError.message === 'PRODUCT_NOT_FOUND') {
                throw new Error(variantId ? CART.VARIANT_NOT_FOUND : CART.PRODUCT_NOT_FOUND);
            }
            throw rpcError;
        }

        invalidateCartCache(userId, guestId);
        
        // Re-apply translations if needed before returning
        const lang = global.reqLanguage || 'en';
        if (lang !== 'en' && cart.cart_items) {
            const { applyTranslations } = require('../utils/i18n.util');
            cart.cart_items = applyTranslations(cart.cart_items, lang);
        }

        return cart;
    } catch (error) {
        logger.error({ err: error }, LOGS.CART_ADD_ERROR);
        throw error;
    }
}

/**
 * Update cart item quantity
 */
async function updateCartItem(userId, guestId, productId, quantity, variantId = null) {
    try {
        if (quantity <= 0) {
            return removeFromCart(userId, guestId, productId, variantId);
        }

        logger.info({ userId, guestId, productId, quantity, variantId }, 'Updating cart item (Optimized)');

        const { data: cart, error: rpcError } = await supabase.rpc('upsert_cart_item_v1', {
            p_user_id: userId || null,
            p_guest_id: guestId || null,
            p_product_id: productId,
            p_variant_id: variantId || null,
            p_quantity: quantity,
            p_mode: 'SET'
        });

        if (rpcError) {
            logger.error({ err: rpcError }, 'UPDATE_CART_ITEM_RPC_FAILED');
            if (rpcError.message === 'INSUFFICIENT_STOCK') {
                throw new Error(CART.INSUFFICIENT_STOCK);
            }
            throw rpcError;
        }

        invalidateCartCache(userId, guestId);

        // Re-apply translations if needed
        const lang = global.reqLanguage || 'en';
        if (lang !== 'en' && cart.cart_items) {
            const { applyTranslations } = require('../utils/i18n.util');
            cart.cart_items = applyTranslations(cart.cart_items, lang);
        }

        return cart;
    } catch (error) {
        logger.error({ err: error }, LOGS.CART_UPDATE_ERROR);
        throw error;
    }
}

/**
 * Remove an item from the cart
 */
async function removeFromCart(userId, guestId, productId, variantId = null) {
    try {
        const cart = await getUserCart(userId, guestId);

        let query = supabase
            .from('cart_items')
            .delete()
            .eq('cart_id', cart.id)
            .eq('product_id', productId);

        if (variantId) {
            query = query.eq('variant_id', variantId);
        } else {
            query = query.is('variant_id', null);
        }

        const { error } = await query;
        if (error) throw error;

        invalidateCartCache(userId, guestId);
        return getUserCart(userId, guestId);
    } catch (error) {
        logger.error({ err: error }, LOGS.CART_REMOVE_ERROR);
        throw error;
    }
}

/**
 * Apply a coupon to the cart
 */
async function applyCouponToCart(userId, guestId, couponCode) {
    try {
        const cart = await getUserCart(userId, guestId);

        // Prepare cart items for validation
        const cartItems = cart.cart_items.map(item => ({
            product_id: item.product_id,
            quantity: item.quantity,
            variant_id: item.variant_id,
            product: item.products,
            variant: item.product_variants
        }));

        // Calculate cart total (considering variants)
        const cartTotal = cartItems.reduce((sum, item) => {
            const price = item.variant ? item.variant.selling_price : item.product.price;
            return sum + (price * item.quantity);
        }, 0);

        // Validate coupon
        const validation = await validateCoupon(couponCode, userId, cartItems, cartTotal);

        if (!validation.valid) {
            return { success: false, error: validation.error, cart };
        }

        // Update cart with coupon code
        const { error } = await supabase
            .from('carts')
            .update({ applied_coupon_code: couponCode.toUpperCase() })
            .eq('id', cart.id);

        if (error) throw error;

        invalidateCartCache(userId, guestId);
        const updatedCart = await getUserCart(userId, guestId);

        return {
            success: true,
            cart: updatedCart,
            coupon: validation.coupon,
            message: CART.COUPON_APPLIED
        };
    } catch (error) {
        logger.error({ err: error }, LOGS.CART_COUPON_APPLY_ERROR);
        throw error;
    }
}

/**
 * Remove coupon from cart
 */
async function removeCouponFromCart(userId, guestId) {
    try {
        const cart = await getUserCart(userId, guestId);

        const { error } = await supabase
            .from('carts')
            .update({ applied_coupon_code: null })
            .eq('id', cart.id);

        if (error) throw error;

        invalidateCartCache(userId, guestId);
        return await getUserCart(userId, guestId);
    } catch (error) {
        logger.error({ err: error }, LOGS.CART_COUPON_REMOVE_ERROR);
        throw error;
    }
}

/**
 * Calculate all cart totals including discounts and delivery
 * @param {string|null} userId
 * @param {string|null} guestId
 * @param {object|null} existingCart - Optional pre-fetched cart
 * @param {object} options - Optimization options
 * @param {boolean} options.skipValidation - If true, skip full coupon validation (use for quantity updates)
 */

// ... other imports

/**
 * Calculate all cart totals including discounts and delivery
 * Delegates completely to PricingCalculator for consistency
 * 
 * @param {string|null} userId
 * @param {string|null} guestId
 * @param {object|null} existingCart - Optional pre-fetched cart
 * @param {object} options - Optimization options
 * @param {boolean} options.skipValidation - If true, skip full coupon validation (pass through to Calculator if we add that flag later)
 */
async function calculateCartTotals(userId, guestId, existingCart = null, { skipValidation = false, addressId = null, prefetchedAddress = null } = {}) {
    // Sanitary check for circular dependency issues
    if (!PricingCalculator) {
        throw new Error('PricingCalculator Service is undefined. This suggests a circular dependency or import error.');
    }

    try {
        const cart = existingCart || await getUserCart(userId, guestId);

        // Normalize items for PricingCalculator
        // It expects { product_id, variant_id, quantity, product, variant }
        const normalizedItems = cart.cart_items.map(item => ({
            id: item.id,
            product_id: item.product_id,
            variant_id: item.variant_id,
            quantity: item.quantity,
            product: item.products,
            variant: item.product_variants
        }));

        // Resolve Shipping Address
        let shippingAddress = prefetchedAddress;
        if (!shippingAddress && addressId) {
            const { data: address } = await supabase
                .from('addresses')
                .select('*, phone_numbers(phone_number)')
                .eq('id', addressId)
                .maybeSingle();
            shippingAddress = address;
        }

        // Use the centralized PricingCalculator
        // This handles: MRP discounts, Coupons (Product, Cart, Free Delivery), Taxes, Delivery Charges
        const calculatorResult = await PricingCalculator.calculateCheckoutTotals(
            normalizedItems,
            shippingAddress, // Pass resolved shippingAddress (or null)
            cart.applied_coupon_code, // couponCode from cart
            userId, // userId for validation
            { skipCouponValidation: skipValidation }
        );

        // Map PricingCalculator result to CartTotals interface expected by Frontend
        // Frontend expects:
        /*
        interface CartTotals {
            itemsCount: number;
            totalMrp: number;
            totalPrice: number;
            discount: number;
            couponDiscount: number;
            deliveryCharge: number;
            deliveryGST: number;
            finalAmount: number;
            coupon: Coupon | null;
            itemBreakdown: Array<...>;
            deliverySettings: ...;
            tax: ...;
        }
        */

        // Delivery Breakdown - Use direct fields from PricingCalculator
        const totals = {
            itemsCount: calculatorResult.items_count,
            totalMrp: calculatorResult.total_mrp,
            totalPrice: calculatorResult.total_selling_price,
            discount: calculatorResult.mrp_discount,
            couponDiscount: calculatorResult.coupon_discount,

            // Delivery - Map from PricingCalculator response
            deliveryCharge: calculatorResult.delivery_charge,
            deliveryGST: calculatorResult.delivery_gst,
            globalDeliveryCharge: calculatorResult.global_delivery_charge,
            globalDeliveryGST: calculatorResult.global_delivery_gst,
            productDeliveryCharges: calculatorResult.product_delivery_charges,
            productDeliveryGST: calculatorResult.product_delivery_gst,

            finalAmount: calculatorResult.final_amount,

            // If PricingCalculator returns null, the coupon is either invalid or not present.
            // Only return the full verified coupon object to the frontend.
            coupon: calculatorResult.coupon || null,

            // Item Breakdown
            itemBreakdown: calculatorResult.items.map(item => ({
                product_id: item.product_id,
                variant_id: item.variant_id,
                quantity: item.quantity,
                mrp: item.unit_mrp,
                price: item.unit_price, // Original price
                discounted_price: item.discounted_unit_price,
                delivery_charge: item.delivery_charge || 0,
                delivery_gst: item.delivery_gst || 0,
                delivery_meta: item.delivery_meta,
                coupon_discount: item.coupon_discount,
                tax_breakdown: item.tax_breakdown,
                coupon_code: calculatorResult.coupon_code
            })),

            deliverySettings: calculatorResult.delivery_settings,
            items: calculatorResult.items, // Ensure full items (with tax/discount) are passed to checkout

            // Tax Breakdown
            tax: {
                totalTaxableAmount: calculatorResult.tax.total_taxable_amount,
                cgst: calculatorResult.tax.cgst,
                sgst: calculatorResult.tax.sgst,
                igst: calculatorResult.tax.igst,
                totalTax: calculatorResult.tax.total_tax,
                taxType: calculatorResult.tax.tax_type,
                isInterState: calculatorResult.tax.is_inter_state
            }
        };

        // Populate coupon details if active
        // Ideally PricingCalculator should return the full coupon object or we fetch it briefly
        if (cart.applied_coupon_code) {
            // If the PricingCalculator determined the coupon was invalid (coupon is null),
            // auto-heal the cart by removing the stale coupon code to prevent ghost coupons.
            if (!calculatorResult.coupon) {
                supabase.from('carts')
                    .update({ applied_coupon_code: null })
                    .eq('id', cart.id)
                    .then(({ error }) => {
                        if (error) {
                            logger.warn({ err: error, cartId: cart.id }, 'Failed to auto-heal invalid coupon from cart');
                            return;
                        }

                        invalidateCartCache(cart.user_id || null, cart.guest_id || null);
                    });
            }
        }

        return totals;

    } catch (error) {
        logger.error({ err: error }, LOGS.CART_TOTALS_ERROR);
        throw error;
    }
}

/**
 * Clear all items from the cart
 */
async function clearCart(userId, guestId) {
    try {
        const cart = await getUserCart(userId, guestId);

        const { error: deleteError } = await supabase
            .from('cart_items')
            .delete()
            .eq('cart_id', cart.id);

        if (deleteError) throw deleteError;

        const { error: updateError } = await supabase
            .from('carts')
            .update({ applied_coupon_code: null })
            .eq('id', cart.id);

        if (updateError) throw updateError;
        invalidateCartCache(userId, guestId);
    } catch (error) {
        logger.error({ err: error }, LOGS.CART_CLEAR_ERROR);
        throw error;
    }
}

/**
 * Merge guest cart into user cart
 * @param {string} userId
 * @param {string} guestId
 */
async function mergeGuestCart(userId, guestId) {
    if (!userId || !guestId) return;

    try {
        // Atomic RPC call handles validation, merging, coupon logic, and cleanup in one transaction.
        const { data, error } = await supabase.rpc('merge_guest_into_user_cart', {
            p_user_id: userId,
            p_guest_id: guestId
        });

        if (error) {
            // Check for specific error codes from the RPC if needed
            if (error.message?.includes('INSUFFICIENT_STOCK')) {
                logger.warn({ userId, guestId }, 'Atomic cart merge failed: Insufficient stock for merged items');
            }
            throw error;
        }

        invalidateCartCache(null, guestId);
        invalidateCartCache(userId, null);
        
        logger.info({ 
            userId, 
            guestId, 
            mergedItems: data?.mergedItemCount,
            guestCouponApplied: data?.couponTransferred
        }, LOGS.CART_MERGE_SUCCESS);

        return getUserCart(userId, null);
    } catch (error) {
        logger.error({ err: error, userId, guestId }, LOGS.CART_MERGE_ERROR);
        // Don't throw, just log. Merging failure shouldn't block login.
    }
}

module.exports = {
    getUserCart,
    addToCart,
    updateCartItem,
    removeFromCart,
    applyCouponToCart,
    removeCouponFromCart,
    calculateCartTotals,
    clearCart,
    mergeGuestCart,
    invalidateDeliverySettingsCache,
    invalidateCartCache
};
