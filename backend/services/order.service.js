
const Razorpay = require('razorpay');
const logger = require('../utils/logger');
const supabase = require('../config/supabase');
const { supabaseAdmin } = require('../config/supabase');
const emailService = require('./email');
const razorpayInvoiceService = require('./razorpay-invoice.service');
const { formatAddress } = require('./address.service');
// PERFORMANCE: Moved to top-level to avoid require() overhead on each function call
const inventoryService = require('./inventory.service');
const checkoutService = require('./checkout.service');
// GST Invoice and Audit
const { InvoiceOrchestrator } = require('./invoice-orchestrator.service');
const { FinancialEventLogger } = require('./financial-event-logger.service');
const { RefundService, REFUND_TYPES } = require('./refund.service');
const {
    ORDER_STATUS,
    ALLOWED_TRANSITIONS,
    STATUS_MESSAGES,
    isValidTransition,
    logStatusHistory
} = require('./history.service');
const { ORDER, PAYMENT, LOGS, COMMON, INVENTORY } = require('../constants/messages');
const { translate } = require('../utils/i18n.util');
const { getBackendBaseUrl } = require('../utils/backend-url');

/**
 * Centrally manages order status updates including validation, inventory, and logging.
 * @param {string} newStatus 
 * @param {string} userId 
 * @param {string} notes 
 * @returns {Promise<{success: boolean, order?: object, error?: string, status?: number}>}
 */
async function updateOrderStatus(orderId, newStatus, userId, notes = '', role = 'customer', options = {}) {
    const { restoreInventory } = inventoryService;

    try {
        // 1. Get current order (use existing if provided to avoid N+1 queries)
        let order = options.existingOrder;

        if (!order) {
            logger.info({ orderId }, "DEBUG_SPEED: Fetching order...");
            const { data, error: fetchError } = await supabase
                .from('orders')
                .select('*, items:order_items(*)')
                .eq('id', orderId)
                .single();

            if (fetchError || !data) {
                return { success: false, status: 404, error: ORDER.ORDER_NOT_FOUND };
            }
            order = data;
        }

        const previousStatus = order.status;

        // 2. Validate Transition (Skip for Admin/Manager)
        const isAdminOrManager = ['admin', 'manager'].includes(role);
        if (!isAdminOrManager && !isValidTransition(previousStatus, newStatus)) {
            return {
                success: false,
                status: 400,
                error: ORDER.INVALID_TRANSITION
            };
        }

        // 3. Inventory Management Logic
        const inventoryRestoreStatuses = [ORDER_STATUS.CANCELLED, ORDER_STATUS.RETURN_APPROVED];
        const activeStatuses = [
            ORDER_STATUS.PENDING,
            ORDER_STATUS.CONFIRMED,
            ORDER_STATUS.PROCESSING,
            ORDER_STATUS.PACKED,
            ORDER_STATUS.SHIPPED,
            ORDER_STATUS.OUT_FOR_DELIVERY,
            ORDER_STATUS.DELIVERED,
            ORDER_STATUS.DELIVERY_UNSUCCESSFUL
        ];

        const wasActive = activeStatuses.includes(previousStatus);
        const becomingInactive = inventoryRestoreStatuses.includes(newStatus) || newStatus === ORDER_STATUS.RETURNED;

        // Determine if a refund will be initiated (for frontend UX)
        const PRE_SHIP_STATUSES = [ORDER_STATUS.PENDING, ORDER_STATUS.CONFIRMED, ORDER_STATUS.PROCESSING, ORDER_STATUS.PACKED];
        const isPaid = order.payment_status === 'paid';
        const refundWillBeInitiated = isPaid && (
            (newStatus === ORDER_STATUS.CANCELLED && PRE_SHIP_STATUSES.includes(previousStatus)) ||
            (newStatus === ORDER_STATUS.RETURNED)
        );

        // 4. Update Order Status
        logger.info({ orderId, newStatus }, "DEBUG_SPEED: Initiating DB Update...");
        const updateData = {
            status: newStatus,
            updated_at: new Date().toISOString()
        };

        if (refundWillBeInitiated) {
            if (newStatus === ORDER_STATUS.CANCELLED) {
                updateData.payment_status = 'refund_initiated';
            } else if (newStatus === ORDER_STATUS.RETURNED && previousStatus === ORDER_STATUS.DELIVERY_UNSUCCESSFUL) {
                updateData.payment_status = 'refund_initiated';
            }
        }

        // If status is delivery_unsuccessful, also save the reason
        if (newStatus === ORDER_STATUS.DELIVERY_UNSUCCESSFUL && notes) {
            // we remove the prefix if it exists to store only the raw reason if possible, 
            // but usually notes passed here is already prefixed from frontend.
            // For now, let's store it as is, or strip common prefixes.
            const prefixes = [
                "Delivery unsuccessful: ",
                "डिलीवरी असफल: ",
                "டெலிவரி தோல்வியடைந்தது: ",
                "డెలివరీ విఫలమైంది: "
            ];
            let cleanReason = notes;
            for (const p of prefixes) {
                if (cleanReason.startsWith(p)) {
                    cleanReason = cleanReason.slice(p.length).trim();
                    break;
                }
            }
            updateData.delivery_unsuccessful_reason = cleanReason;
        }

        // Wait for core update (Status) with Optimistic Concurrency Control
        const updateResult = await supabase
            .from('orders')
            .update(updateData)
            .eq('id', orderId)
            .eq('status', previousStatus) // CRITICAL: Prevent concurrent updates racing
            .select();

        logger.info({ orderId }, "DEBUG_SPEED: DB Update Completed.");

        if (updateResult.error) {
            logger.error({ err: updateResult.error, orderId }, LOGS.ORDER_DB_UPDATE_FAIL);
            throw updateResult.error;
        }

        const updatedOrder = updateResult.data?.[0];
        if (!updatedOrder) {
            logger.error({ orderId, role, previousStatus, newStatus }, "Concurrent modification detected. Order status changed before update could complete.");
            throw new Error(translate('errors.order.statusChanged'));
        }

        // --- BACKGROUND PROCESSING ---
        // Side effects are offloaded to improve API response time
        (async () => {
            try {
                // 5. Restore Inventory (Offloaded to improve API response time)
                if (wasActive && becomingInactive && order.items) {
                    logger.info({ orderId, newStatus }, LOGS.ORDER_RESTORE_INVENTORY);
                    restoreInventory(order.items).catch(err =>
                        logger.error({ err: err.message, orderId }, "Inventory restoration failed in background")
                    );
                }

                // 6. Log History
                const statusMessage = notes || STATUS_MESSAGES[newStatus] || `${ORDER.DEFAULT_STATUS_UPDATE}: ${newStatus}`;
                const actingRole = (role === 'admin' || role === 'manager') ? 'ADMIN' : 'USER';
                await logStatusHistory(orderId, newStatus, userId, statusMessage, actingRole);

                // 6. Handle Refund Logic
                if (refundWillBeInitiated) {
                    let resolvedPaymentId = order.payment_id;
                    if (!resolvedPaymentId) {
                        logger.info({ orderId }, LOGS.ORDER_PAYMENT_FALLBACK);
                        const { data: paymentRecord } = await supabase
                            .from('payments')
                            .select('id')
                            .eq('order_id', orderId)
                            .maybeSingle();
                        if (paymentRecord) {
                            resolvedPaymentId = paymentRecord.id;
                            logger.info({ orderId, paymentId: resolvedPaymentId }, LOGS.ORDER_PAYMENT_FOUND);
                        }
                    }

                    if (resolvedPaymentId) {
                        // Case 1: Cancelled before shipping
                        if (newStatus === ORDER_STATUS.CANCELLED) {
                            // payment_status is already set to 'refund_initiated' in the main updateData
                            RefundService.asyncProcessRefund(orderId, REFUND_TYPES.BUSINESS_REFUND, userId, ORDER.CANCEL_SUCCESS)
                                .catch(err => logger.error({ orderId, err: err.message }, LOGS.ORDER_REFUND_FAIL));
                        }

                        // Case 2: Product returned
                        if (newStatus === ORDER_STATUS.RETURNED) {
                            if (previousStatus === ORDER_STATUS.DELIVERY_UNSUCCESSFUL) {
                                logger.info({ orderId }, 'Initiating refund for delivery_unsuccessful -> returned');
                                // Direct refund initiation as there is no customer return_request to verify
                                RefundService.asyncProcessRefund(
                                    orderId,
                                    REFUND_TYPES.BUSINESS_REFUND,
                                    userId,
                                    'Delivery unsuccessful - item returned to warehouse'
                                ).then(async (refundResult) => {
                                    if (refundResult?.success) {
                                        FinancialEventLogger.logRefundInitiated(orderId, { totalRefund: refundResult.amount })
                                            .catch(err => logger.error({ orderId, err: err.message }, LOGS.ORDER_REFUND_FAIL));
                                    }
                                }).catch(err => logger.error({ orderId, err: err.message }, LOGS.ORDER_REFUND_FAIL));
                            } else {
                                logger.info({ orderId }, LOGS.ORDER_RETURN_VERIFY_INIT);
                                const { data: returnReq, error: retErr } = await supabase
                                    .from('returns')
                                    .select('id, refund_amount, refund_breakdown')
                                    .eq('order_id', orderId)
                                    .eq('status', 'approved')
                                    .maybeSingle();

                                if (retErr || !returnReq) {
                                    logger.error({ orderId }, LOGS.ORDER_RETURN_NO_REQUEST);
                                } else {
                                    const verifiedRefundAmount = returnReq.refund_amount;
                                    if (!verifiedRefundAmount || verifiedRefundAmount <= 0) {
                                        logger.error({ orderId, amount: verifiedRefundAmount }, LOGS.ORDER_RETURN_VERIFY_FAIL);
                                    } else {
                                        logger.info({ orderId, amount: verifiedRefundAmount }, LOGS.ORDER_REFUND_SUCCESS);
                                        RefundService.asyncProcessRefund(
                                            orderId,
                                            REFUND_TYPES.BUSINESS_REFUND,
                                            userId,
                                            ORDER.RETURN_SUCCESS,
                                            false,
                                            verifiedRefundAmount
                                        ).then(async (refundResult) => {
                                            if (refundResult?.success) {
                                                logger.info({ orderId }, LOGS.ORDER_REFUND_SUCCESS);
                                                // Log financial event
                                                FinancialEventLogger.logRefundInitiated(orderId, returnReq.refund_breakdown || { totalRefund: returnReq.refund_amount })
                                                    .catch(err => logger.error({ orderId, err: err.message }, LOGS.ORDER_REFUND_FAIL));
                                            } else {
                                                logger.info({ orderId, reason: refundResult.reason }, LOGS.ORDER_REFUND_FAIL);
                                            }
                                        }).catch(err => logger.error({ orderId, err: err.message }, LOGS.ORDER_REFUND_FAIL));
                                    }
                                }
                            } // End else
                        }
                    }
                }

                // 7. Generate GST Invoice on DELIVERED
                if (newStatus === ORDER_STATUS.DELIVERED) {
                    try {
                        const result = await InvoiceOrchestrator.generateInternalInvoice(orderId);
                        if (result.success) {
                            logger.info({ orderId, invoiceId: result.invoiceId }, LOGS.ORDER_INVOICE_GEN_SUCCESS);
                        } else {
                            logger.error({ orderId, err: result.error }, LOGS.ORDER_INVOICE_GEN_FAIL);
                        }
                    } catch (err) {
                        logger.error({ orderId, err: err.message }, LOGS.ORDER_INVOICE_GEN_FAIL);
                    }
                }

                // 8. Send Email Notifications (v2 Dedicated Flow)
                const { ALLOWED_ORDER_EMAIL_STATES } = require('./email/types');
                if (ALLOWED_ORDER_EMAIL_STATES[newStatus]) {
                    getOrderById(orderId, { role: 'admin', id: 'system' })
                        .then(async (fullOrder) => {
                            const to = fullOrder.customer_email;
                            const customerName = fullOrder.customer_name;
                            if (!to) return;

                            switch (newStatus) {
                                case ORDER_STATUS.CONFIRMED:
                                    await emailService.sendOrderConfirmedEmail(to, { order: fullOrder, customerName }, fullOrder.user_id);
                                    break;
                                case ORDER_STATUS.SHIPPED:
                                    await emailService.sendOrderShippedEmail(to, { order: fullOrder, customerName }, fullOrder.user_id);
                                    break;
                                case ORDER_STATUS.DELIVERED: {
                                    // Always prefer the internal GST invoice from the invoices table
                                    // (not fullOrder.invoice_url which may be a raw Supabase URL)
                                    const backendBase = getBackendBaseUrl();
                                    let invoiceUrl = null;

                                    const { data: internalInv } = await supabase.from('invoices')
                                        .select('id, type')
                                        .eq('order_id', orderId)
                                        .in('type', ['TAX_INVOICE', 'BILL_OF_SUPPLY'])
                                        .order('created_at', { ascending: false })
                                        .limit(1)
                                        .maybeSingle();

                                    if (internalInv) {
                                        // Use proxied backend URL to mask internal storage details
                                        invoiceUrl = `${backendBase}/api/invoices/${internalInv.id}/download`;
                                    }

                                    await emailService.sendOrderDeliveredEmail(to, { order: fullOrder, customerName, invoiceUrl }, fullOrder.user_id);
                                    break;
                                }
                                case ORDER_STATUS.RETURNED:
                                    await emailService.sendOrderReturnedEmail(to, { order: fullOrder, customerName }, fullOrder.user_id);
                                    break;
                                case ORDER_STATUS.CANCELLED:
                                    await emailService.sendOrderCancellationEmail(to, { order: fullOrder, customerName }, fullOrder.user_id);
                                    logger.info({ customerEmail: to, orderId }, LOGS.ORDER_EMAIL_SUCCESS);
                                    break;
                            }
                        })
                        .catch(err => logger.error({ orderId, err: err.message }, LOGS.ORDER_EMAIL_FAIL));
                }

                // 9. Audit Event
                await FinancialEventLogger.logOrderUpdated(orderId, previousStatus, newStatus, isAdminOrManager ? userId : null)
                    .catch(err => logger.warn({ orderId, err: err.message }, LOGS.ORDER_DB_UPDATE_FAIL));

            } catch (bgError) {
                logger.error({ err: bgError, orderId }, "Background status update tasks failed");
            }
        })();

        return { success: true, order: updatedOrder, refundInitiated: refundWillBeInitiated };

    } catch (error) {
        logger.error({ err: error, orderId }, LOGS.ORDER_DB_UPDATE_FAIL);
        return { success: false, status: 500, error: error.message };
    }
}

/**
 * Get all orders with filtering and pagination
 */
/**
 * Get all orders with filtering and pagination
 */
async function getAllOrders(user, {
    orderNumber,
    all,
    page = 1,
    limit = 10,
    status,
    payment_status,
    startDate,
    endDate,
    shallow = 'false'
}) {
    const startTime = Date.now();
    page = parseInt(page) || 1;
    limit = parseInt(limit) || 10;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const selectFields = shallow === 'true'
        ? 'id, order_number, total_amount, status, payment_status, created_at, user_id, customer_name, profiles:user_id(id, name, email)'
        : 'id, order_number, total_amount, status, payment_status, created_at, user_id, customer_name, items, profiles:user_id(id, name, email)';

    let query = supabase
        .from('orders')
        .select(selectFields, { count: 'exact' })
        .order('created_at', { ascending: false });

    // Multi-status filtering support
    if (status === 'active_returns') {
        query = query.in('status', ['return_requested', 'return_approved']);
    } else if (status === 'failed_flow') {
        // Failed orders: delivery_unsuccessful status OR payment_status = 'failed' OR any order that was previously delivery_unsuccessful
        query = query.or(`status.eq.delivery_unsuccessful,payment_status.eq.failed,delivery_unsuccessful_reason.not.is.null`);
    } else if (status === 'cancelled_flow') {
        const { data: refundedOrders } = await supabaseAdmin.from('orders').select('id, returns(id)').eq('status', 'refunded');
        const refundedCancelledIds = (refundedOrders || []).filter(o => !o.returns || (Array.isArray(o.returns) ? o.returns.length === 0 : false)).map(o => o.id);
        if (refundedCancelledIds.length > 0) {
            query = query.or(`status.eq.cancelled,id.in.(${refundedCancelledIds.join(',')})`);
        } else {
            query = query.eq('status', 'cancelled');
        }
    } else if (status === 'returned_flow') {
        const { data: refundedOrders } = await supabaseAdmin.from('orders').select('id, returns(id)').eq('status', 'refunded');
        const refundedReturnedIds = (refundedOrders || []).filter(o => o.returns && (Array.isArray(o.returns) ? o.returns.length > 0 : true)).map(o => o.id);
        const returnedStatuses = ['returned', 'partially_returned', 'partially_refunded'];
        if (refundedReturnedIds.length > 0) {
            query = query.or(`status.in.(${returnedStatuses.join(',')}),id.in.(${refundedReturnedIds.join(',')})`);
        } else {
            query = query.in('status', returnedStatuses);
        }
    } else if (status && status !== 'all') {
        // Support comma separated statuses (e.g. "pending,confirmed,processing")
        if (status.includes(',')) {
            const statuses = status.split(',').map(s => s.trim());
            query = query.in('status', statuses);
        } else {
            query = query.eq('status', status);
        }
    }

    if (user.role === 'admin' || user.role === 'manager') {
        if (all !== 'true') {
            query = query.eq('user_id', user.id);
        }
        if (orderNumber) {
            query = query.ilike('order_number', `%${orderNumber}%`);
        }
    } else {
        query = query.eq('user_id', user.id);
        if (orderNumber) {
            query = query.ilike('order_number', `%${orderNumber}%`);
        }
    }

    if (payment_status && payment_status !== 'all') {
        query = query.eq('payment_status', payment_status);
    }
    if (startDate) {
        query = query.gte('created_at', startDate);
    }
    if (endDate) {
        query = query.lte('created_at', endDate);
    }

    query = query.range(from, to);

    const { data: orders, error, count } = await query;

    if (error) throw error;

    const ordersWithProfiles = orders.map(order => {
        const profile = order.profiles || {};
        return {
            ...order,
            user: profile.id ? profile : { name: COMMON.UNKNOWN, email: COMMON.NA },
            customer_name: profile.name || order.customer_name || COMMON.GUEST,
            total_amount: order.total_amount || 0,
            total: order.total_amount || 0,
            status: order.status || 'pending',
            payment_status: order.payment_status || 'pending',
            created_at: order.created_at
        };
    });

    const duration = Date.now() - startTime;
    logger.info({
        count: count,
        page: page,
        durationMs: duration,
        shallow: shallow
    }, LOGS.ORDER_DB_UPDATE_INIT);

    const totalPages = Math.ceil(count / limit);

    return {
        data: ordersWithProfiles,
        meta: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: count,
            pages: totalPages,
            totalPages: totalPages
        }
    };
}

async function createOrder(userId, orderData, userEmail, userName) {
    orderData.user_id = userId;
    orderData.status = ORDER_STATUS.PENDING;

    const { data, error } = await supabase
        .from('orders')
        .insert([orderData])
        .select()
        .single();

    if (error) throw error;

    await logStatusHistory(data.id, ORDER_STATUS.PENDING, userId, ORDER.ORDER_CREATED);

    const customerEmail = orderData.customer_email || orderData.customerEmail || userEmail;
    const customerNameVal = orderData.customer_name || orderData.customerName || userName || COMMON.CUSTOMER;

    if (customerEmail) {
        emailService.sendOrderPlacedEmail(
            customerEmail,
            {
                order: data,
                customerName: customerNameVal,
                receiptUrl: data.invoiceUrl || orderData.invoiceUrl
            },
            userId
        )
            .then(res => logger.info({ orderId: data.id }, LOGS.ORDER_EMAIL_SUCCESS))
            .catch(err => logger.error({ err, orderId: data.id }, LOGS.ORDER_EMAIL_FAIL));
    }
    else {
        logger.warn({ orderId: data.id }, LOGS.ORDER_EMAIL_DISABLED);
    }

    return data;
}

async function getOrderById(id, user) {
    logger.info({ orderId: id }, LOGS.ORDER_HISTORY_FETCH);
    const { data, error } = await supabase
        .from('orders')
        .select(`
            *,
            items:order_items (*, products:product_id(images), product_variants:variant_id(variant_image_url)),
            profiles:profiles!user_id (name, email, phone),
            shipping_address:addresses!shipping_address_id (*, phone_numbers (*)),
            billing_address:addresses!billing_address_id (*, phone_numbers (*)),
            payments:payments!order_id (*, refunds (*)),
            invoices (*),
            refunds (*),
            order_status_history:order_status_history (*)
        `)
        .eq('id', id)
        .maybeSingle();

    if (error) throw error;

    if (data && data.order_status_history) {
        logger.info({
            orderId: id,
            historyCount: data.order_status_history.length
        }, LOGS.ORDER_HISTORY_FETCH);
    } else {
        logger.warn({ orderId: id }, LOGS.ORDER_HISTORY_MISSING);
    }

    if (!data) {
        const err = new Error(ORDER.ORDER_NOT_FOUND);
        err.status = 404;
        throw err;
    }

    // Access Control
    const isOwner = user.id === data.user_id;
    const isAdminOrManager = ['admin', 'manager'].includes(user.role);

    if (!isOwner && !isAdminOrManager) {
        const err = new Error(COMMON.UNAUTHORIZED);
        err.status = 403;
        throw err;
    }

    // Use joined data from the single query
    const profile = data.profiles || {};
    const dbShippingAddress = data.shipping_address;
    const dbBillingAddress = data.billing_address;
    let invoices = data.invoices || [];
    let paymentDetails = data.payments ? (Array.isArray(data.payments) ? data.payments[0] : data.payments) : null;

    // Process Refunds from both direct relation and payment relation
    const directRefunds = (data.refunds || []).map(r => ({ ...r, notes: r.reason || r.notes }));
    const paymentRefunds = (paymentDetails?.refunds || []).map(r => ({ ...r, notes: r.reason || r.notes }));

    // De-duplicate refunds by ID
    const refundsMap = new Map();
    [...directRefunds, ...paymentRefunds].forEach(r => {
        if (r.id) refundsMap.set(r.id, r);
    });
    data.refunds = Array.from(refundsMap.values());

    // Process Invoices (Generate proxy URLs)
    invoices = invoices.map(inv => {
        if (inv.type !== 'RAZORPAY') {
            const backendBase = getBackendBaseUrl();
            return {
                ...inv,
                public_url: `${backendBase}/api/invoices/${inv.id}/download`
            };
        }
        return inv;
    });

    const emailLogs = [];


    const hasRazorpayInvoice = invoices.some(i => i.type === 'RAZORPAY');
    if (!hasRazorpayInvoice && paymentDetails?.invoice_id) {
        // PERFORMANCE: Fire-and-forget invoice fetch to avoid blocking the read response
        // This "self-healing" will happen in the background and populate for the NEXT read
        (async () => {
            try {
                const key_id = process.env.RAZORPAY_KEY_ID;
                const key_secret = process.env.RAZORPAY_KEY_SECRET;
                if (key_id && key_secret) {
                    const razorpay = new Razorpay({ key_id, key_secret });
                    let inv = await razorpay.invoices.fetch(paymentDetails.invoice_id);

                    if (inv.status === 'draft') {
                        logger.info({ orderId: id, invoiceId: inv.id }, LOGS.ORDER_FALLBACK_INV_INIT);
                        inv = await razorpay.invoices.issue(inv.id);
                    }

                    if (inv.short_url) {
                        // We don't push to the 'invoices' array here because we've already responded
                        // The user will see it on next refresh
                        await supabase.from('invoices').insert({
                            order_id: id,
                            type: 'RAZORPAY',
                            invoice_number: inv.invoice_number,
                            provider_id: inv.id,
                            public_url: inv.short_url,
                            status: (inv.status === 'paid' || inv.status === 'issued') ? 'GENERATED' : inv.status.toUpperCase()
                        });
                        logger.info({ orderId: id }, LOGS.ORDER_SELF_HEAL_INV);
                    }
                }
            } catch (e) {
                logger.warn({ err: e, orderId: id, invoiceId: paymentDetails.invoice_id }, LOGS.ORDER_INVOICE_FETCH_FAIL);
            }
        })();
    }

    // Process Addresses
    let shippingAddress = data.shippingAddress || data.shipping_address;
    if (dbShippingAddress && (!shippingAddress || !shippingAddress.phone)) {
        shippingAddress = formatAddress(dbShippingAddress);
    } else {
        shippingAddress = formatAddress(shippingAddress);
    }

    let billingAddress = data.billingAddress || data.billing_address;
    if (dbBillingAddress && (!billingAddress || !billingAddress.phone)) {
        billingAddress = formatAddress(dbBillingAddress);
    } else {
        billingAddress = formatAddress(billingAddress);
    }

    // Map items
    const mappedItems = (data.items || []).map(item => {
        const productInfo = item.products || item.product || item;
        return {
            ...item,
            product: {
                id: productInfo.id || item.product_id,
                title: productInfo.title || item.title || INVENTORY.DEFAULT_PRODUCT_TITLE,
                price: productInfo.price || item.price || 0,
                images: productInfo.images || item.images || [],
                isReturnable: productInfo.isReturnable ?? productInfo.is_returnable ?? true
            },
            variant: item.variant_snapshot || item.variants || item.variant || null
        };
    });

    return {
        ...data,
        customer_name: profile.name || data.customer_name || COMMON.UNKNOWN,
        customer_email: profile.email || data.customer_email || COMMON.NA,
        customer_phone: profile.phone || data.customer_phone || shippingAddress?.phone,
        shipping_address: shippingAddress,
        billing_address: {
            ...billingAddress,
            phone: billingAddress?.phone || shippingAddress?.phone || data.customer_phone || ''
        },
        items: mappedItems,
        created_at: data.created_at,
        total_amount: data.total_amount || 0,
        payment_status: data.payment_status || 'pending',
        payment_id: paymentDetails?.razorpay_payment_id || data.payment_id,
        payment_method: paymentDetails?.method,
        email_logs: emailLogs,
        delivery_charge: data.delivery_charge || 0,
        delivery_gst: data.delivery_gst || 0,
        refunds: data.refunds || [],
        invoices: invoices
    };
}

async function cancelOrder(id, userId, reason, userEmail, userName) {
    const { data: order, error } = await supabase
        .from('orders')
        .select('*, items:order_items(*)') // Fetch full order with items for updateOrderStatus
        .eq('id', id)
        .single();

    if (error || !order) {
        logger.error({ err: error, orderId: id }, LOGS.ORDER_DB_UPDATE_FAIL);
        const err = new Error(ORDER.ORDER_NOT_FOUND);
        err.status = 404;
        throw err;
    }

    if (order.user_id !== userId) {
        const err = new Error(COMMON.UNAUTHORIZED);
        err.status = 403;
        throw err;
    }

    const allowedStatuses = [ORDER_STATUS.PENDING, ORDER_STATUS.CONFIRMED, ORDER_STATUS.PROCESSING, ORDER_STATUS.PACKED];
    if (!allowedStatuses.includes(order.status)) {
        const err = new Error(ORDER.ORDER_CANNOT_BE_CANCELLED);
        err.status = 400;
        throw err;
    }

    const note = reason ? `${ORDER.CANCELLED_BY_USER}: ${reason}` : ORDER.CANCELLED_BY_USER;
    const result = await updateOrderStatus(id, ORDER_STATUS.CANCELLED, userId, note, 'customer', { existingOrder: order });

    if (!result.success) {
        throw new Error(result.error);
    }

    return {
        order: result.order,
        refundInitiated: result.refundInitiated || false
    };
}

/**
 * Request Return
 */
async function requestReturn(id, userId, reason, returnItems) {
    // 1. Verify Ownership & Status
    const { data: order, error } = await supabase
        .from('orders')
        .select('*, items:order_items(*)') // Fetch full order with items for updateOrderStatus
        .eq('id', id)
        .single();

    if (error || !order) {
        logger.error({ err: error, orderId: id }, LOGS.ORDER_DB_UPDATE_FAIL);
        const err = new Error(ORDER.ORDER_NOT_FOUND);
        err.status = 404;
        throw err;
    }

    if (order.user_id !== userId) {
        const err = new Error(COMMON.UNAUTHORIZED);
        err.status = 403;
        throw err;
    }

    if (order.status !== ORDER_STATUS.DELIVERED) {
        const err = new Error(ORDER.ONLY_DELIVERED_RETURNABLE);
        err.status = 400;
        throw err;
    }

    // 2. Store Return Details
    if (returnItems) {
        const { error: updateError } = await supabase
            .from('orders')
            .update({
                return_request: {
                    reason: reason,
                    items: returnItems,
                    requested_at: new Date().toISOString()
                }
            })
            .eq('id', id);

        if (updateError) {
            logger.error({ err: updateError, orderId: id }, LOGS.ORDER_RETURN_SAVE_FAIL);
        }
    }

    // 3. Update Status
    const note = reason ? `${ORDER.RETURN_REQUESTED_NOTE}: ${reason}` : ORDER.RETURN_REQUESTED_NOTE;
    const result = await updateOrderStatus(id, ORDER_STATUS.RETURN_REQUESTED, userId, note, 'customer', { existingOrder: order });

    if (!result.success) {
        throw new Error(result.error);
    }

    return result.order;
}

async function getOrderStats() {
    const queries = [
        // Total orders
        supabase.from('orders').select('id', { count: 'exact', head: true }),
        // New orders
        supabase.from('orders').select('id', { count: 'exact', head: true }).in('status', ['pending', 'confirmed']),
        // Orders in process
        supabase.from('orders').select('id', { count: 'exact', head: true }).in('status', ['processing', 'packed', 'shipped', 'out_for_delivery', 'return_approved', 'return_picked_up']),
        // 4. Cancelled Orders
        supabase.from('orders').select('id', { count: 'exact', head: true }).in('status', ['cancelled']),
        // 5. Returned Orders
        supabase.from('orders').select('id', { count: 'exact', head: true }).in('status', ['returned', 'partially_returned', 'partially_refunded']),
        // 6. Failed Orders
        supabase.from('orders').select('id', { count: 'exact', head: true }).or('status.eq.delivery_unsuccessful,delivery_unsuccessful_reason.not.is.null'),
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('payment_status', 'failed'),
        // 7. Return Requested
        supabase.from('orders').select('id', { count: 'exact', head: true }).in('status', ['return_requested']),
        // 8. Refunded Orders (Split into Cancelled vs Returned in-memory)
        supabaseAdmin.from('orders').select('id, returns(id)').eq('status', 'refunded')
    ];

    const results = await Promise.all(queries);

    const refundedOrders = results[8].data || [];
    let refundedCancelledCount = 0;
    let refundedReturnedCount = 0;

    (refundedOrders || []).forEach(o => {
        if (o.returns && (Array.isArray(o.returns) ? o.returns.length > 0 : true)) {
            refundedReturnedCount++;
        } else {
            refundedCancelledCount++;
        }
    });

    // If any error occurs, throw the first one
    const errorResult = results.find(r => r.error);
    if (errorResult) {
        throw errorResult.error;
    }

    // Failed orders: delivery_unsuccessful + payment failed (sum, since they don't overlap in status)
    const failedOrders = (results[5]?.count || 0) + (results[6]?.count || 0);

    return {
        totalOrders: results[0].count || 0,
        newOrders: results[1].count || 0,
        processingOrders: results[2].count || 0,
        cancelledOrders: (results[3]?.count || 0) + refundedCancelledCount,
        returnedOrders: (results[4]?.count || 0) + refundedReturnedCount,
        failedOrders,
        returnRequestedOrders: results[7]?.count || 0
    };
}

module.exports = {
    ORDER_STATUS,
    ALLOWED_TRANSITIONS,
    isValidTransition,
    logStatusHistory,
    updateOrderStatus,
    getAllOrders,
    createOrder,
    getOrderById,
    cancelOrder,
    requestReturn,
    getOrderStats
};
