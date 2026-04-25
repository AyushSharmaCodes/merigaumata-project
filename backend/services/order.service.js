
const Razorpay = require('razorpay');
const { wrapRazorpayWithTimeout } = require('../utils/razorpay-timeout');
const logger = require('../utils/logger');
const supabase = require('../config/supabase');
const { supabaseAdmin } = require('../config/supabase');
const emailService = require('./email');
const MemoryStore = require('../lib/store/memory.store');
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
    STATUS_MESSAGES,
    ALLOWED_TRANSITIONS,
    isValidTransition,
    logStatusHistory
} = require('./history.service');
const OrderStateMachine = require('../domain/orderStateMachine');
const { withOptimisticRetry } = require('../utils/concurrency');
const { ORDER, PAYMENT, LOGS, COMMON, INVENTORY } = require('../constants/messages');
const { translate } = require('../utils/i18n.util');
const { getBackendBaseUrl } = require('../utils/backend-url');

const currencyCache = new MemoryStore();
const CURRENCY_CACHE_TTL = 60 * 60 * 1000; // 1 hour
const BUSINESS_DELIVERY_UNSUCCESSFUL_REASON_KEYS = new Set([
    'customer_not_reachable',
    'customer_unavailable',
    'delivery_attempt_exceeded',
    'incorrect_address',
    'address_not_locatable',
    'landmark_missing',
    'address_change_unserviceable',
    'customer_refused_delivery',
    'no_longer_required',
    'ordered_by_mistake_refused',
    'security_denied',
    'otp_not_provided',
    'id_verification_failed',
    'incorrect_contact_number',
    'no_response_communication'
]);

function resolveRtoRefundType(deliveryUnsuccessfulReason) {
    if (!deliveryUnsuccessfulReason) {
        return REFUND_TYPES.TECHNICAL_REFUND;
    }

    const normalizedReason = String(deliveryUnsuccessfulReason).trim();
    const keyMatch = normalizedReason.match(/^\[([A-Z0-9_]+)\]/);
    const normalizedKey = keyMatch?.[1]?.toLowerCase() || null;

    if (normalizedKey && BUSINESS_DELIVERY_UNSUCCESSFUL_REASON_KEYS.has(normalizedKey)) {
        return REFUND_TYPES.BUSINESS_REFUND;
    }

    return REFUND_TYPES.TECHNICAL_REFUND;
}

async function getCachedCustomerCurrencyMeta(preferredCurrency) {
    const normalizedCurrency = typeof preferredCurrency === 'string'
        ? preferredCurrency.trim().toUpperCase()
        : 'INR';

    if (!normalizedCurrency || normalizedCurrency === 'INR') {
        return {
            preferred_currency: 'INR',
            exchange_rate_from_inr: 1,
            exchange_rate_provider: 'base',
            exchange_rate_fetched_at: null,
            exchange_rate_is_stale: false
        };
    }

    // Check in-memory cache first
    const cached = await currencyCache.get(normalizedCurrency);
    if (cached) {
        return cached;
    }

    const { data, error } = await supabase
        .from('currency_rate_cache')
        .select('provider, fetched_at, expires_at, rates')
        .eq('base_currency', 'INR')
        .maybeSingle();

    if (error) {
        logger.warn({ err: error, preferredCurrency: normalizedCurrency }, 'Failed to read cached currency meta for order detail');
        return {
            preferred_currency: normalizedCurrency,
            exchange_rate_from_inr: null,
            exchange_rate_provider: null,
            exchange_rate_fetched_at: null,
            exchange_rate_is_stale: null
        };
    }

    const numericRate = Number(data?.rates?.[normalizedCurrency]);
    const expiresAt = data?.expires_at ? new Date(data.expires_at).getTime() : null;

    const result = {
        preferred_currency: normalizedCurrency,
        exchange_rate_from_inr: Number.isFinite(numericRate) && numericRate > 0 ? numericRate : null,
        exchange_rate_provider: data?.provider || null,
        exchange_rate_fetched_at: data?.fetched_at || null,
        exchange_rate_is_stale: expiresAt ? expiresAt <= Date.now() : null
    };

    // Store in-memory
    await currencyCache.set(normalizedCurrency, result, CURRENCY_CACHE_TTL);

    return result;
}

/**
 * Centrally manages order status updates including validation, inventory, and logging.
 * HARDENED: Uses optimistic concurrency and strict lifecycle-only state machine guards.
 * RESTORED: All business side-effects (emails, invoices, metadata) are re-integrated.
 */
async function updateOrderStatus(orderId, newStatus, userId, notes = '', role = 'customer', options = {}) {
    return withOptimisticRetry(async () => {
        // 1. Fetch current order with version
        const { data: order, error: fetchError } = await supabaseAdmin
            .from('orders')
            .select('*, items:order_items(*)')
            .eq('id', orderId)
            .single();

        if (fetchError || !order) {
            return { success: false, status: 404, error: ORDER.ORDER_NOT_FOUND };
        }

        const previousStatus = order.status;
        const currentVersion = order.version || 0;

        const normalizedStatus = (() => {
            if (newStatus === ORDER_STATUS.CANCELLED) {
                return ['admin', 'manager'].includes(role)
                    ? ORDER_STATUS.CANCELLED_BY_ADMIN
                    : ORDER_STATUS.CANCELLED_BY_CUSTOMER;
            }
            return newStatus;
        })();

        // 2. Validate Transition
        const isAdminOrManager = ['admin', 'manager'].includes(role);
        if (!isValidTransition(previousStatus, normalizedStatus)) {
            return {
                success: false,
                status: 400,
                error: ORDER.INVALID_TRANSITION
            };
        }

        // 3. Prepare Update Data & Metadata
        const updateData = {
            status: normalizedStatus,
            version: currentVersion + 1,
            updated_at: new Date().toISOString()
        };

        if (
            [ORDER_STATUS.RETURN_REQUESTED, ORDER_STATUS.DELIVERY_UNSUCCESSFUL].includes(normalizedStatus) &&
            previousStatus !== normalizedStatus
        ) {
            updateData.previous_state = previousStatus;
        }

        // Determine if a refund will be initiated (RESTORED for frontend/UX indicators)
        const PRE_SHIP_STATUSES = [ORDER_STATUS.PENDING, ORDER_STATUS.CONFIRMED, ORDER_STATUS.PROCESSING, ORDER_STATUS.PACKED];
        const isPaid = order.payment_status === 'paid';
        const isCancelStatus = typeof normalizedStatus === 'string' && normalizedStatus.startsWith('cancelled');
        const isReturnToOrigin = normalizedStatus === ORDER_STATUS.RETURNED_TO_ORIGIN;
        const refundWillBeInitiated = isPaid && (
            (isCancelStatus && PRE_SHIP_STATUSES.includes(previousStatus)) ||
            (normalizedStatus === ORDER_STATUS.RETURNED) ||
            isReturnToOrigin
        );

        // Metadata Enrichment: Strip common prefixes from delivery failure notes
        if (normalizedStatus === ORDER_STATUS.DELIVERY_UNSUCCESSFUL && notes) {
            const prefixes = ["Delivery unsuccessful: ", "डिलीवरी असफल: ", "டெலிவரி தோல்வியடைந்தது: ", "డెలివరీ విఫలమైంది: "];
            let cleanReason = notes;
            for (const p of prefixes) {
                if (cleanReason.startsWith(p)) {
                    cleanReason = cleanReason.slice(p.length).trim();
                    break;
                }
            }
            updateData.delivery_unsuccessful_reason = cleanReason;
        }

        // 4. ATOMIC UPDATE (Dual-Guard: Status + Version)
        const { data: updateResult, error: updateError } = await supabaseAdmin
            .from('orders')
            .update(updateData)
            .eq('id', orderId)
            .eq('status', previousStatus)
            .eq('version', currentVersion)
            .select();

        if (updateError) throw updateError;
        
        const updatedOrder = updateResult?.[0];
        if (!updatedOrder) {
            const conflictError = new Error('version conflict');
            conflictError.code = '409';
            throw conflictError;
        }

        // 5. Secondary Side-Effects (Async/Background to improve response time)
        (async () => {
            try {
                const actingRole = isAdminOrManager ? 'ADMIN' : 'USER';
                const statusMessage = notes || STATUS_MESSAGES[normalizedStatus] || `${ORDER.DEFAULT_STATUS_UPDATE}: ${normalizedStatus}`;
                
                // History Metadata
                const historyMetadata = {};
                if (normalizedStatus === ORDER_STATUS.DELIVERY_UNSUCCESSFUL && updateData.delivery_unsuccessful_reason) {
                    historyMetadata.reason = updateData.delivery_unsuccessful_reason;
                }

                // Log History
                await logStatusHistory(orderId, normalizedStatus, userId, statusMessage, actingRole, null, historyMetadata);

                // Handle Refund Trigger (RESTORED logic)
                if (refundWillBeInitiated) {
                    if (isCancelStatus) {
                        const cancelRefundType = (normalizedStatus === ORDER_STATUS.CANCELLED_BY_ADMIN) 
                            ? REFUND_TYPES.TECHNICAL_REFUND 
                            : REFUND_TYPES.BUSINESS_REFUND;
                        
                        RefundService.asyncProcessRefund(orderId, cancelRefundType, actingRole, notes)
                            .catch(err => logger.error({ orderId, err: err.message }, LOGS.ORDER_REFUND_FAIL));
                    }
                    if (isReturnToOrigin) {
                        const rtoRefundType = resolveRtoRefundType(order.delivery_unsuccessful_reason);
                        RefundService.asyncProcessRefund(orderId, rtoRefundType, actingRole, notes || STATUS_MESSAGES[normalizedStatus])
                            .catch(err => logger.error({ orderId, err: err.message }, LOGS.ORDER_REFUND_FAIL));
                    }
                    // Customer return-request refunds continue through the return/QC workflow.
                }

                // Handle Invoicing (RESTORED logic)
                if (normalizedStatus === ORDER_STATUS.DELIVERED) {
                    InvoiceOrchestrator.generateInternalInvoice(orderId)
                        .catch(err => logger.error({ orderId, err: err.message }, "Invoice generation error in background"));
                }

                // Send Email Notifications (RESTORED switch-case)
                const { ALLOWED_ORDER_EMAIL_STATES } = require('./email/types');
                if (ALLOWED_ORDER_EMAIL_STATES[normalizedStatus]) {
                    const fullOrder = await getOrderById(orderId, { role: 'admin', id: 'system' });
                    const to = fullOrder.customer_email;
                    const customerName = fullOrder.customer_name;
                    if (to) {
                        switch (normalizedStatus) {
                            case ORDER_STATUS.CONFIRMED:
                                await emailService.sendOrderConfirmedEmail(to, { order: fullOrder, customerName }, fullOrder.user_id);
                                break;
                            case ORDER_STATUS.SHIPPED:
                                await emailService.sendOrderShippedEmail(to, { order: fullOrder, customerName }, fullOrder.user_id);
                                break;
                            case ORDER_STATUS.DELIVERED: {
                                const backendBase = getBackendBaseUrl();
                                const { data: internalInv } = await supabase.from('invoices')
                                    .select('id, type').eq('order_id', orderId).in('type', ['TAX_INVOICE', 'BILL_OF_SUPPLY'])
                                    .order('created_at', { ascending: false }).limit(1).maybeSingle();
                                const invoiceUrl = internalInv ? `${backendBase}/api/invoices/${internalInv.id}/download` : null;
                                await emailService.sendOrderDeliveredEmail(to, { order: fullOrder, customerName, invoiceUrl }, fullOrder.user_id);
                                break;
                            }
                            case ORDER_STATUS.RETURNED:
                            case ORDER_STATUS.RETURNED_TO_ORIGIN:
                                await emailService.sendOrderReturnedEmail(to, { order: fullOrder, customerName }, fullOrder.user_id);
                                break;
                            case ORDER_STATUS.CANCELLED:
                            case ORDER_STATUS.CANCELLED_BY_ADMIN:
                            case ORDER_STATUS.CANCELLED_BY_CUSTOMER:
                                await emailService.sendOrderCancellationEmail(to, { order: fullOrder, customerName }, fullOrder.user_id);
                                break;
                        }
                    }
                }
            } catch (bgError) {
                logger.error({ err: bgError, orderId }, "Background side-effects failed in updateOrderStatus");
            }
        })();

        return { success: true, order: updatedOrder, refundInitiated: refundWillBeInitiated };
    });
}

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
    limit = Math.min(parseInt(limit) || 10, 100);
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
        query = query.in('status', [
            'return_requested',
            'return_approved',
            'pickup_scheduled',
            'pickup_attempted',
            'pickup_completed',
            'picked_up',
            'return_picked_up',
            'in_transit_to_warehouse',
            'qc_initiated',
            'qc_passed',
            'qc_failed',
            'partial_refund'
        ]);
    } else if (status === 'failed_flow') {
        // Failed/RTO orders: delivery failure, reattempt pipeline, RTO pipeline, or failed payment
        query = query.or(`status.in.(delivery_unsuccessful,delivery_reattempt_scheduled,rto_in_transit,returned_to_origin),payment_status.eq.failed,delivery_unsuccessful_reason.not.is.null`);
    } else if (status === 'cancelled_flow') {
        const { data: refundedOrders } = await supabaseAdmin
            .from('orders')
            .select('id, returns(id)')
            .eq('payment_status', 'refunded');
        const refundedCancelledIds = (refundedOrders || []).filter(o => !o.returns || (Array.isArray(o.returns) ? o.returns.length === 0 : false)).map(o => o.id);
        if (refundedCancelledIds.length > 0) {
            query = query.or(`status.in.(cancelled,cancelled_by_admin,cancelled_by_customer),id.in.(${refundedCancelledIds.join(',')})`);
        } else {
            query = query.in('status', ['cancelled', 'cancelled_by_admin', 'cancelled_by_customer']);
        }
    } else if (status === 'returned_flow') {
        const { data: refundedOrders } = await supabaseAdmin
            .from('orders')
            .select('id, returns(id)')
            .eq('payment_status', 'refunded');
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
        } else if (status === 'cancelled') {
            query = query.in('status', ['cancelled', 'cancelled_by_admin', 'cancelled_by_customer']);
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
            id,
            order_number,
            user_id,
            customer_name,
            customer_email,
            customer_phone,
            status,
            payment_status,
            created_at,
            updated_at,
            subtotal,
            coupon_discount,
            delivery_charge,
            delivery_gst,
            total_amount,
            payment_id,
            invoice_id,
            invoice_url,
            currency,
            shipping_address_snapshot:shipping_address,
            billing_address_snapshot:billing_address,
            shipping_address_id,
            billing_address_id,
            delivery_unsuccessful_reason,
            items:order_items (
                id,
                order_id,
                product_id,
                variant_id,
                quantity,
                price_per_unit,
                title,
                returned_quantity,
                is_returnable,
                hsn_code,
                gst_rate,
                taxable_amount,
                cgst,
                sgst,
                igst,
                delivery_charge,
                delivery_gst,
                variant_snapshot,
                delivery_calculation_snapshot,
                products:product_id (
                    id,
                    title,
                    images,
                    is_returnable,
                    price_includes_tax,
                    default_price_includes_tax
                ),
                product_variants:variant_id (
                    variant_image_url,
                    size_label,
                    size_label_i18n,
                    size_value,
                    unit,
                    sku
                )
            ),
            profiles:profiles!user_id (
                name,
                email,
                phone,
                preferred_currency,
                avatar_url,
                is_flagged
            ),
            shipping_address_record:addresses!shipping_address_id (
                id,
                full_name,
                address_line1,
                address_line2,
                city,
                state,
                postal_code,
                country,
                phone_numbers (
                    phone_number,
                    is_primary
                )
            ),
            billing_address_record:addresses!billing_address_id (
                id,
                full_name,
                address_line1,
                address_line2,
                city,
                state,
                postal_code,
                country,
                phone_numbers (
                    phone_number,
                    is_primary
                )
            ),
            payments:payments!order_id (
                id,
                order_id,
                razorpay_payment_id,
                amount,
                method,
                invoice_id,
                created_at,
                updated_at,
                refunds (
                    id,
                    order_id,
                    return_id,
                    payment_id,
                    razorpay_refund_id,
                    amount,
                    status,
                    reason,
                    notes,
                    metadata,
                    created_at,
                    updated_at
                )
            ),
            invoices (
                id,
                order_id,
                type,
                invoice_number,
                provider_id,
                public_url,
                status,
                created_at
            ),
            refunds (
                id,
                order_id,
                return_id,
                payment_id,
                razorpay_refund_id,
                amount,
                status,
                reason,
                notes,
                metadata,
                created_at,
                updated_at
            ),
            order_status_history:order_status_history (
                id,
                order_id,
                return_id,
                status,
                event_type,
                actor,
                updated_by,
                notes,
                metadata,
                created_at
            ),
            return_requests:returns!order_id (
                id,
                order_id,
                user_id,
                status,
                refund_amount,
                reason,
                staff_notes,
                refund_breakdown,
                created_at,
                updated_at,
                return_items:return_items (
                    id,
                    return_id,
                    order_item_id,
                    quantity,
                    status,
                    reason,
                    images,
                    condition,
                    order_items (
                        id,
                        product_id,
                        title,
                        price_per_unit,
                        quantity,
                        returned_quantity,
                        variant_snapshot,
                        hsn_code,
                        gst_rate,
                        taxable_amount,
                        cgst,
                        sgst,
                        igst,
                        delivery_charge,
                        delivery_gst,
                        delivery_calculation_snapshot
                    )
                )
            )
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
    // Ensure customer image is available for UI
    data.customer_image = profile.avatar_url || null;
    const customerCurrencyMeta = await getCachedCustomerCurrencyMeta(
        data.display_currency || data.currency || profile.preferred_currency || 'INR'
    );
    const dbShippingAddress = data.shipping_address_record;
    const dbBillingAddress = data.billing_address_record;
    const snapshotShippingAddress = data.shipping_address_snapshot;
    const snapshotBillingAddress = data.billing_address_snapshot;
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

    // Process Invoices (Generate proxy-safe download URLs)
    // Use relative paths so the frontend can route through the Vercel proxy
    // or prepend CONFIG.BACKEND_URL as needed — avoids cross-origin auth failures
    invoices = invoices.map(inv => {
        if (inv.type !== 'RAZORPAY') {
            return {
                ...inv,
                public_url: `/invoices/${inv.id}/download`
            };
        }
        return inv;
    });

    const internalInvoiceTypes = ['TAX_INVOICE', 'BILL_OF_SUPPLY'];
    const currentInternalInvoice = invoices.find(inv => inv.id === data.invoice_id && internalInvoiceTypes.includes(inv.type));

    invoices = [...invoices].sort((a, b) => {
        const aIsActive = a.id === data.invoice_id ? 1 : 0;
        const bIsActive = b.id === data.invoice_id ? 1 : 0;
        if (aIsActive !== bIsActive) {
            return bIsActive - aIsActive;
        }

        const aCreated = new Date(a.created_at || 0).getTime();
        const bCreated = new Date(b.created_at || 0).getTime();
        return bCreated - aCreated;
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
                    const razorpay = wrapRazorpayWithTimeout(new Razorpay({ key_id, key_secret }));
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

    const hasUsableAddress = (address = null) => {
        if (!address) return false;

        const line1 = address.address_line1 || address.addressLine1 || address.street_address || address.line1 || '';
        const city = address.city || '';
        const state = address.state || '';
        const postalCode = address.postal_code || address.postalCode || address.pincode || address.zip || '';

        return [line1, city, state, postalCode].some((value) => String(value).trim().length > 0);
    };

    // Process Addresses
    let shippingAddress = data.shippingAddress || snapshotShippingAddress || dbShippingAddress;
    if (dbShippingAddress && (!shippingAddress || !shippingAddress.phone)) {
        shippingAddress = formatAddress(dbShippingAddress);
    } else {
        shippingAddress = formatAddress(shippingAddress);
    }

    let billingAddress = data.billingAddress || snapshotBillingAddress || dbBillingAddress || shippingAddress;
    if (dbBillingAddress && (!billingAddress || !billingAddress.phone)) {
        billingAddress = formatAddress(dbBillingAddress);
    } else {
        billingAddress = formatAddress(billingAddress);
    }

    if (!billingAddress && shippingAddress) {
        billingAddress = { ...shippingAddress };
    }

    if (!hasUsableAddress(billingAddress) && hasUsableAddress(shippingAddress)) {
        billingAddress = {
            ...shippingAddress,
            phone: billingAddress?.phone || shippingAddress?.phone || data.customer_phone || ''
        };
    }

    // Map items
    const mapOrderItem = (item = {}) => {
        const productInfo = item.products || item.product || item;
        const variantInfo = item.variant_snapshot || item.product_variants || item.variants || item.variant || null;
        const productImages = Array.isArray(productInfo.images) ? productInfo.images : [];
        const primaryImage = variantInfo?.variant_image_url || productImages[0] || null;

        return {
            ...item,
            image: item.image || primaryImage,
            price: item.price ?? item.price_per_unit ?? productInfo.price ?? 0,
            product_snapshot: item.product_snapshot || {
                id: productInfo.id || item.product_id,
                title: productInfo.title || item.title || INVENTORY.DEFAULT_PRODUCT_TITLE,
                images: productImages,
                main_image: primaryImage,
                image: primaryImage,
                is_returnable: productInfo.isReturnable ?? productInfo.is_returnable ?? item.is_returnable ?? true,
                price_includes_tax: productInfo.price_includes_tax ?? productInfo.default_price_includes_tax ?? true
            },
            product: {
                id: productInfo.id || item.product_id,
                title: productInfo.title || item.title || INVENTORY.DEFAULT_PRODUCT_TITLE,
                price: productInfo.price || item.price_per_unit || item.price || 0,
                images: productImages,
                isReturnable: productInfo.isReturnable ?? productInfo.is_returnable ?? true
            },
            variant: variantInfo
        };
    };

    const mappedItems = (data.items || []).map(mapOrderItem);
    const mappedReturnRequests = (data.return_requests || []).map((returnRequest) => ({
        ...returnRequest,
        return_items: (returnRequest.return_items || []).map((returnItem) => ({
            ...returnItem,
            order_items: returnItem.order_items ? mapOrderItem(returnItem.order_items) : returnItem.order_items
        }))
    }));

    return {
        ...data,
        user: {
            ...(data.user || {}),
            id: data.user_id,
            image: profile.avatar_url || null,
            is_flagged: profile.is_flagged || false
        },
        customer_name: profile.name || data.customer_name || COMMON.UNKNOWN,
        customer_email: profile.email || data.customer_email || COMMON.NA,
        customer_phone: profile.phone || data.customer_phone || shippingAddress?.phone,
        customer_preferred_currency: customerCurrencyMeta.preferred_currency,
        customer_exchange_rate_from_inr: customerCurrencyMeta.exchange_rate_from_inr,
        customer_exchange_rate_provider: customerCurrencyMeta.exchange_rate_provider,
        customer_exchange_rate_fetched_at: customerCurrencyMeta.exchange_rate_fetched_at,
        customer_exchange_rate_is_stale: customerCurrencyMeta.exchange_rate_is_stale,
        shipping_address: shippingAddress,
        billing_address: {
            ...(billingAddress || shippingAddress || {}),
            phone: billingAddress?.phone || shippingAddress?.phone || data.customer_phone || ''
        },
        items: mappedItems,
        return_requests: mappedReturnRequests,
        created_at: data.created_at,
        total_amount: data.total_amount || 0,
        payment_status: data.payment_status || 'pending',
        payment_id: paymentDetails?.razorpay_payment_id || data.payment_id,
        payment_method: paymentDetails?.method,
        email_logs: emailLogs,
        delivery_charge: data.delivery_charge || 0,
        delivery_gst: data.delivery_gst || 0,
        refunds: data.refunds || [],
        invoice_url: currentInternalInvoice?.public_url || data.invoice_url,
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
    const result = await updateOrderStatus(id, ORDER_STATUS.CANCELLED_BY_CUSTOMER, userId, note, 'customer', { existingOrder: order });

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
    const { data, error } = await supabase.rpc('get_order_summary_stats_v2');

    if (error) {
        logger.error({ err: error }, 'ORDER_STATS_RPC_FAILED');
        throw error;
    }

    return {
        totalOrders: data.totalOrders || 0,
        newOrders: data.newOrders || 0,
        processingOrders: data.processingOrders || 0,
        cancelledOrders: data.cancelledOrders || 0,
        returnedOrders: data.returnedOrders || 0,
        failedOrders: data.failedOrders || 0,
        returnRequestedOrders: data.returnRequestedOrders || 0
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
