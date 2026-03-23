const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const { requestLock } = require('../middleware/requestLock.middleware');
const { idempotency } = require('../middleware/idempotency.middleware');
const validate = require('../middleware/validate.middleware');
const { authenticateToken } = require('../middleware/auth.middleware');
const { createPaymentOrderSchema, verifyPaymentSchema } = require('../schemas/checkout.schema');
const {
    getCheckoutSummary,
    createRazorpayInvoice,
    createPaymentRecord,
    processPaymentAndOrder,
    getBuyNowSummary,
    processBuyNowOrder
} = require('../services/checkout.service');
const { getUserCart, calculateCartTotals } = require('../services/cart.service');
const { validateCoupon } = require('../services/coupon.service');
const supabase = require('../config/supabase');
const CheckoutMessages = require('../constants/messages/CheckoutMessages');
const AuthMessages = require('../constants/messages/AuthMessages');
const { getAddressById, getPrimaryAddress } = require('../services/address.service');

/**
 * Checkout Routes
 * Handle checkout flow, Razorpay payment, and order creation
 */

// Apply authentication to all checkout routes
router.use(authenticateToken);

// Helper to get User ID or Guest ID
const getContextIds = (req) => {
    const userId = req.user?.id;
    // Guest ID from header (x-guest-id) or cookie (guest_id)
    const guestId = req.headers['x-guest-id'] || req.cookies?.guest_id;
    return { userId, guestId };
};

// Helper to get User ID
const getUserId = (req) => req.user?.id;

// Get checkout summary (cart + addresses + totals)
router.get('/summary', async (req, res) => {
    try {
        const { userId, guestId } = getContextIds(req);
        const { addressId } = req.query;

        if (!userId && !guestId) {
            return res.status(401).json({ error: req.t('errors.auth.authenticationRequired') });
        }

        const summary = await getCheckoutSummary(userId, guestId, addressId);

        // PHASE 2B OPTIMIZATION: Include Razorpay key in summary (one less data point in payment order response)
        summary.razorpay_key_id = process.env.RAZORPAY_KEY_ID;

        res.json(summary);
    } catch (error) {
        logger.error({ err: error }, 'Error fetching checkout summary:');
        res.status(500).json({ error: error.message });
    }
});

// Validate stock availability for all cart items before payment
// Returns list of items with insufficient stock
router.get('/validate-stock', async (req, res) => {
    try {
        const { userId, guestId } = getContextIds(req);
        const { addressId } = req.query; // Extract selected address if any

        if (!userId && !guestId) {
            return res.status(401).json({ error: req.t('errors.auth.authenticationRequired') });
        }

        const summary = await getCheckoutSummary(userId, guestId, addressId);
        const cart = summary.cart; // Extract cart from the summary

        if (!cart || !cart.cart_items || cart.cart_items.length === 0) {
            return res.json({ valid: true, items: [] });
        }

        const stockIssues = [];

        for (const item of cart.cart_items) {
            const variantId = item.variant_id;
            const productId = item.product_id;
            const requestedQty = item.quantity;

            let availableStock = 0;
            let productTitle = item.products?.title || 'Product';
            let variantLabel = null;

            if (variantId) {
                // Check variant stock
                const { data: variant } = await supabase
                    .from('product_variants')
                    .select('stock_quantity, size_label')
                    .eq('id', variantId)
                    .single();

                availableStock = variant?.stock_quantity || 0;
                variantLabel = variant?.size_label;
            } else {
                // Check product inventory
                const { data: product } = await supabase
                    .from('products')
                    .select('inventory')
                    .eq('id', productId)
                    .single();

                availableStock = product?.inventory || 0;
            }

            if (requestedQty > availableStock) {
                stockIssues.push({
                    productId,
                    variantId,
                    title: productTitle,
                    variantLabel,
                    requestedQty,
                    availableStock,
                    image: item.products?.images?.[0] || null
                });
            }
        }

        res.json({
            valid: stockIssues.length === 0,
            items: stockIssues
        });
    } catch (error) {
        logger.error({ err: error }, 'Error validating stock:');
        res.status(500).json({ error: error.message });
    }
});

// Create Razorpay INVOICE (replaces Order)
// Protected by request lock and idempotency to prevent duplicate invoices
// NOW INCLUDES INLINE STOCK VALIDATION (Phase 2B Optimization)
router.post('/create-payment-order', validate(createPaymentOrderSchema), requestLock('create-payment-order'), idempotency(), async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: AuthMessages.AUTHENTICATION_REQUIRED });
        }


        // PHASE 3A OPTIMIZATION: Use profile from request body if provided (from summary)
        // Fallback to database fetch for backward compatibility
        let profile = req.body.user_profile;
        if (!profile) {
            const { data: fetchedProfile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();
            profile = fetchedProfile;
        }

        if (!profile) {
            return res.status(404).json({ error: CheckoutMessages.ACCOUNT_NOT_FOUND });
        }

        // 2. Get Cart
        const cart = await getUserCart(userId);
        if (!cart || !cart.cart_items || cart.cart_items.length === 0) {
            return res.status(400).json({ error: CheckoutMessages.EMPTY_CART });
        }

        // Get address_id from request (optional) - Ensures accurate delivery/tax calc
        const { address_id } = req.body;

        // Calculate Totals using Address Context
        // Passing 'null' for guestId, 'cart' for existingCart
        const totals = await calculateCartTotals(userId, null, cart, {
            addressId: address_id || null
        });
        const amount = totals.finalAmount;

        // PHASE 2B OPTIMIZATION: Inline stock validation (eliminates separate API call)
        const stockIssues = [];

        for (const item of cart.cart_items) {
            const variantId = item.variant_id;
            const productId = item.product_id;
            const requestedQty = item.quantity;

            let availableStock = 0;
            let productTitle = item.products?.title || 'Product';
            let variantLabel = null;

            if (variantId) {
                // Check variant stock
                const { data: variant } = await supabase
                    .from('product_variants')
                    .select('stock_quantity, size_label')
                    .eq('id', variantId)
                    .single();

                availableStock = variant?.stock_quantity || 0;
                variantLabel = variant?.size_label;
            } else {
                // Check product inventory
                const { data: product } = await supabase
                    .from('products')
                    .select('inventory')
                    .eq('id', productId)
                    .single();

                availableStock = product?.inventory || 0;
            }

            if (requestedQty > availableStock) {
                stockIssues.push({
                    productId,
                    variantId,
                    title: productTitle,
                    variantLabel,
                    requestedQty,
                    availableStock,
                    image: item.products?.images?.[0] || null
                });
            }
        }

        // Return user-friendly error if stock insufficient
        if (stockIssues.length > 0) {
            return res.status(400).json({
                error: req.t('errors.inventory.insufficientStock'),
                stockIssues
            });
        }

        // CRITICAL FIX: Validate coupon BEFORE creating Razorpay order
        // This prevents payment-refund cycles when coupons become invalid
        if (cart.applied_coupon_code) {

            // Normalize items for validation (Service expects 'product' and 'variant' keys)
            const normalizedItems = cart.cart_items.map(item => ({
                ...item,
                product: item.products,
                variant: item.product_variants
            }));

            const validation = await validateCoupon(
                cart.applied_coupon_code,
                userId,
                normalizedItems,
                totals.totalPrice,
                true // Force live check for critical operation
            );

            if (!validation.valid) {
                logger.warn({
                    coupon: cart.applied_coupon_code,
                    error: validation.error,
                    userId
                }, '[Checkout] Coupon validation failed before payment - preventing payment creation');

                // Return clear error to frontend
                return res.status(400).json({
                    error: req.t('errors.checkout.couponExpired', { code: cart.applied_coupon_code }),
                    details: validation.error,
                    code: 'INVALID_COUPON'
                });
            }

            logger.debug({
                coupon: cart.applied_coupon_code,
                userId
            }, '[Checkout] Coupon validated successfully before payment');
        }

        // 3. Pre-generate Sequential Order Number
        // This ensures Razorpay invoice receipt matches the final DB order number
        const { data: orderNumberData, error: orderNumberError } = await supabase
            .rpc('generate_next_order_number');

        if (orderNumberError || !orderNumberData) {
            logger.error({ err: orderNumberError }, 'Failed to generate order number');
            return res.status(500).json({ error: CheckoutMessages.ORDER_NUMBER_FAILED });
        }

        const receipt = orderNumberData; // e.g., ODR20260121000001

        // 4. Map Cart Items to Razorpay Line Items
        // FIX: Use `totals.itemBreakdown` to ensure line items use DISCOUNTED prices
        const lineItems = totals.itemBreakdown.map((breakdownItem, index) => {
            const cartItem = cart.cart_items.find(i =>
                (i.variant_id && i.variant_id === breakdownItem.variant_id) ||
                (!i.variant_id && i.product_id === breakdownItem.product_id)
            );

            const variant = cartItem?.product_variants;
            const product = cartItem?.products;

            // Safety fallback if mapping fails (though unlikely)
            const title = product?.title || 'Product';
            const variantLabel = variant?.size_label || 'Default';
            const syncedId = variant?.razorpay_item_id;

            let razorpayItem;

            if (syncedId) {
                // Synced Item
                razorpayItem = {
                    item_id: syncedId,
                    productId: breakdownItem.product_id,
                    variantId: breakdownItem.variant_id,
                    name: `${title} - ${variantLabel}`,
                    // USE ORIGINAL UNIT PRICE - Service will handle discount application
                    amount: Math.round((variant?.selling_price || product?.price || 0) * 100),
                    currency: 'INR',
                    quantity: breakdownItem.quantity
                };
            } else {
                // Unsynced
                razorpayItem = {
                    productId: breakdownItem.product_id,
                    variantId: breakdownItem.variant_id,
                    name: `${title} - ${variantLabel}`,
                    // USE DISCOUNTED PRICE FROM BREAKDOWN
                    amount: Math.round(breakdownItem.price * 100),
                    currency: 'INR',
                    quantity: breakdownItem.quantity
                };
            }

            // Attach delivery metadata to the first item for createRazorpayInvoice to extract
            if (index === 0) {
                razorpayItem.deliveryCharge = totals.deliveryCharge || 0;
                razorpayItem.deliveryGST = totals.deliveryGST || 0;
                razorpayItem.deliveryGSTRate = 18; // Default GST rate for delivery
            }

            return razorpayItem;
        });

        // Resolve Address for Razorpay Invoice (GST Validation)
        let shippingAddress = null;
        try {
            if (address_id) {
                shippingAddress = await getAddressById(address_id, userId);
            } else {
                shippingAddress = await getPrimaryAddress(userId);
            }
        } catch (addrError) {
            logger.warn({ err: addrError, userId, address_id }, 'Could not resolve shipping address for tax validation');
        }

        // 5. Create Razorpay Invoice
        // We pass the Profile details, Line Items, Totals and Shipping Address for GST validation
        const razorpayResponse = await createRazorpayInvoice(amount, receipt, profile, lineItems, totals, shippingAddress);

        // 6. Create Payment Record
        const payment = await createPaymentRecord({
            user_id: userId,
            razorpay_order_id: razorpayResponse.id, // This is the Order ID (linked to invoice)
            invoice_id: razorpayResponse.invoice_id, // Store Invoice ID for reference
            amount: amount,
            currency: 'INR',
            status: 'created',
            metadata: { receipt: receipt }
        });

        res.json({
            order_id: razorpayResponse.id, // Frontend uses this
            amount: razorpayResponse.amount,
            currency: razorpayResponse.currency,
            payment_id: payment.id,
            key_id: process.env.RAZORPAY_KEY_ID
        });
    } catch (error) {
        logger.error({ err: error }, 'Error creating Razorpay invoice/order:');
        res.status(500).json({ error: error.message || 'Failed to create payment order' });
    }
});

// Verify payment and complete order
// Protected by request lock and idempotency to prevent duplicate order creation
router.post('/verify-payment', validate(verifyPaymentSchema), requestLock('verify-payment'), idempotency(), async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({ error: req.t('errors.auth.authenticationRequired') });
        }

        // Delegate entire flow to service
        const result = await processPaymentAndOrder(userId, req.body);

        res.json(result);
    } catch (error) {
        logger.error({ err: error }, 'Error verifying payment:');
        // If error has status, use it
        res.status(error.status || 500).json({ error: error.message || 'Failed to process payment' });
    }
});

// ============================================
// BUY NOW ENDPOINTS
// These handle checkout for a single item without touching the cart
// ============================================

// Get Buy Now summary (single item + addresses + totals)
router.post('/buy-now/summary', async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({ error: req.t('errors.auth.authenticationRequired') });
        }

        let { productId, variantId, quantity = 1, addressId } = req.body;

        // Ensure quantity is a number
        quantity = parseInt(quantity, 10);

        // Validation
        if (!productId) {
            return res.status(400).json({ error: CheckoutMessages.PRODUCT_REQUIRED });
        }
        if (isNaN(quantity) || quantity < 1 || quantity > 100) {
            return res.status(400).json({ error: req.t('errors.checkout.invalidQuantityRange') });
        }

        const summary = await getBuyNowSummary(userId, { productId, variantId, quantity }, addressId);

        // PHASE 2B OPTIMIZATION: Include Razorpay key in summary
        summary.razorpay_key_id = process.env.RAZORPAY_KEY_ID;

        res.json(summary);
    } catch (error) {
        logger.error({ err: error }, 'Error fetching buy now summary:');
        // Return actual error message for easier debugging (non-production safe? strictly 500s are obscure)
        // For this app, we prefer visibility.
        res.status(error.status || 500).json({ error: error.message || req.t('errors.system.internalError') });
    }
});

// Validate stock for Buy Now item
router.post('/buy-now/validate-stock', async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({ error: req.t('errors.auth.authenticationRequired') });
        }

        const { productId, variantId, quantity = 1 } = req.body;
        if (!productId) {
            return res.status(400).json({ error: CheckoutMessages.INVALID_SESSION });
        }
        if (quantity < 1) {
            return res.status(400).json({ error: CheckoutMessages.INVALID_QUANTITY });
        }


        let availableStock = 0;
        let productTitle = 'Product';
        let variantLabel = null;
        let image = null;

        if (variantId) {
            // Check variant stock
            const { data: variant } = await supabase
                .from('product_variants')
                .select('stock_quantity, size_label, variant_image_url')
                .eq('id', variantId)
                .single();

            availableStock = variant?.stock_quantity || 0;
            variantLabel = variant?.size_label;

            // Get product title
            const { data: product } = await supabase
                .from('products')
                .select('title, images')
                .eq('id', productId)
                .single();
            productTitle = product?.title || 'Product';
            image = variant?.variant_image_url || product?.images?.[0];
        } else {
            // Check product inventory
            const { data: product } = await supabase
                .from('products')
                .select('title, inventory, images')
                .eq('id', productId)
                .single();

            availableStock = product?.inventory || 0;
            productTitle = product?.title || 'Product';
            image = product?.images?.[0];
        }

        if (quantity > availableStock) {
            return res.json({
                valid: false,
                items: [{
                    productId,
                    variantId,
                    title: productTitle,
                    variantLabel,
                    requestedQty: quantity,
                    availableStock,
                    image
                }]
            });
        }

        res.json({ valid: true, items: [] });
    } catch (error) {
        logger.error({ err: error }, 'Error validating buy now stock:');
        res.status(500).json({ error: CheckoutMessages.SYSTEM_ERROR });
    }
});

// Create payment order for Buy Now (single item)
// NOW INCLUDES INLINE STOCK VALIDATION (Phase 2 Optimization)
router.post('/buy-now/create-payment-order', requestLock('create-payment-order'), idempotency(), async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({ error: AuthMessages.AUTHENTICATION_REQUIRED });
        }

        const { productId, variantId, quantity = 1 } = req.body;

        // Validation
        if (!productId) {
            return res.status(400).json({ error: req.t('errors.checkout.productRequired') });
        }
        if (quantity < 1 || quantity > 100) {
            return res.status(400).json({ error: req.t('errors.checkout.invalidQuantityRange') });
        }


        // PHASE 2 OPTIMIZATION: Inline stock validation (eliminates separate API call)
        let availableStock = 0;
        let productTitle = 'Product';
        let variantLabel = null;

        if (variantId) {
            // Check variant stock
            const { data: variant } = await supabase
                .from('product_variants')
                .select('stock_quantity, size_label')
                .eq('id', variantId)
                .single();

            availableStock = variant?.stock_quantity || 0;
            variantLabel = variant?.size_label;

            // Get product title for error message
            const { data: product } = await supabase
                .from('products')
                .select('title')
                .eq('id', productId)
                .single();
            productTitle = product?.title || 'Product';
        } else {
            // Check product inventory
            const { data: product } = await supabase
                .from('products')
                .select('title, inventory')
                .eq('id', productId)
                .single();

            availableStock = product?.inventory || 0;
            productTitle = product?.title || 'Product';
        }

        // Return user-friendly error if stock insufficient
        if (quantity > availableStock) {
            const itemDesc = variantLabel ? `${productTitle} (${variantLabel})` : productTitle;
            return res.status(400).json({
                error: availableStock === 0
                    ? req.t('errors.checkout.outOfStock', { itemDesc })
                    : req.t('errors.checkout.lowStock', { itemDesc, count: availableStock }),
                stockIssue: {
                    productId,
                    variantId,
                    requestedQty: quantity,
                    availableStock
                }
            });
        }

        const summary = await getBuyNowSummary(userId, { productId, variantId, quantity });
        const amount = summary.totals.finalAmount;

        // PHASE 3A OPTIMIZATION: Use profile from summary (eliminates duplicate fetch)
        const profile = summary.user_profile;

        if (!profile) {
            return res.status(404).json({ error: CheckoutMessages.PROFILE_INCOMPLETE });
        }

        // 3. Pre-generate Sequential Order Number for Buy Now
        // This ensures Razorpay invoice receipt matches the final DB order number
        const { data: orderNumberData, error: orderNumberError } = await supabase
            .rpc('generate_next_order_number');

        if (orderNumberError || !orderNumberData) {
            logger.error({ err: orderNumberError }, 'Failed to generate order number');
            return res.status(500).json({ error: CheckoutMessages.ORDER_NUMBER_FAILED });
        }

        const receipt = orderNumberData; // e.g., ODR20260121000001

        // Build line items for Razorpay Invoice
        const lineItems = summary.cart.cart_items.map((item, index) => {
            const variant = item.product_variants;
            const product = item.products;

            let razorpayItem = {
                item_id: variant?.razorpay_item_id || null,

                // Add internal IDs for precise discount mapping in service
                productId: product.id,
                variantId: variant ? variant.id : null,

                name: `${product.title}${variant ? ` - ${variant.size_label}` : ''}`,
                // USE DISCOUNTED PRICE FROM BREAKDOWN (available via summary.totals.itemBreakdown)
                amount: Math.round((summary.totals.itemBreakdown[index]?.price || variant?.selling_price || product.price) * 100),
                currency: 'INR',
                quantity: item.quantity
            };

            // Attach delivery metadata to the first item
            if (index === 0) {
                razorpayItem.deliveryCharge = summary.totals.deliveryCharge || 0;
                razorpayItem.deliveryGST = summary.totals.deliveryGST || 0;
                razorpayItem.deliveryGSTRate = 18;
            }

            return razorpayItem;
        });

        // Create Razorpay Invoice
        const razorpayResponse = await createRazorpayInvoice(amount, receipt, profile, lineItems, summary.totals);

        // Create Payment Record
        const payment = await createPaymentRecord({
            user_id: userId,
            razorpay_order_id: razorpayResponse.id,
            invoice_id: razorpayResponse.invoice_id,
            amount,
            currency: 'INR',
            status: 'created',
            metadata: { receipt: receipt }
        });

        res.json({
            order_id: razorpayResponse.id,
            amount: razorpayResponse.amount,
            currency: razorpayResponse.currency,
            payment_id: payment.id,
            key_id: process.env.RAZORPAY_KEY_ID,
            isBuyNow: true,
            buyNowData: {
                productId,
                variantId,
                quantity
            }
        });
    } catch (error) {
        logger.error({ err: error }, 'Error creating buy now payment order:');
        res.status(error.status || 500).json({ error: CheckoutMessages.SYSTEM_ERROR });
    }
});

// Verify payment and complete Buy Now order
router.post('/buy-now/verify-payment', requestLock('verify-payment'), idempotency(), async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({ error: req.t('errors.auth.authenticationRequired') });
        }

        const { buyNowData, ...paymentData } = req.body;

        if (!buyNowData || !buyNowData.productId) {
            return res.status(400).json({ error: req.t('errors.checkout.invalidSession') });
        }

        const result = await processBuyNowOrder(userId, paymentData, buyNowData);

        res.json(result);
    } catch (error) {
        logger.error({ err: error }, 'Error processing Buy Now payment:');

        // Map to friendly messages
        let userMessage = 'Unable to complete your order. ';
        let code = 'ORDER_PROCESS_ERROR';

        if (error.message?.includes('Invalid payment signature')) {
            userMessage = 'Payment verification failed. Please contact support if money was deducted.';
            code = 'INVALID_PAYMENT_SIGNATURE';
        } else if (error.message?.includes('refunded')) {
            userMessage = error.message;
            code = 'PAYMENT_REFUNDED';
        } else if (error.message?.includes('Insufficient stock')) {
            userMessage = 'Sorry, this item is now out of stock. Your payment has been refunded.';
            code = 'INSUFFICIENT_STOCK';
        } else if (error.message?.includes('not found')) {
            userMessage = 'The product or address could not be found.';
            code = 'RESOURCE_NOT_FOUND';
        } else {
            userMessage = 'An unexpected error occurred. Please try again or contact support.';
        }

        res.status(error.status || 500).json({
            error: userMessage,
            code: code
        });
    }
});

module.exports = router;

