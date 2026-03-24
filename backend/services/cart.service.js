const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const { validateCoupon, calculateCouponDiscount, getCachedCoupon } = require('./coupon.service');
const settingsService = require('./settings.service');
const { DeliveryChargeService } = require('./delivery-charge.service');
const { CART, LOGS, COMMON, INVENTORY } = require('../constants/messages');
const { PricingCalculator } = require('./pricing-calculator.service');
const { applyTranslations } = require('../utils/i18n.util');

/**
 * Get delivery settings (hits DB via SettingsService)
 */
async function getCachedDeliverySettings() {
    return await settingsService.getDeliverySettings();
}

function invalidateDeliverySettingsCache() {
    // No-op as we removed in-memory cache for production robustness
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
 * @returns {Promise<object>} - Cart object with items
 */
async function getUserCart(userId, guestId) {
    try {
        if (!userId && !guestId) throw new Error(CART.USER_GUEST_ID_REQUIRED);

        let query = supabase.from('carts').select(`
            *,
            cart_items (
                id,
                product_id,
                variant_id,
                quantity,
                added_at,
                products (*),
                product_variants (*)
            )
        `);

        if (userId) {
            query = query.eq('user_id', userId);
        } else {
            query = query.eq('guest_id', guestId).is('user_id', null);
        }

        let { data: cart, error } = await query.single();

        // If cart not found, create one
        if (!cart && !error) {
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

        // Localize Variants
        const lang = global.reqLanguage || 'en';
        cart.cart_items = applyTranslations(cart.cart_items, lang);

        // Sort items locally
        cart.cart_items.sort((a, b) => new Date(a.added_at) - new Date(b.added_at));

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
async function addToCart(userId, guestId, productId, quantity = 1, variantId = null) {
    try {
        const cart = await getUserCart(userId, guestId);

        // Stock validation - check available stock before adding
        let availableStock = 0;
        let productTitle = INVENTORY.DEFAULT_PRODUCT_TITLE;

        if (variantId) {
            // Check variant stock
            const { data: variant, error: variantError } = await supabase
                .from('product_variants')
                .select('stock_quantity, size_label, products(title)')
                .eq('id', variantId)
                .single();

            if (variantError || !variant) {
                throw new Error(CART.VARIANT_NOT_FOUND);
            }
            availableStock = variant.stock_quantity || 0;
            productTitle = `${variant.products?.title || INVENTORY.DEFAULT_PRODUCT_TITLE} - ${variant.size_label}`;
        } else {
            // Check product inventory
            const { data: product, error: productError } = await supabase
                .from('products')
                .select('inventory, title')
                .eq('id', productId)
                .single();

            if (productError || !product) {
                throw new Error(CART.PRODUCT_NOT_FOUND);
            }
            availableStock = product.inventory || 0;
            productTitle = product.title;
        }

        // Check if item already exists in cart to calculate total quantity
        const existingItem = cart.cart_items.find(item =>
            item.product_id === productId &&
            (item.variant_id === variantId || (!item.variant_id && !variantId))
        );

        const currentCartQty = existingItem ? existingItem.quantity : 0;
        const requestedTotal = currentCartQty + quantity;

        if (requestedTotal > availableStock) {
            throw new Error(CART.INSUFFICIENT_STOCK);
        }

        if (existingItem) {
            // Update quantity
            return updateCartItem(userId, guestId, productId, existingItem.quantity + quantity, variantId);
        }

        // Insert new item
        const { error } = await supabase
            .from('cart_items')
            .insert({
                cart_id: cart.id,
                product_id: productId,
                quantity: quantity,
                variant_id: variantId
            });

        if (error) throw error;

        return getUserCart(userId, guestId);
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
        const cart = await getUserCart(userId, guestId);

        if (quantity <= 0) {
            return removeFromCart(userId, guestId, productId, variantId);
        }

        // Stock validation - check available stock before updating
        let availableStock = 0;
        let productTitle = INVENTORY.DEFAULT_PRODUCT_TITLE;

        if (variantId) {
            // Check variant stock
            const { data: variant, error: variantError } = await supabase
                .from('product_variants')
                .select('stock_quantity, size_label, products(title)')
                .eq('id', variantId)
                .single();

            if (variantError || !variant) {
                throw new Error(CART.VARIANT_NOT_FOUND);
            }
            availableStock = variant.stock_quantity || 0;
            productTitle = `${variant.products?.title || INVENTORY.DEFAULT_PRODUCT_TITLE} - ${variant.size_label}`;
        } else {
            // Check product inventory
            const { data: product, error: productError } = await supabase
                .from('products')
                .select('inventory, title')
                .eq('id', productId)
                .single();

            if (productError || !product) {
                throw new Error(CART.PRODUCT_NOT_FOUND);
            }
            availableStock = product.inventory || 0;
            productTitle = product.title;
        }

        if (quantity > availableStock) {
            throw new Error(CART.INSUFFICIENT_STOCK);
        }

        // Find match to get ID (safe update) or update by composite key if permitted
        // We'll update by cart_id + product_id + variant_id
        let query = supabase
            .from('cart_items')
            .update({ quantity })
            .eq('cart_id', cart.id)
            .eq('product_id', productId);

        if (variantId) {
            query = query.eq('variant_id', variantId);
        } else {
            query = query.is('variant_id', null);
        }

        const { error } = await query;

        if (error) throw error;

        return getUserCart(userId, guestId);
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
async function calculateCartTotals(userId, guestId, existingCart = null, { skipValidation = false, addressId = null } = {}) {
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

        // Fetch Shipping Address if addressId is provided
        let shippingAddress = null;
        if (addressId) {
            const { data: address } = await supabase
                .from('addresses')
                .select('*, phone_numbers(phone_number)')
                .eq('id', addressId)
                .single();
            shippingAddress = address;
        }

        // Use the centralized PricingCalculator
        // This handles: MRP discounts, Coupons (Product, Cart, Free Delivery), Taxes, Delivery Charges
        const calculatorResult = await PricingCalculator.calculateCheckoutTotals(
            normalizedItems,
            shippingAddress, // Pass resolved shippingAddress (or null)
            cart.applied_coupon_code, // couponCode from cart
            userId // userId for validation
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
                delivery_charge: item.delivery_charge || 0,
                delivery_gst: item.delivery_gst || 0,
                delivery_meta: item.delivery_meta,
                coupon_discount: item.coupon_discount,
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
                        if (error) logger.warn({ err: error, cartId: cart.id }, 'Failed to auto-heal invalid coupon from cart');
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
        // 1. Get Guest Cart
        const guestCart = await getUserCart(null, guestId);
        if (!guestCart || guestCart.cart_items.length === 0) return;

        // 2. Get (or create) User Cart
        const userCart = await getUserCart(userId, null);

        // 3. Merge Items In-Memory
        const guestItems = guestCart.cart_items || [];
        const userItems = userCart.cart_items || [];
        
        // Final merged items for the user cart
        const itemsToUpsert = [];
        
        // Map user items by product+variant for easy lookup
        const userItemMap = new Map();
        userItems.forEach(item => {
            const key = `${item.product_id}_${item.variant_id || 'base'}`;
            userItemMap.set(key, item);
        });

        // Merge guest items into the map
        guestItems.forEach(item => {
            const key = `${item.product_id}_${item.variant_id || 'base'}`;
            const existing = userItemMap.get(key);
            
            if (existing) {
                // Combine quantities (limit logic could be added here if needed)
                existing.quantity += item.quantity;
            } else {
                // Add new item (strip extra fields like products/product_variants before upsert)
                userItemMap.set(key, {
                    cart_id: userCart.id,
                    product_id: item.product_id,
                    variant_id: item.variant_id,
                    quantity: item.quantity
                });
            }
        });

        // Convert map back to array for bulk upsert
        // Important: We only pass the fields that belong to cart_items table
        for (const item of userItemMap.values()) {
            itemsToUpsert.push({
                cart_id: userCart.id,
                product_id: item.product_id,
                variant_id: item.variant_id,
                quantity: item.quantity
            });
        }

        // 4. Perform Bulk Operations
        if (itemsToUpsert.length > 0) {
            // Bulk Upsert: This uses the unique constraint on (cart_id, product_id, variant_id)
            const { error: upsertError } = await supabase
                .from('cart_items')
                .upsert(itemsToUpsert, { 
                    onConflict: 'cart_id, product_id, variant_id',
                    ignoreDuplicates: false 
                });
            
            if (upsertError) throw upsertError;
        }

        // 5. Merge Coupon (if user has none but guest does)
        if (guestCart.applied_coupon_code && !userCart.applied_coupon_code) {
            await supabase
                .from('carts')
                .update({ applied_coupon_code: guestCart.applied_coupon_code })
                .eq('id', userCart.id);
        }

        // 6. Cleanup Guest Cart (Bulk)
        // Clear guest items first
        const { error: clearError } = await supabase
            .from('cart_items')
            .delete()
            .eq('cart_id', guestCart.id);
            
        if (clearError) logger.warn({ err: clearError }, 'Failed to clear guest cart items during merge');
        
        // Delete guest cart record
        await supabase.from('carts').delete().eq('id', guestCart.id);

        logger.info({ userId, guestId, mergedItems: itemsToUpsert.length }, LOGS.CART_MERGE_SUCCESS);
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
    invalidateDeliverySettingsCache
};
