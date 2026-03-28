const Razorpay = require('razorpay');
const logger = require('../utils/logger');
const { createModuleLogger } = require('../utils/logging-standards');
const { getTraceContext } = require('../utils/async-context');
const crypto = require('crypto');
const supabase = require('../config/supabase');
const { supabaseAdmin } = require('../config/supabase');
const { calculateCartTotals, getUserCart, removeFromCart } = require('./cart.service');
const { getPrimaryAddress, getLatestAddress, getAddressById, getUserAddresses } = require('./address.service');
const { checkStockAvailability, decreaseInventory } = require('./inventory.service');
const emailService = require('./email');
const { RefundService, REFUND_TYPES } = require('./refund.service');
const { capturePayment, voidAuthorization, refundPayment } = require('../utils/razorpay-helper');
// Pricing
const { PricingCalculator } = require('./pricing-calculator.service');
const { FinancialEventLogger } = require('./financial-event-logger.service');
const { logStatusHistory } = require('./history.service');
const { validateCoupon } = require('./coupon.service');
const { RazorpayInvoiceService } = require('./razorpay-invoice.service');
const { InvoiceOrchestrator } = require('./invoice-orchestrator.service');
const {
    getCheckoutSummaryCache,
    setCheckoutSummaryCache
} = require('./checkout-summary-cache.service');
const { wrapRazorpayWithTimeout } = require('../utils/razorpay-timeout');
const { ORDER_STATUS, PAYMENT_STATUS, RAZORPAY_STATUS } = require('../config/constants');
const { CHECKOUT, PAYMENT, INVENTORY, INVOICE, LOGS } = require('../constants/messages');
const realtimeService = require('./realtime.service');

// Create module-specific logger
const log = createModuleLogger('CheckoutService');

/**
 * Checkout Service
 * Handles checkout flow, Razorpay integration, and order creation
 */

// Initialize Razorpay
const key_id = process.env.RAZORPAY_KEY_ID;
const key_secret = process.env.RAZORPAY_KEY_SECRET;

if (!key_secret) {
    logger.error(LOGS.AUTH_KEY_SECRET_MISSING);
}

const razorpayRaw = new Razorpay({
    key_id: key_id,
    key_secret: key_secret
});

// Wrap Razorpay with timeout protection (30s default, configurable via RAZORPAY_API_TIMEOUT)
const razorpay = wrapRazorpayWithTimeout(razorpayRaw);


/**
 * Create a virtual cart for Buy Now, merging with user's existing cart items if present
 */
const createBuyNowVirtualCart = async (userId, guestId, buyNowData) => {
    const { productId, variantId, quantity = 1, couponCode = null } = buyNowData;

    // 1. Fetch Product & Variant Details
    const { data: product } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .maybeSingle();

    if (!product) {
        const error = new Error(CHECKOUT.PRODUCT_REQUIRED);
        error.status = 404;
        throw error;
    }

    let variant = null;
    if (variantId) {
        const { data: v } = await supabase
            .from('product_variants')
            .select('*')
            .eq('id', variantId)
            .maybeSingle();
        variant = v;
        if (!variant) {
            const error = new Error(INVENTORY.VARIANT_NOT_FOUND);
            error.status = 404;
            throw error;
        }
    }

    // 2. CRITICAL: Check stock availability before proceeding
    const stockCheck = await checkStockAvailability([{
        product_id: productId,
        variant_id: variantId,
        quantity: quantity
    }]);

    if (!stockCheck.available) {
        const error = new Error(INVENTORY.INSUFFICIENT_STOCK);
        error.status = 400;
        error.stockInfo = stockCheck;
        throw error;
    }

    // 3. Use exact Buy Now quantity - do not merge with cart
    // Buy Now intent is "purchase THIS item NOW", not "purchase this + cart items"
    const finalQuantity = parseInt(quantity, 10);

    // 4. Construct Virtual Cart
    return {
        id: 'buy-now-virtual', // Use null when creating order to prevent DB updates
        user_id: userId,
        guest_id: guestId,
        applied_coupon_code: couponCode || null, // Support coupon codes in Buy Now
        cart_items: [
            {
                product_id: productId,
                variant_id: variantId || (variant ? variant.id : null),
                quantity: finalQuantity,
                products: product,
                product_variants: variant,
                id: `buynow-${productId}-${variantId || 'def'}`
            }
        ]
    };
};

// Get checkout summary (cart + addresses + totals + tax + profile)
// PHASE 3A: Now includes user_profile to eliminate duplicate fetch in payment creation
const getCheckoutSummary = async (userId, guestId, addressId = null) => {
    const cacheContext = {
        userId,
        guestId,
        addressId,
        language: global.reqLanguage || 'en'
    };
    const cachedSummary = getCheckoutSummaryCache(cacheContext);
    if (cachedSummary) {
        return cachedSummary;
    }

    // 1. Fetch Cart First
    const cart = await getUserCart(userId, guestId, { createIfMissing: false });
    if (!cart || !cart.cart_items || cart.cart_items.length === 0) {
        const emptySummary = { cart: null, totals: null, shipping_address: null, billing_address: null };
        setCheckoutSummaryCache(cacheContext, emptySummary);
        return emptySummary;
    }

    // 2. Fetch dependencies in parallel
    const [profileResult, allAddresses] = await Promise.all([
        userId ? supabase.from('profiles').select('*').eq('id', userId).maybeSingle() : Promise.resolve({ data: null }),
        userId ? getUserAddresses(userId) : Promise.resolve([])
    ]);
    const profile = profileResult.data;

    // 3. Resolve Addresses
    const findAddressByType = (addresses, type) => {
        const primary = addresses.find(a => a.is_primary && (a.type === type || a.type === 'both'));
        if (primary) return primary;
        return addresses.find(a => a.type === type || a.type === 'both');
    };

    let shippingAddress = null;
    if (addressId) {
        shippingAddress = allAddresses.find(a => a.id === addressId);
    }

    if (!shippingAddress) {
        // Fallback sequence: Primary Home/Work -> Any Home/Work -> Any Primary -> First Available
        shippingAddress = allAddresses.find(a => a.is_primary && (a.type === 'home' || a.type === 'work' || a.type === 'both')) ||
            allAddresses.find(a => a.type === 'home' || a.type === 'work' || a.type === 'both') ||
            allAddresses.find(a => a.is_primary) ||
            allAddresses[0];
    }

    // Validate completeness
    if (shippingAddress) {
        // Fix field names to match formatAddress/DB columns
        const requiredFields = ['full_name', 'street_address', 'city', 'state', 'postal_code', 'phone'];
        const isIncomplete = requiredFields.some(field => !shippingAddress[field]);
        if (isIncomplete) {
            log.warn(LOGS.CHECKOUT_SUMMARY_INCOMPLETE_ADDR, LOGS.CHECKOUT_SUMMARY_INCOMPLETE_ADDR, { addressId: shippingAddress.id });
            shippingAddress = null;
        }
    }

    const billingAddress = findAddressByType(allAddresses, 'billing') ||
        allAddresses.find(a => a.is_primary) ||
        allAddresses[0] ||
        shippingAddress;

    // 4. Calculate Totals once using the RESOLVED address
    // This ensures consistency between the displayed totals and the active address
    const totals = await calculateCartTotals(userId, guestId, cart, {
        prefetchedAddress: shippingAddress
    });

    const taxItems = (totals.itemBreakdown || []).map(item => ({
        product_id: item.product_id,
        variant_id: item.variant_id,
        taxable_amount: item.tax_breakdown?.taxable_amount || 0,
        cgst: item.tax_breakdown?.cgst || 0,
        sgst: item.tax_breakdown?.sgst || 0,
        igst: item.tax_breakdown?.igst || 0,
        total_tax: item.tax_breakdown?.total_tax || 0,
        gst_rate: item.tax_breakdown?.gst_rate || 0
    }));

    // 5. Construct Response
    const response = {
        cart,
        totals,
        shipping_address: shippingAddress,
        billing_address: billingAddress,
        user_profile: profile,
        tax: totals.tax ? {
            total_tax: totals.tax.totalTax,
            total_taxable_amount: totals.tax.totalTaxableAmount,
            total_cgst: totals.tax.cgst || 0,
            total_sgst: totals.tax.sgst || 0,
            total_igst: totals.tax.igst || 0,
            tax_type: totals.tax.taxType,
            items: taxItems
        } : null
    };

    setCheckoutSummaryCache(cacheContext, response);
    return response;
};

// Create Razorpay INVOICE (replaces simple Order)
// This generates a detailed PDF Invoice + Email
const createRazorpayInvoice = async (amount, receipt, customer, lineItems, totals = null, shippingAddress = null) => {
    log.operationStart('CREATERazorpayInvoice', { amount, receipt, hasAddress: !!shippingAddress });
    const startTime = Date.now();

    try {
        // 1. Generate Product Line Items using the centralized PricingCalculator formatter
        // This handles: Precise per-unit taxable amounts, GST rates, split taxes (CGST/SGST/IGST), and HSN codes.
        // It relies on PricingCalculator having already applied discounts to the taxable amounts.
        const cleanLineItems = totals && totals.items
            ? PricingCalculator.formatForRazorpayInvoice(totals.items)
            : lineItems.map(item => ({
                name: item.name,
                amount: item.amount,
                currency: item.currency || 'INR',
                quantity: item.quantity
            }));

        // 2. Identify and aggregate delivery charges (to be added as separate line items)
        const deliveryAggregator = {};

        // In certain flows (like Cart Checkout), lineItems might carry delivery metadata
        // In other flows (like Buy Now), we use totals.delivery_total (after my PricingCalculator fix)
        if (lineItems && lineItems.length > 0) {
            lineItems.forEach(item => {
                if (item.deliveryCharge > 0) {
                    const name = 'Delivery Charges';
                    // Include GST in the total delivery amount shown to the customer in Razorpay
                    deliveryAggregator[name] = (deliveryAggregator[name] || 0) + item.deliveryCharge + (item.deliveryGST || 0);
                }
            });
        } else if (totals && totals.delivery_total > 0) {
            deliveryAggregator['Delivery Charges'] = (deliveryAggregator['Delivery Charges'] || 0) + totals.delivery_total;
        }

        // 3. Sanitize Line Items (Remove internal IDs before sending to Razorpay)
        cleanLineItems.forEach(item => {
            delete item.productId;
            delete item.variantId;
        });

        // NOW Add Aggregated Delivery Charges (Un-discounted)
        Object.entries(deliveryAggregator).forEach(([name, amount]) => {
            cleanLineItems.push({
                name: name,
                amount: Math.round(amount * 100),
                currency: 'INR',
                quantity: 1,
                tax_inclusive: true
            });
        });

        // Construct Invoice Payload
        const payload = {
            type: 'invoice',
            description: `Order #${receipt} - Payment Status: PAID`, // Add status to description since Amount Paid might be 0 for separate invoices
            date: Math.floor(Date.now() / 1000), // Unix timestamp
            customer: {
                name: customer.name,
                email: customer.email,
                ...(customer.phone && { contact: customer.phone })
            },
            line_items: cleanLineItems,
            receipt: receipt,
            sms_notify: process.env.RAZORPAY_SMS_NOTIFY === 'true' ? 1 : 0,
            email_notify: process.env.RAZORPAY_EMAIL_NOTIFY === 'true' ? 1 : 0
        };

        // 4. Add Customer Address (CRITICAL for GST validation on Razorpay's end)
        if (shippingAddress) {
            // Razorpay Invoice API expects billing_address and shipping_address INSIDE the customer object
            // The state name must be the full name, not the code (e.g., "Delhi" instead of "07")
            const formattedAddress = {
                line1: shippingAddress.street_address || shippingAddress.address_line1 || '',
                line2: shippingAddress.apartment || shippingAddress.address_line2 || '',
                city: shippingAddress.city || '',
                state: shippingAddress.state || '',
                zipcode: shippingAddress.postal_code || '',
                country: shippingAddress.country || 'India'
            };

            payload.customer.billing_address = formattedAddress;
            payload.customer.shipping_address = formattedAddress;

            // Also update customer contact info if available in address but missing in profile
            if (!payload.customer.contact && shippingAddress.phone) {
                payload.customer.contact = String(shippingAddress.phone).replace(/\D/g, '');
            }
        }

        // DEBUG: Capture full payload for troubleshooting
        log.debug('RAZORPAY_PAYLOAD_FULL', 'Final payload being sent to Razorpay', {
            payload,
            shippingAddressResolved: !!shippingAddress
        });

        logger.info({
            receipt,
            itemCount: payload.line_items.length,
            hasDiscount: (totals?.coupon_discount || 0) > 0,
            sms_notify: payload.sms_notify,
            email_notify: payload.email_notify
        }, LOGS.CHECKOUT_INVOICE_CREATE_INIT);


        // Wait! Razorpay Items + Invoice API flow is slightly different from Standard Checkout.
        // Standard Checkout needs `order_id` generated via `orders.create`.
        // `invoices.create` generates an invoice. 
        // DOES `invoices.create` returning an `order_id` compatible with checkout? 
        // Yes, `invoice.order_id` is linked.

        const invoice = await razorpay.invoices.create(payload);

        // If invoice is in draft, we might need to Issue it to get the link/email trigger?
        // But for "Checkout", we want the user to pay NOW.
        // Standard Checkout requires `order_id`.
        // If the invoice is created, it has an `order_id`.
        // We use that `order_id` on the frontend.
        // When the user pays that `order_id`, the Invoice status updates to Paid.

        let finalInvoice = invoice;
        if (invoice.status === RAZORPAY_STATUS.DRAFT) {
            finalInvoice = await razorpay.invoices.issue(invoice.id);
        }

        log.operationSuccess('CREATE_RAZORPAY_INVOICE', {
            invoiceId: finalInvoice.id,
            orderId: finalInvoice.order_id,
            amount: finalInvoice.amount,
            status: finalInvoice.status
        }, Date.now() - startTime);

        // We return an object that looks like an "Order" to keep backend consistent
        // The frontend only cares about `id` (which should be order_id)
        return {
            id: finalInvoice.order_id, // CRITICAL: Frontend expects Order ID, not Invoice ID
            invoice_id: finalInvoice.id,
            amount: finalInvoice.amount || Math.round(amount * 100),
            currency: finalInvoice.currency,
            status: finalInvoice.status
        };
    } catch (error) {
        log.operationError('CREATE_RAZORPAY_INVOICE', error, { amount, receipt });

        // Extract error message from Razorpay error object for internal logging
        const technicalMessage = error.error?.description || error.description || error.message || COMMON.UNKNOWN_ERROR;

        logger.error({
            err: error,
            technicalMessage,
            amount,
            receipt,
            customer
        }, LOGS.CHECKOUT_TRANS_FAIL);

        // Throw a friendly error with a code for the middleware to map
        const friendlyError = new Error(PAYMENT.GATEWAY_ERROR);
        friendlyError.code = 'RAZORPAY_ERROR';
        friendlyError.statusCode = 502; // Bad Gateway as it's a third-party issue
        throw friendlyError;
    }
};

// Verify Razorpay payment signature
const verifyRazorpayPayment = (orderId, paymentId, signature) => {
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
        throw new Error(CHECKOUT.SYSTEM_ERROR);
    }

    const body = orderId + '|' + paymentId;
    const expectedSignature = crypto
        .createHmac('sha256', keySecret)
        .update(body)
        .digest('hex');

    if (expectedSignature !== signature) {
        // Log mismatch details (masked) for debugging
        const maskedSecret = keySecret.substring(0, 4) + '***';
        // Do NOT log the full signatures in production, but for now we need to know why.
        // Actually, never log the secret.
        // We can log the inputs.
        // logger.debug({ orderId, paymentId, signatureLength: signature.length }, 'Signature verification inputs');
    }

    return expectedSignature === signature;
};

// Create payment record
const createPaymentRecord = async (paymentData) => {
    // Note: receipt/orderNumber should be passed in valid columns (e.g. metadata)
    const { data, error } = await supabase
        .from('payments')
        .insert([paymentData])
        .select()
        .single();

    if (error) throw error;
    return data;
};

// Update payment record
const updatePaymentRecord = async (paymentId, updates) => {
    const { data, error } = await supabase
        .from('payments')
        .update({
            ...updates,
            updated_at: new Date().toISOString()
        })
        .eq('id', paymentId)
        .select()
        .single();

    if (error) throw error;
    return data;
};

// Create order with all details - TRANSACTIONAL VERSION
// All database operations are executed atomically via PostgreSQL function
const createOrder = async (userId, checkoutData, cart) => {
    const {
        shipping_address_id,
        billing_address_id,
        payment_id,
        razorpay_payment_id, // Destructure here
        notes,
        orderNumber // NEW: Receipt ID passed from payment record
    } = checkoutData;


    // 1. Fetch dependencies in parallel to minimize latency
    const [profileResult, shippingAddrDataResult, billingAddrDataResult] = await Promise.all([
        supabase.from('profiles').select('name, email, phone').eq('id', userId).maybeSingle(),
        supabase.from('addresses').select('*, phone_numbers(phone_number)').eq('id', shipping_address_id).maybeSingle(),
        supabase.from('addresses').select('*, phone_numbers(phone_number)').eq('id', billing_address_id).maybeSingle()
    ]);

    const profile = profileResult.data;
    const shippingAddrData = shippingAddrDataResult.data;
    const billingAddrData = billingAddrDataResult.data;

    if (!shippingAddrData) {
        logger.error({ err: shipping_address_id }, LOGS.CHECKOUT_WEBHOOK_NOT_FOUND);
        throw new Error(CHECKOUT.SHIPPING_ADDRESS_NOT_FOUND);
    }
    if (!billingAddrData) {
        logger.error({ err: billing_address_id }, LOGS.CHECKOUT_WEBHOOK_NOT_FOUND);
        throw new Error(CHECKOUT.BILLING_ADDRESS_NOT_FOUND);
    }

    // Flatten addresses
    const shippingAddr = { ...shippingAddrData, phone: shippingAddrData.phone_numbers?.phone_number };
    const billingAddr = { ...billingAddrData, phone: billingAddrData.phone_numbers?.phone_number };

    // PERFORMANCE: Pass existing cart AND resolved address to avoid refetching
    const totals = await calculateCartTotals(userId, null, cart, { prefetchedAddress: shippingAddr });

    // Check stock availability BEFORE processing order
    const stockCheck = await checkStockAvailability(cart.cart_items);
    if (!stockCheck.available) {
        const itemNames = stockCheck.insufficientItems.map(i => i.title || i.product_id).join(', ');
        throw new Error(`${INVENTORY.INSUFFICIENT_STOCK}: ${itemNames}`);
    }

    // --- COUPON SAFETY GUARD (Defense-in-Depth) ---
    // PRIMARY validation happens in /create-payment-order BEFORE payment capture
    // This is a SECONDARY check to catch race conditions (e.g., coupon disabled between payment steps)
    if (cart.applied_coupon_code) {
        // Normalize items for validation (Service expects 'product' and 'variant' keys)
        const normalizedItems = cart.cart_items.map(item => ({
            ...item,
            product: item.products,
            variant: item.product_variants
        }));

        // Force live check for critical operation
        const validation = await validateCoupon(cart.applied_coupon_code, userId, normalizedItems, totals.totalPrice, true);

        if (!validation.valid) {
            log.warn(LOGS.CHECKOUT_STALE_COUPON, LOGS.CHECKOUT_COUPON_RACE_CONDITION, {
                coupon: cart.applied_coupon_code,
                error: validation.error
            });
            // This should RARELY happen now - only if coupon changed BETWEEN create-payment-order and verify-payment
            throw new Error(CHECKOUT.STALE_COUPON);
        }
    }

    // Profile and Addresses already fetched and flattened at the top

    const taxSummary = totals.tax || {
        totalTaxableAmount: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        totalTax: 0,
        taxType: null,
        isInterState: false
    };

    // // --- INJECTED FOR MANUAL TESTING ---
    // if (process.env.NODE_ENV !== 'production') {
    //     logger.warn('SIMULATING CRASH to test Orphan Payment Sweeper!');
    //     throw new Error("Simulated Crash: Network Disconnect Post-Payment");
    // }
    // // -----------------------------------

    // Prepare order data for transactional RPC
    const orderData = {
        customer_name: profile.name || CHECKOUT.DEFAULT_CUSTOMER_NAME,
        customer_email: profile.email || CHECKOUT.DEFAULT_CUSTOMER_EMAIL,
        customer_phone: profile.phone || shippingAddr?.phone,
        shipping_address_id,
        billing_address_id,
        shipping_address: shippingAddr,
        total_amount: totals.finalAmount,
        subtotal: totals.totalPrice,
        coupon_code: totals.coupon?.code || null,
        coupon_discount: totals.couponDiscount || 0,
        delivery_charge: totals.deliveryCharge || 0,
        delivery_gst: totals.deliveryGST || 0,
        // Refund Metadata: Will be re-calculated based on item snapshots
        is_delivery_refundable: true,
        delivery_tax_type: 'GST', // System default for now
        status: ORDER_STATUS.PENDING, // Orders start as pending until admin/manager confirms
        payment_status: PAYMENT_STATUS.PAID,
        notes: notes || null,
        total_taxable_amount: taxSummary.totalTaxableAmount || 0,
        total_cgst: taxSummary.cgst || 0,
        total_sgst: taxSummary.sgst || 0,
        total_igst: taxSummary.igst || 0
    };

    const pricingItemMap = new Map((totals.items || []).map(item => {
        const key = item.variant_id ? `var_${item.variant_id}` : `prod_${item.product_id}`;
        return [key, item];
    }));

    // Prepare order items with the same authoritative pricing snapshots shown to the user
    const orderItems = [];
    for (const item of cart.cart_items) {
        const pricingKey = item.variant_id ? `var_${item.variant_id}` : `prod_${item.product_id}`;
        const pricedItem = pricingItemMap.get(pricingKey);
        const variant = item.product_variants || item.variant || {};
        const product = item.products || item.product || {};
        const taxBreakdown = pricedItem?.tax_breakdown || {};

        orderItems.push({
            product_id: item.product_id,
            variant_id: item.variant_id || null,
            quantity: item.quantity,
            product: {
                id: product.id || item.product_id,
                title: product.title || INVENTORY.DEFAULT_PRODUCT_TITLE,
                price: variant.selling_price || product.price || 0,
                images: product.images || [],
                isReturnable: product.isReturnable ?? product.is_returnable ?? true,
                price_includes_tax: variant.id
                    ? (variant.price_includes_tax ?? product.default_price_includes_tax ?? true)
                    : (product.default_price_includes_tax ?? true)
            },
            // Financial details
            delivery_charge: pricedItem?.delivery_charge || 0,
            delivery_gst: pricedItem?.delivery_gst || 0,
            delivery_calculation_snapshot: pricedItem?.delivery_meta || null,
            coupon_id: totals.coupon?.id || null,
            coupon_code: totals.coupon?.code || null,
            coupon_discount: pricedItem?.coupon_discount || 0,
            // Tax snapshot (immutable)
            taxable_amount: taxBreakdown.taxable_amount || null,
            cgst: taxBreakdown.cgst || 0,
            sgst: taxBreakdown.sgst || 0,
            igst: taxBreakdown.igst || 0,
            hsn_code: taxBreakdown.hsn_code || null,
            gst_rate: taxBreakdown.gst_rate || null,
            total_amount: taxBreakdown.total_amount || null,
            variant_snapshot: variant.id ? {
                variant_id: variant.id,
                size_label: variant.size_label,
                selling_price: variant.selling_price,
                mrp: variant.mrp,
                description: variant.description,
                tax_applicable: variant.tax_applicable || false,
                price_includes_tax: variant.price_includes_tax ?? true
            } : null
        });
    }

    const summedItemDeliveryCharge = orderItems.reduce((sum, item) => sum + Number(item.delivery_charge || 0), 0);
    const summedItemDeliveryGst = orderItems.reduce((sum, item) => sum + Number(item.delivery_gst || 0), 0);
    const orderLevelDeliveryCharge = Math.max(0, Number(totals.deliveryCharge || 0) - summedItemDeliveryCharge);
    const orderLevelDeliveryGst = Math.max(0, Number(totals.deliveryGST || 0) - summedItemDeliveryGst);

    // RE-CALCULATE REFUNDABILITY based on actual snapshots
    // Ensure we strictly respect non-refundable item delivery and standard order-level delivery
    const hasNonRefundableCharge = orderItems.some(item =>
        (item.delivery_charge > 0) &&
        item.delivery_calculation_snapshot?.delivery_refund_policy === 'NON_REFUNDABLE'
    );

    orderData.is_delivery_refundable =
        !hasNonRefundableCharge &&
        orderLevelDeliveryCharge === 0 &&
        orderLevelDeliveryGst === 0;

    logger.info({ userId, itemCount: orderItems.length, hasTax: !!taxSummary, isDeliveryRefundable: orderData.is_delivery_refundable }, LOGS.CHECKOUT_TRANS_COMPLETE);

    // ATOMIC TRANSACTION: All operations execute together or none do
    // Creates: order, order_items, payment link, admin notifications, 
    // inventory decrease, cart clear - all in one transaction

    // Prepare RPC parameters - ALWAYS pass all 7 params to disambiguate function overloads
    const rpcParams = {
        p_user_id: userId,
        p_order_data: orderData,
        p_order_items: orderItems,
        p_payment_id: payment_id || null,
        p_cart_id: cart.id,
        p_coupon_code: totals.coupon?.code || null,
        p_order_number: checkoutData.orderNumber || null
    };

    const { data: rpcResult, error: rpcError } = await supabase.rpc('create_order_transactional', rpcParams);

    if (rpcError) {
        logger.error({ err: rpcError }, LOGS.CHECKOUT_TRANS_FAIL);
        throw new Error(CHECKOUT.ORDER_CREATION_FAILED);
    }

    logger.info({
        orderId: rpcResult.id,
        orderNumber: rpcResult.order_number
    }, LOGS.CHECKOUT_TRANS_COMPLETE);

    // Prepare order object for response and email (no bundling)
    const order = {
        id: rpcResult.id,
        order_number: rpcResult.order_number,
        status: rpcResult.status,
        total_amount: rpcResult.total_amount,
        customer_name: profile.name,
        customer_email: profile.email,
        items: orderItems,
        // Add missing details for email template
        shipping_address: shippingAddr,
        billing_address: billingAddr,
        subtotal: totals.totalPrice,
        delivery_charge: totals.deliveryCharge, // Show full delivery charge
        coupon_discount: totals.couponDiscount || 0,
        created_at: new Date(),
        // Tax summary - Use snake_case from TaxEngine
        tax: totals.tax ? {
            total_taxable_amount: totals.tax.totalTaxableAmount || 0,
            total_cgst: totals.tax.cgst || 0,
            total_sgst: totals.tax.sgst || 0,
            total_igst: totals.tax.igst || 0,
            total_tax: totals.tax.totalTax || 0,
            tax_type: totals.tax.taxType
        } : null
    };

    // --- HISTORY LOGGING ---
    // Handled atomically by create_order_transactional RPC
    // We do NOT log here to avoid duplicates or race conditions.

    // Log financial event for audit (non-blocking)
    FinancialEventLogger.logOrderCreated(order, order.tax, userId)
        .catch(err => log.warn(LOGS.CHECKOUT_HIST_FAIL, 'Failed to log order creation', { error: err.message }));

    // Log initial payment verification (PAYMENT_SUCCESS)
    // NOTE: 'ORDER_PLACED' is handled by the creation RPC or system trigger, so we avoid duplicating it here.
    try {
        if (checkoutData.payment_status === PAYMENT_STATUS.PAID) {
            await logStatusHistory(order.id, 'PAYMENT_SUCCESS', userId, PAYMENT.PAYMENT_SUCCESS_NOTE, 'SYSTEM');
            // User requested that orders NOT be auto-confirmed by system. Leaving status as 'pending'.
        }
    } catch (histError) {
        log.warn({ err: histError, orderId: order.id }, LOGS.CHECKOUT_HIST_FAIL);
    }

    // --- BACKGROUND OFF-LOAD ---
    // Generate Invoice and Send Emails asynchronously to dramatically speed up checkout success response
    (async () => {
        try {
            // Generate Invoice immediately for paid orders (if verified)
            if (order.status === ORDER_STATUS.CONFIRMED || checkoutData.payment_status === PAYMENT_STATUS.PAID) {
                if (checkoutData.invoice_id) {
                    logger.info({ orderId: order.id, invoiceId: checkoutData.invoice_id }, LOGS.CHECKOUT_LINK_EXISTING_INV);

                    let inv = await razorpay.invoices.fetch(checkoutData.invoice_id);

                    if (inv && inv.status === RAZORPAY_STATUS.DRAFT) {
                        logger.info({ invoiceId: inv.id }, LOGS.CHECKOUT_ISSUE_DRAFT_INV);
                        inv = await razorpay.invoices.issue(inv.id);
                    }

                    if (inv && inv.short_url) {
                        order.invoiceUrl = inv.short_url;
                        order.invoice_id = checkoutData.invoice_id;

                        await supabase.from('orders').update({
                            invoice_status: 'receipt_generated'
                        }).eq('id', order.id);

                        await supabase.from('invoices').insert({
                            order_id: order.id,
                            type: 'RAZORPAY',
                            invoice_number: inv.invoice_number,
                            provider_id: inv.id,
                            public_url: inv.short_url,
                            status: (inv.status === 'paid' || inv.status === 'issued') ? inv.status : 'GENERATED'
                        });
                    } else {
                        logger.error({ invoiceId: checkoutData.invoice_id }, CHECKOUT.RAZORPAY_ERROR);
                    }
                } else {
                    logger.info({ orderId: order.id }, LOGS.CHECKOUT_GEN_RECEIPT_INIT);
                    const result = await InvoiceOrchestrator.generateRazorpayInvoice(order);

                    if (!result.success) {
                        logger.error({ err: result.error }, LOGS.CHECKOUT_TRANS_FAIL);
                        order.invoice_status = 'pending_generation';
                    }

                    if (result.invoiceUrl) {
                        order.invoiceUrl = result.invoiceUrl;
                        order.invoice_id = result.invoiceId;
                        order.invoice_status = 'generated';
                    }
                }
            }

            // Send "Order Placed" Email (v2)
            logger.info({ data: profile.email }, LOGS.CHECKOUT_EMAIL_INIT);
            await emailService.sendOrderPlacedEmail(
                profile.email,
                {
                    order: order,
                    customerName: profile.name,
                    receiptUrl: order.invoiceUrl,
                    paymentId: razorpay_payment_id || payment_id
                },
                userId
            );
        } catch (bgError) {
            logger.error({ err: bgError, orderId: order.id }, 'Background task failed during Order Creation');
        }
    })();
    // --- END BACKGROUND OFF-LOAD ---

    realtimeService.publish({
        topic: 'dashboard',
        type: 'order.created',
        audience: 'staff',
        payload: {
            orderId: order.id,
            orderNumber: order.order_number,
            userId,
            paymentStatus: order.payment_status,
            status: order.status
        }
    });

    return order;
};

// Create admin notifications for new order
const createAdminNotifications = async (orderId) => {
    try {
        // Get all admins using JOIN with roles table
        const { data: admins, error } = await supabase
            .from('profiles')
            .select(`
                id,
                roles!inner (
                    name
                )
            `)
            .eq('roles.name', 'admin');

        if (error) {
            logger.error({ err: error }, LOGS.CHECKOUT_ADMIN_NOTIF_FAIL);
            return;
        }

        if (!admins || admins.length === 0) {
            logger.info(LOGS.CHECKOUT_ADMIN_NOTIF_NONE);
            return;
        }

        // Create notification for each admin
        const notifications = admins.map(admin => ({
            order_id: orderId,
            admin_id: admin.id,
            status: 'unread'
        }));

        const { error: insertError } = await supabaseAdmin
            .from('order_notifications')
            .insert(notifications);

        if (insertError) {
            logger.error({ err: insertError }, LOGS.CHECKOUT_ADMIN_NOTIF_FAIL);
        } else {
            logger.info({ orderId, count: notifications.length }, LOGS.CHECKOUT_ADMIN_NOTIF_SUCCESS);
        }
    } catch (error) {
        logger.error({ err: error }, LOGS.CHECKOUT_ADMIN_NOTIF_FAIL);
    }
};



// Process Refund (Server-Side)
const processRefund = async (paymentId, amount = null) => {
    try {
        logger.info({ paymentId }, LOGS.CHECKOUT_REFUND_INIT);

        // Get payment record
        const { data: payment, error: fetchError } = await supabase
            .from('payments')
            .select('*')
            .eq('id', paymentId)
            .single();

        if (fetchError || !payment) {
            throw new Error(PAYMENT.RECORD_NOT_FOUND);
        }

        logger.info({
            id: payment.id,
            razorpay_payment_id: payment.razorpay_payment_id,
            razorpay_order_id: payment.razorpay_order_id,
            status: payment.status,
            amount: payment.amount
        }, LOGS.CHECKOUT_REFUND_FOUND);

        // Validate Razorpay payment ID exists
        if (!payment.razorpay_payment_id) {
            logger.error({ paymentId }, LOGS.CHECKOUT_REFUND_NO_ID);
            throw new Error(PAYMENT.REFUND_FAILED_NO_ID);
        }

        // Only process refund if payment was actually captured
        if (payment.status !== 'captured' && payment.status !== 'paid') {
            logger.warn({ status: payment.status }, LOGS.CHECKOUT_REFUND_SKIP_STATUS);
            // Update order payment status to indicate refund not needed
            return { skipped: true, reason: `Payment status is ${payment.status}` };
        }

        // Razorpay SDK: payments.refund(paymentId, options?)
        // paymentId is the first argument, NOT inside options
        const razorpayPaymentId = payment.razorpay_payment_id;
        const refundOptions = {};
        if (amount) {
            refundOptions.amount = Math.round(amount * 100); // Amount in paise
        }

        logger.info({ razorpayPaymentId, options: refundOptions }, LOGS.CHECKOUT_REFUND_API_CALL);
        const refund = await razorpay.payments.refund(razorpayPaymentId, refundOptions);
        logger.info({ refundId: refund.id }, LOGS.CHECKOUT_REFUND_SUCCESS);

        // Update DB - only update status (refund details already logged above)
        await updatePaymentRecord(paymentId, {
            status: PAYMENT_STATUS.REFUNDED
        });

        return refund;
    } catch (error) {
        logger.error({
            err: error.message,
            statusCode: error.statusCode,
            description: error.description
        }, LOGS.CHECKOUT_REFUND_FAIL);
        throw new Error(`${PAYMENT.REFUND_FAILED_NO_ID}: ${error.message || COMMON.UNKNOWN_ERROR}`);
    }
};

/**
 * Core Logic for Processing Payment Verification and Order Creation
 * Handles:
 * 1. Signature Verification (Client -> Razorpay)
 * 2. Server-to-Server (S2S) Verification (Source of Truth)
 * 3. Amount & Order ID Mismatch Checks
 * 4. Technical Refund Triggers on failure
 * 5. Order Recovery flow
 */
const processPaymentAndOrder = async (userId, checkoutData) => {
    const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        payment_id
    } = checkoutData;

    log.operationStart('VERIFYPaymentAndCreateOrder', { userId, payment_id });

    // 1. VERIFY SIGNATURE (Client Side Claim)
    let s2sPaymentDetails = null;
    let isValidSignature = verifyRazorpayPayment(razorpay_order_id, razorpay_payment_id, razorpay_signature);

    if (!isValidSignature) {
        log.warn(LOGS.CHECKOUT_SIG_FAIL_S2S_INIT, LOGS.CHECKOUT_SIG_S2S_FALLBACK, {
            razorpay_payment_id,
            razorpay_order_id
        });

        // If signature fails, we don't immediately reject. 
        // We do a Server-to-Server check directly with Razorpay.
        try {
            s2sPaymentDetails = await razorpay.payments.fetch(razorpay_payment_id);
            const payment = s2sPaymentDetails;

            logger.info({
                fetched_order_id: payment.order_id,
                expected_order_id: razorpay_order_id,
                status: payment.status
            }, LOGS.CHECKOUT_S2S_FETCHED);

            // Check 1: Is payment successful?
            if (payment.status !== RAZORPAY_STATUS.CAPTURED && payment.status !== RAZORPAY_STATUS.AUTHORIZED) {
                // If not captured, but we failed signature, we absolutely trigger a refund if possible
                const error = new Error(`${PAYMENT.STATUS_INVALID}: ${payment.status}`);
                error.status = 400;
                throw error;
            }

            // Check 2: Does Order ID match? 
            // Safety against replay attacks using a successful payment ID from a DIFFERENT order.
            if (razorpay_order_id && payment.order_id !== razorpay_order_id) {
                logger.error({
                    order_id: razorpay_order_id,
                    payment_order_id: payment.order_id,
                    payment_id: razorpay_payment_id
                }, LOGS.CHECKOUT_S2S_MISMATCH_REFUND);

                // VOID/REFUND immediately - this is highly suspicious
                try {
                    await refundPayment(razorpay_payment_id, null, {
                        reason: `Order ID mismatch: Payment is for ${payment.order_id}, expected ${razorpay_order_id}`
                    });
                } catch (refundError) {
                    logger.error({ err: refundError }, LOGS.CHECKOUT_S2S_REFUND_FAIL);
                }

                const error = new Error(PAYMENT.MISMATCH);
                error.status = 400;
                throw error;
            }

            // Check 3: Amount Match (Prevention of client-side amount tampering)
            // Fetch payment record to get intended amount
            if (payment_id) {
                const { data: dbPayment } = await supabase.from('payments').select('amount').eq('id', payment_id).single();
                const expectedPaise = Math.round(dbPayment.amount * 100);
                if (payment.amount !== expectedPaise) {
                    logger.error({ expected: expectedPaise, actual: payment.amount }, LOGS.CHECKOUT_S2S_MISMATCH_REFUND);

                    try {
                        await refundPayment(razorpay_payment_id, null, {
                            reason: `Amount mismatch: Paid ${payment.amount}, expected ${expectedPaise}`
                        });
                    } catch (refundError) {
                        logger.error({ err: refundError }, LOGS.CHECKOUT_S2S_REFUND_FAIL);
                    }

                    throw new Error(PAYMENT.MISMATCH);
                }
            }

            // If we are here, S2S says it's VALID!
            isValidSignature = true;
            logger.info({ razorpay_payment_id }, LOGS.CHECKOUT_S2S_PASSED);
        } catch (s2sError) {
            log.operationError('S2S_VERIFICATION_FAILED', s2sError, { razorpay_payment_id });
            // If it's our own error thrown above, keep it
            if (s2sError.status === 400) throw s2sError;

            const error = new Error(PAYMENT.VERIFICATION_FAILED);
            error.status = 400;
            throw error;
        }
    } else {
        logger.info({ razorpay_payment_id, payment_id }, LOGS.CHECKOUT_SIG_VERIFIED_INIT);
    }

    // 2. AUTO-CAPTURE if status is 'authorized'
    // This is a safety net if front-end capture failed or wasn't triggered
    try {
        const paymentDetails = s2sPaymentDetails || await razorpay.payments.fetch(razorpay_payment_id);
        if (paymentDetails.status === RAZORPAY_STATUS.AUTHORIZED) {
            logger.info({ razorpay_payment_id }, LOGS.CHECKOUT_S2S_REFUND_VALIDATE);
            // Capture the payment before proceeding
            // Note: We already validated the amount above or in the initial creation.
            await razorpay.payments.capture(razorpay_payment_id, paymentDetails.total_amount || paymentDetails.amount, paymentDetails.currency);
            logger.info({ razorpay_payment_id }, LOGS.CHECKOUT_S2S_PASSED);
        }
    } catch (captureErr) {
        log.warn(LOGS.CHECKOUT_S2S_FAIL, LOGS.CHECKOUT_PRE_CAPTURE_FAIL, { error: captureErr.message });
        // Don't fail here, createOrder might still work if capture happens via webhook or later.
    }

    // 3. RECOVERY CHECK: Prevent duplicate orders if order already created via Webhook
    let expectedInvoiceId = null;
    let expectedOrderNumber = null;

    if (payment_id) {
        const { data: currentPayment } = await supabase
            .from('payments')
            .select('order_id, status, error_description, invoice_id, metadata')
            .eq('id', payment_id)
            .single();

        if (currentPayment?.order_id) {
            logger.info({ orderId: currentPayment.order_id, payment_id }, LOGS.CHECKOUT_RECOVERY_SUCCESS);

            // Fetch fully populated order object
            const { data: order } = await supabase
                .from('orders')
                .select('*, orderItems(*)')
                .eq('id', currentPayment.order_id)
                .single();

            return {
                success: true,
                order
            };
        }

        // Check if payment previously failed a recovery attempt
        if (currentPayment?.status === 'refund_failed' || currentPayment?.status === 'refunded') {
            const error = new Error(`${PAYMENT.STATUS_INVALID}: ${currentPayment?.status}`);
            error.status = 400;
            throw error;
        }

        expectedInvoiceId = currentPayment?.invoice_id;
        expectedOrderNumber = currentPayment?.metadata?.receipt || null;
    } else if (razorpay_payment_id) {
        const { data: paymentByGatewayId } = await supabase
            .from('payments')
            .select('id, order_id, invoice_id, metadata')
            .eq('razorpay_payment_id', razorpay_payment_id)
            .maybeSingle();

        if (paymentByGatewayId?.order_id) {
            const { data: order } = await supabase
                .from('orders')
                .select('*, orderItems(*)')
                .eq('id', paymentByGatewayId.order_id)
                .single();

            if (order) {
                logger.info({
                    orderId: paymentByGatewayId.order_id,
                    razorpay_payment_id
                }, 'Recovered existing order using Razorpay payment id');

                return {
                    success: true,
                    order
                };
            }
        }

        expectedInvoiceId = paymentByGatewayId?.invoice_id || null;
        expectedOrderNumber = paymentByGatewayId?.metadata?.receipt || null;
    }

    // 4. Update payment record to captured status and link IDs
    if (payment_id) {
        await updatePaymentRecord(payment_id, {
            razorpay_payment_id,
            razorpay_signature,
            status: 'captured'
        });
    }

    // 5. Create Order
    try {
        // Fetch cart again (latest state)
        const cart = await getUserCart(userId);
        if (!cart || !cart.cart_items || cart.cart_items.length === 0) {
            throw new Error(PAYMENT.RAZORPAY_ERROR); // Unexpected state after payment
        }

        // Use the pre-fetched invoice_id and orderNumber from recovery check
        let invoice_id = expectedInvoiceId;
        let orderNumber = expectedOrderNumber;

        const order = await createOrder(userId, {
            ...checkoutData,
            payment_status: 'paid',
            invoice_id,
            orderNumber
        }, cart);

        log.operationSuccess('VERIFY_PAYMENT_AND_CREATE_ORDER', { orderId: order.id });

        return {
            success: true,
            order
        };
    } catch (systemError) {
        // --- CRITICAL FAILURE RECOVERY ---
        // If payment is SUCCESSFUL but order creation FAILED (DB Error, Network Error)
        // We MUST initiate an immediate refund to prevent "Paid but No Order" state.

        log.operationError('TECHNICAL_REFUND_RECOVERY', systemError, {
            userId,
            payment_id,
            razorpay_payment_id,
            msg: 'CRITICAL: Order creation failed after successful payment. Initiating technical refund.'
        });

        // 1. Trigger Refund
        if (razorpay_payment_id) {
            try {
                logger.info({ razorpay_payment_id, payment_id }, LOGS.CHECKOUT_DB_FAIL_REFUND_INIT);

                // Option A: Use RefundService (preferred - tracks in DB)
                if (payment_id) {
                    await RefundService.asyncProcessRefund(
                        payment_id,
                        REFUND_TYPES.TECHNICAL_REFUND,
                        'SYSTEM',
                        `Order creation failed: ${systemError.message}`,
                        true // Bypass admin check for technical recovery
                    );
                } else {
                    // Option B: Direct Razorpay refund (fallback)
                    await razorpay.payments.refund(razorpay_payment_id, {
                        notes: {
                            reason: `Order creation failed: ${systemError.message}`,
                            type: 'TECHNICAL_REFUND'
                        }
                    });
                }

                logger.info({ razorpay_payment_id, payment_id }, LOGS.CHECKOUT_DB_FAIL_REFUND_SUCCESS);

                const userError = new Error(PAYMENT.ORDER_FAILED_REFUNDED);
                userError.status = 500;
                throw userError;

            } catch (refundError) {
                // OH NO: Refund also failed!
                // This is a CRITICAL manual intervention required state.
                logger.error({
                    err: refundError,
                    razorpay_payment_id,
                    payment_id,
                    originalError: systemError.message
                }, LOGS.CHECKOUT_DB_FAIL_REFUND_CRITICAL);

                // Update payment record to alert admins
                if (payment_id) {
                    try {
                        await updatePaymentRecord(payment_id, {
                            status: 'refund_failed',
                            error_description: `Order creation failed: ${systemError.message}. Refund failed: ${refundError.message}`
                        });
                    } catch (updateErr) {
                        logger.error({ err: updateErr, payment_id }, LOGS.CHECKOUT_HIST_FAIL);
                    }
                }

                const userError = new Error(PAYMENT.ORDER_FAILED_REFUND_CRITICAL);
                userError.status = 500;
                throw userError;
            }
        } else {
            // Mock payment or no payment ID - just re-throw the original error
            throw systemError;
        }
    }
}

/**
 * Process Buy Now Order
 * Creates an order for a single item without using the cart
 */
/**
 * Process Buy Now flow
 * Refactored to reuse standard createOrder logic via a virtual cart
 */
const processBuyNowOrder = async (userId, paymentData, buyNowData) => {
    const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        payment_id,
        shipping_address_id,
        billing_address_id,
        notes
    } = paymentData;

    const { productId, variantId, quantity = 1, couponCode = null } = buyNowData;

    log.info(LOGS.CHECKOUT_BUY_NOW_START, LOGS.CHECKOUT_BUY_NOW_START, { userId, productId, variantId, quantity });

    // Verify payment signature
    let isValidSignature = verifyRazorpayPayment(razorpay_order_id, razorpay_payment_id, razorpay_signature);
    if (!isValidSignature) {
        log.warn(LOGS.CHECKOUT_SIG_FAIL_S2S_INIT, LOGS.CHECKOUT_SIG_S2S_FALLBACK, {
            razorpay_payment_id,
            razorpay_order_id
        });

        try {
            // Server-to-Server Verification (Source of Truth)
            const payment = await razorpay.payments.fetch(razorpay_payment_id);

            log.info({
                fetched_order_id: payment.order_id,
                expected_order_id: razorpay_order_id,
                status: payment.status
            }, LOGS.CHECKOUT_S2S_FETCHED);

            // Check 1: Is payment successful?
            if (payment.status !== RAZORPAY_STATUS.CAPTURED && payment.status !== RAZORPAY_STATUS.AUTHORIZED) {
                throw new Error(`${PAYMENT.STATUS_INVALID}: ${payment.status}`);
            }

            // Check 2: Does Order ID match?
            if (razorpay_order_id && payment.order_id !== razorpay_order_id) {
                throw new Error(PAYMENT.MISMATCH);
            }

            // If we are here, S2S is valid!
            isValidSignature = true;
            logger.info(LOGS.CHECKOUT_S2S_PASSED, 'S2S verification passed for Buy Now. Proceeding with order creation.');

        } catch (s2sError) {
            log.operationError('S2S_VERIFICATION', s2sError);
            const error = new Error(PAYMENT.VERIFICATION_FAILED);
            error.status = 400;
            throw error;
        }
    }

    // Update payment record
    if (payment_id) {
        await updatePaymentRecord(payment_id, {
            razorpay_payment_id,
            razorpay_signature,
            status: 'captured'
        });
    }

    try {
        // 2. Construct Virtual Cart (Merged with existing cart item if present)
        const virtualCart = await createBuyNowVirtualCart(userId, null, { productId, variantId, quantity, couponCode });
        virtualCart.id = null; // Explicitly set to null for createOrder to treat it as virtual (no DB updates)

        // 3. Reuse standard createOrder logic
        // We need to fetch the invoice_id and receipt (order number) from the payment record if it exists
        let invoice_id = null;
        let orderNumber = null;
        let notesWithRef = notes || CHECKOUT.BUY_NOW_DEFAULT_NOTES; // Use new variable instead of reassigning const

        if (payment_id) {
            const { data: paymentRecord } = await supabase
                .from('payments')
                .select('invoice_id, metadata')
                .eq('id', payment_id)
                .single();
            invoice_id = paymentRecord?.invoice_id;
            orderNumber = paymentRecord?.metadata?.receipt || null;

            if (orderNumber && notes && typeof notes === 'string') {
                notesWithRef = `${notes} (${CHECKOUT.ORDER_REF_PREFIX}: ${orderNumber})`;
            }
        }

        const order = await createOrder(
            userId,
            {
                shipping_address_id,
                billing_address_id,
                payment_id,
                notes: notesWithRef,
                payment_status: 'paid',
                razorpay_payment_id,
                invoice_id,
                orderNumber: orderNumber // Use the pre-generated number from Razorpay receipt
            },
            virtualCart
        );


        // 4. CLEANUP: Remove the purchased item from cart if it exists
        if (userId) {
            try {
                await removeFromCart(userId, null, productId, variantId);
                log.info(LOGS.CHECKOUT_BUY_NOW_CLEANUP, LOGS.CHECKOUT_BUY_NOW_CLEANUP, { productId, variantId });
            } catch (cleanupError) {
                log.warn(LOGS.CHECKOUT_BUY_NOW_CLEANUP, LOGS.CHECKOUT_BUY_NOW_CLEANUP, { err: cleanupError });
            }
        }

        log.info(LOGS.CHECKOUT_BUY_NOW_SUCCESS, LOGS.CHECKOUT_BUY_NOW_SUCCESS, { orderId: order.id });

        return {
            success: true,
            order: {
                id: order.id,
                order_number: order.order_number,
                total_amount: order.total_amount,
                status: order.status
            }
        };

    } catch (error) {
        log.operationError('BUY_NOW_ERROR', error, { productId, variantId });

        // TECHNICAL REFUND: If order creation fails after payment
        if (razorpay_payment_id) {
            let refundSuccess = false;
            let refundError = null;

            try {
                if (payment_id) {
                    await RefundService.asyncProcessRefund(payment_id, REFUND_TYPES.TECHNICAL_REFUND, 'SYSTEM', `Buy Now order failed: ${error.message}`, true);
                } else {
                    await refundPayment(razorpay_payment_id, null, {
                        reason: `Buy Now order failed: ${error.message}`
                    });
                }
                refundSuccess = true;
                logger.info({ razorpay_payment_id, payment_id }, LOGS.CHECKOUT_DB_FAIL_REFUND_INIT);
            } catch (refundErr) {
                refundError = refundErr;
                logger.error({
                    err: refundErr,
                    razorpay_payment_id,
                    payment_id,
                    originalError: error.message
                }, LOGS.CHECKOUT_DB_FAIL_REFUND_CRITICAL);

                // Update payment record to indicate refund failure
                if (payment_id) {
                    try {
                        await updatePaymentRecord(payment_id, {
                            status: 'refund_failed',
                            error_description: `Order failed: ${error.message}. Refund failed: ${refundErr.message}`
                        });
                    } catch (updateErr) {
                        logger.error({ err: updateErr, payment_id }, LOGS.CHECKOUT_HIST_FAIL);
                    }
                }
            }

            // Throw user-friendly error based on refund status
            if (refundSuccess) {
                const userError = new Error(PAYMENT.ORDER_FAILED_REFUNDED);
                userError.status = 500;
                throw userError;
            } else {
                const userError = new Error(PAYMENT.ORDER_FAILED_REFUND_CRITICAL);
                userError.status = 500;
                throw userError;
            }
        }

        throw error;
    }
}

/**
 * Get summary for Buy Now flow
 * Reuses standard calculation logic by constructing a virtual cart
 */
const getBuyNowSummary = async (userId, buyNowData, addressId = null) => {
    try {
        const { productId, variantId, quantity = 1 } = buyNowData;

        // 1. Create virtual cart
        const virtualCart = await createBuyNowVirtualCart(userId, null, buyNowData);

        // 2. Calculate totals using standard service
        let totals;
        try {
            totals = await calculateCartTotals(userId, null, virtualCart, { addressId });
        } catch (calcError) {
            log.operationError('BUY_NOW_CALCULATION', calcError, { buyNowData });
            throw new Error(`Calculation Failed: ${calcError.message}`);
        }

        // 3. Fetch dependencies in parallel
        const [profileResult, allAddresses] = await Promise.all([
            supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
            getUserAddresses(userId)
        ]);
        const profile = profileResult.data;

        // 4. Resolve Addresses
        let shippingAddress = null;
        if (addressId) {
            shippingAddress = allAddresses.find(a => a.id === addressId);
        }

        if (!shippingAddress) {
            // Fallback sequence: Primary Home/Work -> Any Home/Work -> Any Primary -> First Available
            shippingAddress = allAddresses.find(a => a.is_primary && (a.type === 'home' || a.type === 'work' || a.type === 'both')) ||
                allAddresses.find(a => a.type === 'home' || a.type === 'work' || a.type === 'both') ||
                allAddresses.find(a => a.is_primary) ||
                allAddresses[0];
        }

        // Validate completeness
        if (shippingAddress) {
            const requiredFields = ['full_name', 'street_address', 'city', 'state', 'postal_code', 'phone'];
            const isIncomplete = requiredFields.some(field => !shippingAddress[field]);
            if (isIncomplete) {
                log.warn(LOGS.CHECKOUT_SUMMARY_INCOMPLETE_ADDR, LOGS.CHECKOUT_SUMMARY_INCOMPLETE_ADDR, { addressId: shippingAddress.id });
                shippingAddress = null;
            }
        }

        return {
            cart: virtualCart,
            totals: totals,
            shipping_address: shippingAddress,
            billing_address: shippingAddress, // Default billing to shipping for now
            user_profile: profile,
            is_buy_now: true
        };

    } catch (error) {
        log.operationError('BUY_NOW_SUMMARY', error);
        throw error;
    }
};

module.exports = {
    getCheckoutSummary,
    getBuyNowSummary,
    createRazorpayInvoice,
    verifyRazorpayPayment,
    createPaymentRecord,
    updatePaymentRecord,
    createOrder,
    processPaymentAndOrder,
    processBuyNowOrder,

    processRefund
};
