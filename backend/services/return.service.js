const { supabase, supabaseAdmin } = require('../config/supabase');
const logger = require('../utils/logger');
const Razorpay = require('razorpay');
const { PricingCalculator } = require('./pricing-calculator.service');
const { RefundCalculator } = require('./refund-calculator.service');
const { FinancialEventLogger } = require('./financial-event-logger.service');
const { DeliveryChargeService } = require('./delivery-charge.service');
const inventoryService = require('./inventory.service');
const emailService = require('./email');
const { createModuleLogger } = require('../utils/logging-standards');
const orderService = require('./order.service');
const { REFUND_TYPES } = require('./refund.service');
const ReturnMessages = require('../constants/messages/ReturnMessages');
const { wrapRazorpayWithTimeout } = require('../utils/razorpay-timeout');

const log = createModuleLogger('ReturnService');
const { logStatusHistory } = require('./history.service');
const { ORDER } = require('../constants/messages');
const AdminNotificationService = require('./admin-notification.service');
const realtimeService = require('./realtime.service');
const { parseStorageUrl, resolveAssetUrl } = require('./storage-asset.service');

// Initialize Razorpay
const razorpay = wrapRazorpayWithTimeout(new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
}));

const ACTIVE_RETURN_STATUSES = [
    'requested',
    'approved',
    'pickup_scheduled',
    'pickup_attempted',
    'pickup_completed',
    'picked_up',
    'item_returned',
    'qc_initiated',
    'qc_passed',
    'qc_failed',
    'partial_refund'
];
const AGGREGATE_REFUND_STATUSES = [
    'processed',
    'pending',
    'refunded',
    'refund_initiated',
    'completed',
    'processing',
    'created',
    'PROCESSED',
    'PENDING',
    'REFUNDED',
    'REFUND_INITIATED',
    'COMPLETED',
    'PROCESSING',
    'CREATED'
];
const RETURN_STATUS_TRANSITIONS = Object.freeze({
    requested: ['approved', 'pickup_scheduled', 'pickup_attempted', 'pickup_failed', 'cancelled'],
    approved: ['pickup_scheduled', 'pickup_attempted', 'pickup_completed', 'picked_up', 'cancelled'],
    pickup_scheduled: ['pickup_attempted', 'pickup_completed', 'pickup_failed', 'picked_up'],
    pickup_attempted: ['pickup_scheduled', 'pickup_attempted', 'pickup_completed', 'pickup_failed', 'picked_up'],
    pickup_completed: ['picked_up'],
    picked_up: ['item_returned', 'completed'],
    completed: [],
    cancelled: []
});

const RETURN_ITEM_STATUS_TRANSITIONS = Object.freeze({
    requested: ['approved', 'cancelled'],
    approved: ['picked_up', 'item_returned'],
    picked_up: ['item_returned'],
    item_returned: ['qc_initiated'],
    qc_initiated: ['qc_passed', 'qc_failed'],
    qc_passed: [],
    qc_failed: [],
    cancelled: []
});

const TRANSIENT_RETURN_ORDER_STATUSES = new Set([
    'return_requested',
    'return_approved',
    'pickup_scheduled',
    'pickup_attempted',
    'pickup_completed',
    'pickup_failed',
    'return_picked_up',
    'picked_up',
    'in_transit_to_warehouse',
    'qc_initiated',
    'qc_passed',
    'qc_failed',
    'partial_refund',
    'zero_refund',
    'return_back_to_customer',
    'dispose_liquidate'
]);

const ORDER_STATUS_BY_RETURN_STATUS = Object.freeze({
    pickup_scheduled: 'pickup_scheduled',
    pickup_attempted: 'pickup_attempted',
    pickup_completed: 'pickup_completed',
    picked_up: 'in_transit_to_warehouse',
    qc_initiated: 'qc_initiated',
    qc_passed: 'qc_passed',
    qc_failed: 'qc_failed',
    partial_refund: 'partial_refund',
    zero_refund: 'zero_refund',
    return_to_customer: 'return_back_to_customer',
    dispose_liquidate: 'dispose_liquidate'
});

const TERMINAL_RETURN_ITEM_STATUSES = new Set([
    'qc_passed',
    'qc_failed',
    'return_to_customer',
    'dispose_liquidate'
]);

function resolveReturnBaseState(orderStatus, previousState) {
    if (TRANSIENT_RETURN_ORDER_STATUSES.has(orderStatus)) {
        return previousState || 'delivered';
    }

    return orderStatus || previousState || 'delivered';
}

function isMissingColumnError(error, columnName) {
    if (!error) return false;

    const message = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`;
    return (
        error.code === '42703' ||
        error.code === 'PGRST204' ||
        (columnName ? message.includes(columnName) : /column/i.test(message))
    );
}

async function assertOrderAccess(orderId, userId) {
    if (!userId) return;

    const { data: order, error } = await supabase
        .from('orders')
        .select('id, user_id')
        .eq('id', orderId)
        .maybeSingle();

    if (error) throw error;

    if (!order) {
        const err = new Error(ORDER.ORDER_NOT_FOUND);
        err.status = 404;
        throw err;
    }

    if (order.user_id !== userId) {
        const err = new Error(ReturnMessages.UNAUTHORIZED || 'Unauthorized access');
        err.status = 403;
        throw err;
    }
}

async function refreshPrivateImageUrls(images = []) {
    return Promise.all((images || []).map(async (image) => {
        if (!image || typeof image !== 'string') return image;

        const parsed = parseStorageUrl(image);
        if (!parsed) {
            return image;
        }

        try {
            return await resolveAssetUrl({
                bucketName: parsed.bucketName,
                filePath: parsed.filePath,
                isPublic: false
            });
        } catch (error) {
            logger.warn({ err: error, image }, 'Failed to refresh private image URL');
            return image;
        }
    }));
}

async function refreshReturnRequestImages(returnRequest) {
    if (!returnRequest?.return_items || !Array.isArray(returnRequest.return_items)) {
        return returnRequest;
    }

    const hydratedItems = await Promise.all(returnRequest.return_items.map(async (item) => ({
        ...item,
        images: await refreshPrivateImageUrls(item.images || [])
    })));

    return {
        ...returnRequest,
        return_items: hydratedItems
    };
}

/**
 * Return Service
 * Handles partial return logic, validation, and Razorpay refunds
 */

const getReturnableItems = async (orderId, userId) => {
    // 1. Fetch all required order data in parallel to avoid sequential delays
    const [orderRes, itemsRes, historyRes, returnsRes] = await Promise.all([
        supabase
            .from('orders')
            .select('*')
            .eq('id', orderId)
            .eq('user_id', userId)
            .single(),
        supabase
            .from('order_items')
            .select(`
                *,
                products:product_id (
                    return_days
                )
            `)
            .eq('order_id', orderId),
        supabase
            .from('order_status_history')
            .select('created_at')
            .eq('order_id', orderId)
            .eq('status', 'delivered')
            .order('created_at', { ascending: false })
            .limit(1)
            .single(),
        supabase
            .from('returns')
            .select(`
                id,
                status,
                return_items (
                    order_item_id,
                    quantity
                )
            `)
            .eq('order_id', orderId)
            .in('status', ['requested', 'picked_up', 'approved'])
    ]);

    const { data: order, error: orderError } = orderRes;

    if (orderError || !order) throw new Error(ReturnMessages.ORDER_NOT_FOUND);
    const allowedStatuses = [
        'delivered',
        'return_requested',
        'return_rejected',
        'return_approved',
        'pickup_scheduled',
        'pickup_attempted',
        'pickup_completed',
        'picked_up',
        'in_transit_to_warehouse',
        'partially_returned',
        'qc_initiated',
        'qc_passed',
        'qc_failed',
        'partial_refund',
        'zero_refund',
        'return_back_to_customer',
        'dispose_liquidate'
    ];
    const lowerOrderStatus = order.status?.toLowerCase();
    if (!allowedStatuses.includes(lowerOrderStatus)) {
        logger.debug({ orderId, status: order.status }, 'Order not in returnable status');
        return []; // Return empty instead of throwing error to avoid frontend noise for non-returnable orders
    }

    const { data: items, error: itemsError } = itemsRes;
    if (itemsError) throw itemsError;

    const { data: deliveryHistory } = historyRes;
    const deliveryDate = deliveryHistory?.created_at
        ? new Date(deliveryHistory.created_at)
        : null;

    const { data: existingReturns, error: pendingError } = returnsRes;
    if (pendingError) throw pendingError;

    // Filter logic: (quantity - returned_quantity - existing_quantity) > 0 AND within return window
    // Note: returned_quantity in order_items is updated later in the workflow,
    // so we must also subtract approved/pending return quantities here.

    const now = new Date();
    const returnableItems = items.filter(item => {
        // Sum up quantities from active (requested/approved/picked_up) returns
        const pendingQty = existingReturns
            ?.filter(r => ACTIVE_RETURN_STATUSES.includes(r.status))
            ?.reduce((sum, r) => {
                const ri = r.return_items?.find(i => i.order_item_id === item.id);
                return sum + (ri?.quantity || 0);
            }, 0) || 0;

        const available = item.quantity - item.returned_quantity - pendingQty;

        // Check if within return window (from delivery date)
        let withinReturnWindow = true;
        if (deliveryDate) {
            const returnDays = item.products?.return_days ?? 7;
            const returnDeadline = new Date(deliveryDate.getTime() + (returnDays * 24 * 60 * 60 * 1000));
            withinReturnWindow = now <= returnDeadline;
        }

        return item.is_returnable && available > 0 && withinReturnWindow;
    }).map(item => {
        const pendingQty = existingReturns
            ?.filter(r => ACTIVE_RETURN_STATUSES.includes(r.status))
            ?.reduce((sum, r) => {
                const ri = r.return_items?.find(i => i.order_item_id === item.id);
                return sum + (ri?.quantity || 0);
            }, 0) || 0;

        const returnDays = item.products?.return_days ?? 7;
        let returnDeadline = null;
        if (deliveryDate) {
            returnDeadline = new Date(deliveryDate.getTime() + (returnDays * 24 * 60 * 60 * 1000));
        }
        return {
            ...item,
            remaining_quantity: item.quantity - item.returned_quantity - pendingQty,
            return_days: returnDays,
            return_deadline: returnDeadline?.toISOString() || null
        };
    });

    return returnableItems;
};

// Note: Centralized logStatusHistory from order.service is used instead of local helper

const createReturnRequest = async (userId, orderId, returnItems, reason) => {
    // Note: returnItems is now expected to be an array of objects:
    // { orderItemId, quantity, reason, images: [url1, url2], condition }
    // The 'reason' param at top level is kept for backward compatibility or as a general note,
    // but item-level reasons are preferred.

    // 1. Validate Returnable Items
    const availableItems = await getReturnableItems(orderId, userId);

    // Check if requested items are valid
    for (const reqItem of returnItems) {
        const validItem = availableItems.find(i => i.id === reqItem.orderItemId);
        if (!validItem) {
            const err = new Error(`Item ${reqItem.orderItemId} is not eligible for return`);
            err.status = 400;
            throw err;
        }

        if (reqItem.quantity > validItem.remaining_quantity) {
            const err = new Error(`Requested quantity ${reqItem.quantity} exceeds returnable quantity for item ${validItem.title}`);
            err.status = 400;
            throw err;
        }

        // Validate Mandatory Fields
        if (!reqItem.reason || reqItem.reason.trim() === '') {
            const err = new Error(`Return reason is required for item ${validItem.title}`);
            err.status = 400;
            throw err;
        }

        if (!reqItem.images || !Array.isArray(reqItem.images) || reqItem.images.length < 1) {
            const err = new Error(`At least 1 image is required for item ${validItem.title}`);
            err.status = 400;
            throw err;
        }

        if (reqItem.images.length > 3) {
            const err = new Error(`Maximum 3 images allowed for item ${validItem.title}`);
            err.status = 400;
            throw err;
        }
    }

    // 2. Calculate Refund Amount with Tax using RefundCalculator
    logger.info({ orderId, itemCount: returnItems.length }, 'Calculating refund for return request');
    const refundBreakdown = RefundCalculator.calculateReturnTotal(availableItems, returnItems);

    // Log items for debugging tax presence
    availableItems.forEach(item => {
        logger.debug({
            itemId: item.id,
            taxable: item.taxable_amount,
            cgst: item.cgst,
            sgst: item.sgst,
            total: item.total_amount
        }, 'Available item tax details');
    });

    logger.info({ summary: refundBreakdown.summary }, 'Calculated product refund breakdown');

    // 2.1 Calculate Delivery Refund using DeliveryChargeService (Selective Refundability)
    let deliveryRefundAmount = 0;
    let deliveryGSTRefundAmount = 0;
    try {
        const deliveryRefund = await DeliveryChargeService.calculateRefundDelivery(
            availableItems,
            returnItems
        );
        deliveryRefundAmount = deliveryRefund.refundDeliveryCharge;
        deliveryGSTRefundAmount = deliveryRefund.refundDeliveryGST;
    } catch (err) {
        log.warn('RETURN_DELIVERY_REFUND_CALC_ERROR', 'Failed to calculate delivery refund during request', { error: err.message });
    }

    const estimatedRefund = refundBreakdown.summary.totalRefund + deliveryRefundAmount + deliveryGSTRefundAmount;

    log.info('RETURN_REFUND_CALCULATED', 'Calculated refund for return request', {
        orderId,
        estimatedRefund,
        productRefund: refundBreakdown.summary.totalRefund,
        deliveryRefund: deliveryRefundAmount + deliveryGSTRefundAmount,
        taxRefund: refundBreakdown.summary.totalTaxRefund
    });

    // 3. Create Return Record
    const returnInsertPayload = {
        order_id: orderId,
        user_id: userId,
        status: 'requested',
        refund_amount: estimatedRefund,
        reason: reason || 'Item-level reasons provided',
        refund_breakdown: {
            ...refundBreakdown.summary,
            deliveryRefund: deliveryRefundAmount,
            deliveryGSTRefund: deliveryGSTRefundAmount,
            totalDeliveryRefund: deliveryRefundAmount + deliveryGSTRefundAmount
        }
    };

    let returnInsertQuery = supabaseAdmin
        .from('returns')
        .insert(returnInsertPayload)
        .select()
        .single();

    let { data: returnRequest, error: createError } = await returnInsertQuery;

    if (createError) {
        logger.error({ err: createError, orderId, userId, payload: returnInsertPayload }, 'Failed to create return record');

        if (isMissingColumnError(createError, 'refund_breakdown')) {
            logger.warn({ orderId }, 'Falling back to legacy returns schema (missing refund_breakdown)');
            log.warn('RETURN_SCHEMA_FALLBACK', 'returns.refund_breakdown column missing; retrying with legacy insert payload', {
                orderId,
                code: createError.code,
                message: createError.message
            });

            ({ data: returnRequest, error: createError } = await supabaseAdmin
                .from('returns')
                .insert({
                    order_id: orderId,
                    user_id: userId,
                    status: 'requested',
                    refund_amount: estimatedRefund,
                    reason: reason || 'Item-level reasons provided'
                })
                .select()
                .single());
        }
    }

    if (createError) throw createError;

    // 4. Create Return Items with detailed info
    const returnItemsData = returnItems.map(item => ({
        return_id: returnRequest.id,
        order_item_id: item.orderItemId,
        quantity: item.quantity,
        reason: item.reason,
        images: item.images, // text[] array
        condition: item.condition || 'opened' // Default or passed from frontend
    }));

    let { error: itemsInsertError } = await supabaseAdmin
        .from('return_items')
        .insert(returnItemsData);

    if (
        itemsInsertError &&
        (
            isMissingColumnError(itemsInsertError, 'reason') ||
            isMissingColumnError(itemsInsertError, 'images') ||
            isMissingColumnError(itemsInsertError, 'condition')
        )
    ) {
        log.warn('RETURN_ITEMS_SCHEMA_FALLBACK', 'Detailed return_items insert failed; retrying with legacy item payload', {
            orderId,
            returnId: returnRequest.id,
            code: itemsInsertError.code,
            message: itemsInsertError.message
        });

        ({ error: itemsInsertError } = await supabaseAdmin
            .from('return_items')
            .insert(returnItems.map(item => ({
                return_id: returnRequest.id,
                order_item_id: item.orderItemId,
                quantity: item.quantity
            }))));
    }

    if (itemsInsertError) {
        logger.error({
            err: itemsInsertError,
            orderId,
            returnId: returnRequest.id,
            itemCount: returnItems.length,
            payloadSample: returnItemsData
        }, 'Failed to insert return items');
        throw itemsInsertError;
    }

    const { data: currentOrder } = await supabaseAdmin
        .from('orders')
        .select('status, previous_state')
        .eq('id', orderId)
        .maybeSingle();

    const previousState = resolveReturnBaseState(currentOrder?.status, currentOrder?.previous_state);

    // 5. Update Order Status to 'return_requested' if not already
    const { data: updatedOrders, error: orderUpdateError } = await supabaseAdmin
        .from('orders')
        .update({
            status: 'return_requested',
            previous_state: previousState,
            updated_at: new Date().toISOString()
        })
        .eq('id', orderId)
        .select('id')
        .limit(1);

    if (orderUpdateError || !updatedOrders?.[0]) {
        log.error('RETURN_ORDER_STATUS_UPDATE_FAIL', 'Failed to update order status after return request creation; rolling back return request', {
            orderId,
            returnId: returnRequest.id,
            code: orderUpdateError?.code,
            message: orderUpdateError?.message
        });

        await supabaseAdmin.from('return_items').delete().eq('return_id', returnRequest.id);
        await supabaseAdmin.from('returns').delete().eq('id', returnRequest.id);

        const rollbackError = new Error('Failed to update order status after creating return request');
        rollbackError.status = 500;
        throw rollbackError;
    }

    try {
        await orderService.logStatusHistory(orderId, 'return_requested', userId, ORDER.RETURN_REQUESTED_NOTE, 'USER');
    } catch (historyError) {
        log.warn('RETURN_HISTORY_LOG_FAIL', 'Failed to log order history for return request', {
            orderId,
            returnId: returnRequest.id,
            error: historyError.message
        });
    }

    FinancialEventLogger.logReturnRequested(orderId, returnRequest.id, returnItems, userId)
        .catch(err => log.warn('AUDIT_LOG_ERROR', 'Failed to log return request', { error: err.message }));

    log.info('RETURN_REQUESTED', 'Return request created - email notification disabled per policy', {
        orderId,
        returnId: returnRequest.id,
        estimatedRefund
    });

    AdminNotificationService.createNotification(orderId)
        .catch(err => log.warn('ADMIN_NOTIFICATION_FAIL', 'Failed to push admin notification for return request', { error: err.message }));

    try {
        realtimeService.publish({
            topic: 'dashboard',
            type: 'return.requested',
            audience: 'staff',
            payload: {
                returnId: returnRequest.id,
                orderId,
                status: returnRequest.status,
                refundAmount: estimatedRefund
            }
        });
    } catch (realtimeError) {
        log.warn('RETURN_REALTIME_PUBLISH_FAIL', 'Failed to publish realtime event for return request', {
            orderId,
            returnId: returnRequest.id,
            error: realtimeError.message
        });
    }

    return returnRequest;
};

const processReturnApproval = async (returnId, adminId) => {
    // 1. Fetch Return Details
    const { data: returnRequest, error: fetchError } = await supabaseAdmin
        .from('returns')
        .select(`
            id,
            status,
            order_id,
            user_id,
            orders (
                id,
                order_number,
                profiles(email, name)
            )
        `)
        .eq('id', returnId)
        .single();

    if (fetchError || !returnRequest) throw new Error(ReturnMessages.REQUEST_NOT_FOUND);
    if (returnRequest.status !== 'requested') {
        throw new Error(`Return request cannot be approved from ${returnRequest.status} state`);
    }

    // 2. Update Statuses
    // 2. Update Statuses Concurrently
    const updateReturn = supabaseAdmin.from('returns').update({
        status: 'approved',
        updated_at: new Date().toISOString()
    }).eq('id', returnId);

    const updateItems = supabaseAdmin.from('return_items').update({
        status: 'approved'
    }).eq('return_id', returnId);

    const updateOrder = supabaseAdmin.from('orders').update({
        status: 'return_approved'
    }).eq('id', returnRequest.order_id);

    // Wait for all three updates securely
    const results = await Promise.all([updateReturn, updateItems, updateOrder]);
    const failedResult = results.find(result => result?.error);
    if (failedResult?.error) {
        throw failedResult.error;
    }

    // 3. Offload History Logging
    (async () => {
        try {
            await orderService.logStatusHistory(returnRequest.order_id, 'return_approved', adminId, ORDER.RETURN_APPROVED_NOTE, 'ADMIN');
            log.info('RETURN_APPROVED', 'Return approved - email notification disabled per policy', {
                orderId: returnRequest.order_id,
                returnId
            });
        } catch (err) {
            log.error('BACKGROUND_LOG_ERROR', 'Failed to log return approval history', { error: err.message, returnId });
        }
    })();

    return { success: true };
};

const processReturnRejection = async (returnId, adminId, reason) => {
    // Fetch return with user info before updating
    const { data: returnRequest, error: fetchError } = await supabaseAdmin
        .from('returns')
        .select(`
            order_id,
            status,
            orders (
                user_id,
                order_number,
                profiles(email, name)
            )
        `)
        .eq('id', returnId)
        .single();

    if (fetchError) throw fetchError;

    const updates = [
        supabaseAdmin.from('returns').update({
            status: 'rejected',
            staff_notes: reason,
            updated_at: new Date().toISOString()
        }).eq('id', returnId)
    ];

    const results = await Promise.all(updates);
    const hasError = results.find(r => r.error);
    if (hasError) throw hasError.error;

    if (returnRequest) {
        // Offload History, Financial Logs and State Aggregation
        (async () => {
            try {
                // 1. Log History for Timeline
                const historyNote = reason ? `${ORDER.RETURN_REJECTED_NOTE}: ${reason}` : ORDER.RETURN_REJECTED_NOTE;
                await orderService.logStatusHistory(returnRequest.order_id, 'return_rejected', adminId, historyNote, 'ADMIN');

                // 2. Determine previous status and revert
                const { data: order } = await supabaseAdmin.from('orders').select('previous_state').eq('id', returnRequest.order_id).single();
                const revertTo = order?.previous_state || 'delivered';
                
                await supabaseAdmin.from('orders').update({ status: revertTo }).eq('id', returnRequest.order_id);
                
                await FinancialEventLogger.logReturnRejected(returnId, returnRequest.order_id, adminId, reason);

                log.info('RETURN_REJECTED', 'Return rejected and order reverted to previous state', {
                    orderId: returnRequest.order_id,
                    returnId,
                    revertTo
                });
            } catch (err) {
                log.error('BACKGROUND_LOG_ERROR', 'Failed to log return rejection history/events', { error: err.message, returnId });
            }
        })();
    }

    return { success: true };
};

const cancelReturnRequest = async (returnId, userId) => {
    // 1. Fetch Return Request
    const { data: returnRequest, error: fetchError } = await supabaseAdmin
        .from('returns')
        .select('*')
        .eq('id', returnId)
        .eq('user_id', userId)
        .single();

    if (fetchError || !returnRequest) throw new Error(ReturnMessages.REQUEST_NOT_FOUND);

    // 2. Cancellation Check
    // Customers can cancel while the request is still pending approval or approved
    // but not after logistics has started.
    if (!['requested', 'approved'].includes(returnRequest.status)) {
        const cancellationError = new Error(`Cannot cancel return in ${returnRequest.status} state. Picked up items cannot be cancelled.`);
        cancellationError.status = 400;
        throw cancellationError;
    }

    // 3. Update Return and Item Statuses to Cancelled
    const updates = [
        supabaseAdmin.from('returns').update({
            status: 'cancelled',
            updated_at: new Date().toISOString()
        }).eq('id', returnId),
        supabaseAdmin.from('return_items').update({
            status: 'cancelled'
        }).eq('return_id', returnId)
    ];

    const results = await Promise.all(updates);
    const hasError = results.find(r => r.error);
    if (hasError) throw hasError.error;

    // 4. Log History and Revert Order State
    await orderService.logStatusHistory(returnRequest.order_id, 'return_cancelled', userId, ORDER.RETURN_CANCELLED_NOTE, 'USER');
    
    const { data: order } = await supabaseAdmin.from('orders').select('previous_state').eq('id', returnRequest.order_id).single();
    const revertTo = order?.previous_state || 'delivered';
    
    await supabaseAdmin.from('orders').update({ status: revertTo }).eq('id', returnRequest.order_id);

    return { success: true };
};

const updateReturnStatus = async (returnId, status, adminId, notes = '') => {
    // 1. Fetch Return Request (Optimized with Join)
    const { data: returnRequest, error: fetchError } = await supabaseAdmin
        .from('returns')
        .select(`
            *,
            orders:order_id (previous_state)
        `)
        .eq('id', returnId)
        .single();

    if (fetchError || !returnRequest) throw new Error(ReturnMessages.REQUEST_NOT_FOUND);

    // 2. Validate Transition Logic
    const validStatuses = [
        'approved',
        'pickup_scheduled',
        'pickup_attempted',
        'pickup_completed',
        'pickup_failed',
        'picked_up',
        'item_returned',
        'cancelled',
        'completed'
    ];
    if (!validStatuses.includes(status)) {
        throw new Error(`Invalid return status: ${status}`);
    }

    const effectiveStatus = status;

    const allowedNextStatuses = RETURN_STATUS_TRANSITIONS[returnRequest.status] || [];
    if (!allowedNextStatuses.includes(status) && !allowedNextStatuses.includes(effectiveStatus)) {
        const transitionError = new Error(`Return request cannot transition from ${returnRequest.status} to ${status}`);
        transitionError.status = 400;
        throw transitionError;
    }

    const updates = [
        supabaseAdmin.from('returns').update({
            status: effectiveStatus,
            staff_notes: notes || returnRequest.staff_notes,
            updated_at: new Date().toISOString()
        }).eq('id', returnId)
    ];

    const mappedOrderStatus = ORDER_STATUS_BY_RETURN_STATUS[effectiveStatus];
    if (mappedOrderStatus) {
        updates.push(
            supabaseAdmin
                .from('orders')
                .update({ status: mappedOrderStatus, updated_at: new Date().toISOString() })
                .eq('id', returnRequest.order_id)
        );
    }

    // 4. If marking as picked_up (directly or via completed), update all items too
    if (effectiveStatus === 'picked_up') {
        updates.push(
            supabaseAdmin.from('return_items').update({ status: 'picked_up' }).eq('return_id', returnId).eq('status', 'approved')
        );
    }

    // NEW: If marking as item_returned (Bulk Complete), trigger item-level returns for all relevant items
    if (status === 'item_returned') {
        // Fetch all items that need to be transitioned
        const { data: pendingItems } = await supabaseAdmin
            .from('return_items')
            .select('id')
            .eq('return_id', returnId)
            .neq('status', 'item_returned');

        if (pendingItems && pendingItems.length > 0) {
            // We use a loop to trigger all item returns. 
            // Note: Each call to updateReturnItemStatus backgrounds its own heavy work (Razorpay/Inventory)
            // so this won't block the API for too long.
            for (const item of pendingItems) {
                await updateReturnItemStatus(item.id, 'item_returned', adminId, notes);
            }
        }
    }

    const results = await Promise.all(updates);
    const hasError = results.find(r => r.error);
    if (hasError) throw hasError.error;

    // 5. Offload Log Status History and Order State Aggregation
    (async () => {
        try {
            let historyNote = ORDER.DEFAULT_STATUS_UPDATE;
            if (status === 'picked_up') historyNote = ORDER.RETURN_PICKED_UP_NOTE;
            if (status === 'pickup_scheduled') historyNote = 'Return pickup has been scheduled.';
            if (status === 'pickup_attempted') historyNote = 'Delivery partner attempted pickup but was unsuccessful.';
            if (status === 'pickup_completed') historyNote = 'Pickup was successfully completed by the delivery partner.';
            if (status === 'pickup_failed') historyNote = 'Return pickup failed after reaching maximum attempts. Order reverted.';
            
            // Log history
            await orderService.logStatusHistory(returnRequest.order_id, status, adminId, historyNote, 'ADMIN');
            
            // SPECIAL RULE: On pickup failure, revert order state and allow retry
            // Optimized: use pre-fetched previous_state from JOIN
            if (status === 'pickup_failed') {
                const revertTo = returnRequest.orders?.previous_state || 'delivered';
                
                await supabaseAdmin.from('orders').update({ 
                    status: revertTo,
                    updated_at: new Date().toISOString()
                }).eq('id', returnRequest.order_id);
                
                log.info('PICKUP_FAILED_REVERSION', 'Return pickup failed, reverting order to previous state (Optimized)', {
                    orderId: returnRequest.order_id,
                    revertTo
                });
            } else {
                // If cancelled or other status, aggregate order state to update status
                await aggregateOrderState(returnRequest.order_id);
            }
        } catch (err) {
            log.error('BACKGROUND_LOG_ERROR', 'Failed to log return status updated history', { error: err.message, returnId });
        }
    })();

    return { success: true };
};

/**
 * Marks a specific Return Item as returned at the warehouse/dealer.
 * Triggers the refund for that specific item.
 */
const updateReturnItemStatus = async (returnItemId, status, adminId, notes = '') => {
    // 1. Fetch Item Details with Return information
    const { data: rawItem, error: fetchError } = await supabaseAdmin
        .from('return_items')
        .select(`
            *,
            returns (
                id,
                order_id,
                user_id,
                refund_breakdown
            ),
            order_items (*)
        `)
        .eq('id', returnItemId)
        .single();

    if (fetchError || !rawItem) throw new Error(ReturnMessages.ITEM_NOT_FOUND);

    // Normalize Supabase join results: they can be arrays or objects depending on schema relations
    const item = {
        ...rawItem,
        returns: Array.isArray(rawItem.returns) ? rawItem.returns[0] : rawItem.returns,
        order_items: Array.isArray(rawItem.order_items) ? rawItem.order_items[0] : rawItem.order_items,
    };

    if (!item.returns) throw new Error('Return record not found for this item');
    if (!item.order_items) throw new Error('Order item record not found for this return item');

    const oldStatus = item.status;
    if (oldStatus === status) return { success: true };

    const allowedNextStatuses = RETURN_ITEM_STATUS_TRANSITIONS[oldStatus] || [];
    if (!allowedNextStatuses.includes(status)) {
        const transitionError = new Error(`Return item cannot transition from ${oldStatus} to ${status}`);
        transitionError.status = 400;
        throw transitionError;
    }

    log.info('UPDATE_RETURN_ITEM_STATUS', `Updating item ${returnItemId} to ${status}`, {
        oldStatus,
        newStatus: status
    });

    // 2. Update Status
    const { error: updateError } = await supabaseAdmin
        .from('return_items')
        .update({ status })
        .eq('id', returnItemId);

    if (updateError) throw new Error(updateError.message || updateError.details || 'Failed to update return item status in database');

    // MIGRATED FIX: Update returned_quantity immediately upon transition to 'item_returned'
    // This allows aggregateOrderState (called next) to see the correct totalReturnedQty
    if (status === 'item_returned') {
        const orderItem = item.order_items;
        const currentReturnedQty = Number(orderItem.returned_quantity) || 0;
        const newReturnedQty = currentReturnedQty + item.quantity;

        const { error: updateQtyError } = await supabaseAdmin.from('order_items').update({
            returned_quantity: newReturnedQty
        }).eq('id', item.order_item_id);

        if (updateQtyError) throw new Error(updateQtyError.message || 'Failed to update return quantity on order_items');
    }

    // 3. Status-specific secondary actions offloaded
    if (status === 'item_returned') {
            try {
                // A. Log ITEM_RECEIVED_AT_WAREHOUSE to establish physical arrival
                await logStatusHistory(item.returns.order_id, 'ITEM_RETURNED', adminId, `Physical item received at warehouse. Transitioning to Quality Check. (Return Item ID: ${item.id})`, 'ADMIN', 'ITEM_RETURNED');

                // B. Transition item and parent flow into QC
                await Promise.all([
                    supabaseAdmin
                        .from('return_items')
                        .update({ status: 'qc_initiated' })
                        .eq('id', returnItemId),
                    supabaseAdmin
                        .from('returns')
                        .update({ status: 'qc_initiated', updated_at: new Date().toISOString() })
                        .eq('id', item.return_id),
                    supabaseAdmin
                        .from('orders')
                        .update({ status: 'qc_initiated', updated_at: new Date().toISOString() })
                        .eq('id', item.returns.order_id)
                ]);

                await logStatusHistory(item.returns.order_id, 'qc_initiated', adminId, 'Quality check initiated after warehouse receipt.', 'ADMIN');

                // C. Re-aggregate state
                await aggregateReturnState(item.return_id);
                await aggregateOrderState(item.returns.order_id);
            } catch (err) {
                log.error('BACKGROUND_QC_INIT_ERROR', err.message, { returnItemId, error: err });
            }
    } else {
        // For other statuses, just aggregate
        (async () => {
            try {
                await aggregateReturnState(item.return_id);
                await aggregateOrderState(item.returns.order_id);
            } catch (err) {
                log.error('BACKGROUND_AGGREGATE_ERROR', err.message, { returnItemId, error: err });
            }
        })();
    }

    return { success: true };
};

/**
 * Handle specific item refund via Razorpay, incorporating QC findings
 */
const handleItemRefund = async (item, adminId, qcAuditData = null) => {
    // Note: item.returns and item.order_items are already normalized to objects by the caller
    const returnId = item.return_id;
    const orderId = item.returns?.order_id;
    const orderItem = item.order_items; // From pre-fetched snapshot
    
    // Validate that we have the necessary items for calculation
    if (!orderItem) {
        log.error('REFUND_SNAPSHOT_MISSING', 'Cannot process refund as order_item snapshot is missing from trigger payload', { returnItemId: item.id });
        throw new Error("Financial snapshot for order item is missing. Cannot calculate refund.");
    }

    const pricePerUnit = orderItem.price_per_unit || 0;
    const orderQty = orderItem.quantity || 0;

    log.operationStart('HANDLE_ITEM_REFUND', { 
        returnItemId: item.id, 
        hasAuditData: !!qcAuditData 
    });

    // 1. Fetch QC Deductions if applicable
    let qcDeductionAmount = 0;
    let reverseLogisticsCost = 0;
    let qcAudit = null;
    
    if (qcAuditData) {
        // High-performance path: use passed object directly
        if (typeof qcAuditData === 'string') {
            const { data } = await supabaseAdmin
                .from('qc_audits')
                .select('id, deduction_amount, reverse_logistics_cost')
                .eq('id', qcAuditData)
                .single();
            qcAudit = data;
        } else {
            qcAudit = qcAuditData;
        }
        
        if (qcAudit) {
            qcDeductionAmount = Number(qcAudit.deduction_amount || 0);
            reverseLogisticsCost = Number(qcAudit.reverse_logistics_cost || 0);
            log.info('QC_DEDUCTIONS_APPLIED', `Applying QC Deduction: ${qcDeductionAmount}, Logistics: ${reverseLogisticsCost}`, { returnItemId: item.id });
        }
    }

    // Idempotency: skip if we've already refunded this specific return_item
    const { data: existingRefund } = await supabaseAdmin
        .from('refunds')
        .select('id, metadata, status')
        .eq('return_id', returnId)
        .in('status', AGGREGATE_REFUND_STATUSES)
        .maybeSingle();

    // Also check via metadata if column exists (best-effort)
    if (existingRefund) {
        // Additional check: see if this exact item was already refunded
        // by checking if the refund metadata contains this return_item_id
        if (existingRefund.metadata && existingRefund.metadata.return_item_id === item.id) {
            log.warn('REFUND_IDEMPOTENCY_BLOCK', 'Refund already exists for this return item', { returnItemId: item.id });
            return;
        }
    }

    // calculate product refund for this item (with null safety)
    // 1. Calculate base refund for the item using central calculator
    // This correctly handles tax-inclusive/exclusive pricing snapshots
    const itemRefundBreakdown = RefundCalculator.calculateItemRefund(orderItem, item.quantity);
    let refundAmount = Math.max(0, itemRefundBreakdown.totalRefund - qcDeductionAmount - reverseLogisticsCost);

    // Check if this is the LAST item of the return request — attach delivery refund if so
    const { data: otherItems } = await supabaseAdmin
        .from('return_items')
        .select('status')
        .eq('return_id', returnId)
        .neq('id', item.id);

    const returnTerminalStatuses = new Set(['item_returned', 'qc_passed', 'qc_failed', 'return_to_customer', 'dispose_liquidate']);
    const allOthersReturned = !otherItems?.length || otherItems.every(oi => returnTerminalStatuses.has(oi.status));
    if (allOthersReturned) {
        const totalDeliveryRefund = Number(item.returns.refund_breakdown?.totalDeliveryRefund) || 0;
        refundAmount += totalDeliveryRefund;
    }

    // Validate refund amount — prevent NaN or zero from reaching Razorpay
    const refundAmountPaise = Math.round(refundAmount * 100);
    if (!Number.isFinite(refundAmountPaise) || refundAmountPaise <= 0) {
        log.error('REFUND_INVALID_AMOUNT', `Calculated refund amount is invalid: ${refundAmount}`, {
            returnItemId: item.id,
            orderItemId: item.order_item_id,
            pricePerUnit,
            orderQty,
            itemQuantity: item.quantity,
        });
        throw new Error(`Invalid refund amount calculated: ₹${refundAmount}. Cannot process refund.`);
    }

    // 3. Fetch Razorpay Payment ID and payment amount
    const { data: payment } = await supabaseAdmin
        .from('payments')
        .select('razorpay_payment_id, amount')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (!payment?.razorpay_payment_id) throw new Error(ReturnMessages.PAYMENT_ID_NOT_FOUND);

    // 3b. Check already-refunded amount for this payment to avoid exceeding captured amount
    const { data: existingRefunds } = await supabaseAdmin
        .from('refunds')
        .select('amount')
        .eq('order_id', orderId)
        .in('status', AGGREGATE_REFUND_STATUSES);

    const alreadyRefunded = (existingRefunds || []).reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const paymentAmount = Number(payment.amount) || 0;
    const maxRefundable = paymentAmount - alreadyRefunded;

    // Cap the refund amount to prevent Razorpay "refund amount exceeds captured amount" error
    if (refundAmount > maxRefundable && maxRefundable > 0) {
        log.warn('REFUND_AMOUNT_CAPPED', `Calculated refund ₹${refundAmount} exceeds remaining balance ₹${maxRefundable}. Capping.`, {
            returnItemId: item.id,
            calculated: refundAmount,
            paymentAmount,
            alreadyRefunded,
            maxRefundable
        });
        refundAmount = maxRefundable;
    } else if (maxRefundable <= 0) {
        log.warn('REFUND_NO_BALANCE', `No refundable balance remaining (payment: ₹${paymentAmount}, already refunded: ₹${alreadyRefunded})`, {
            returnItemId: item.id
        });
        return; // Nothing left to refund
    }

    // Recalculate paise after capping
    const finalRefundPaise = Math.round(refundAmount * 100);

    // 4. Initiate Razorpay Refund
    log.info('RAZORPAY_REFUND_INIT', `Refunding ₹${refundAmount} (${finalRefundPaise} paise) for item ${item.id}`, { paymentId: payment.razorpay_payment_id });

    const refund = await razorpay.payments.refund(payment.razorpay_payment_id, {
        amount: finalRefundPaise,
        notes: {
            return_id: returnId,
            return_item_id: item.id,
            order_id: orderId
        }
    });

    // 5. Log Refund and Update Order Item
    const refundInsertData = {
        return_id: returnId,
        order_id: orderId,
        razorpay_refund_id: refund.id,
        amount: refundAmount,
        status: refund.status,
        refund_type: REFUND_TYPES.BUSINESS_REFUND
    };

    // Attempt to include metadata if the column exists (migration may not have run yet)
    try {
        const { error: insertErr } = await supabaseAdmin.from('refunds').insert({
            ...refundInsertData,
            metadata: { return_item_id: item.id }
        });
        if (insertErr) {
            // Fallback: insert without metadata if column doesn't exist
            log.warn('REFUND_INSERT_FALLBACK', 'metadata column may not exist, retrying without it', { error: insertErr.message });
            const { error: fallbackErr } = await supabaseAdmin.from('refunds').insert(refundInsertData);
            if (fallbackErr) throw new Error(fallbackErr.message || 'Failed to insert refund record');
        }
    } catch (insertCatchErr) {
        // If it's our own thrown error, re-throw. Otherwise wrap it.
        if (insertCatchErr instanceof Error) throw insertCatchErr;
        throw new Error('Failed to insert refund record: ' + JSON.stringify(insertCatchErr));
    }

    // 6. Log detailed refund history
    await logStatusHistory(orderId, 'refund_initiated', adminId, `${ORDER.REFUND_INITIATED_NOTE} | Refund ID: ${refund.id} | Amount: \u20b9${refundAmount.toFixed(2)}`, 'ADMIN', 'REFUND_INITIATED');

    log.info('REFUND_SUCCESS', `Refund processed for item ${item.id}`, { refundId: refund.id, amount: refundAmount });
};

/**
 * Aggregates Return Request Status based on items
 */
const aggregateReturnState = async (returnId) => {
    const { data: returnRequest } = await supabaseAdmin
        .from('returns')
        .select('status')
        .eq('id', returnId)
        .maybeSingle();

    const { data: items } = await supabaseAdmin
        .from('return_items')
        .select('status')
        .eq('return_id', returnId);

    const itemStatuses = (items || []).map((item) => item.status);
    if (itemStatuses.length === 0) {
        return;
    }

    let nextStatus = returnRequest?.status || null;

    const preservedTerminalStatuses = new Set([
        'qc_passed',
        'partial_refund',
        'zero_refund',
        'return_to_customer',
        'dispose_liquidate'
    ]);

    if (itemStatuses.every((status) => status === 'qc_passed')) {
        nextStatus = 'qc_passed';
    } else if (itemStatuses.some((status) => status === 'qc_initiated')) {
        nextStatus = 'qc_initiated';
    } else if (itemStatuses.every((status) => TERMINAL_RETURN_ITEM_STATUSES.has(status))) {
        nextStatus = preservedTerminalStatuses.has(returnRequest?.status)
            ? returnRequest.status
            : itemStatuses.every((status) => status === 'return_to_customer')
                ? 'return_to_customer'
                : itemStatuses.every((status) => status === 'dispose_liquidate')
                    ? 'dispose_liquidate'
                    : 'qc_failed';
    } else if (itemStatuses.some((status) => status === 'qc_failed')) {
        nextStatus = ['partial_refund', 'zero_refund'].includes(returnRequest?.status)
            ? returnRequest.status
            : 'qc_failed';
    } else if (itemStatuses.some((status) => status === 'picked_up')) {
        nextStatus = 'picked_up';
    } else if (itemStatuses.some((status) => status === 'approved')) {
        nextStatus = 'approved';
    }

    if (nextStatus && nextStatus !== returnRequest?.status) {
        await supabaseAdmin
            .from('returns')
            .update({ status: nextStatus, updated_at: new Date().toISOString() })
            .eq('id', returnId);
    }
};

/**
 * Aggregates Order Status and Payment Status based on all items and refunds
 */
const aggregateOrderState = async (orderId) => {
    // 1. Fetch all required aggregate state data concurrently for performance
    const [
        { data: orderItems },
        { data: refunds },
        { data: order }
    ] = await Promise.all([
        supabaseAdmin
            .from('order_items')
            .select('quantity, returned_quantity, is_returnable')
            .eq('order_id', orderId),
        
        supabaseAdmin
            .from('refunds')
            .select('amount')
            .eq('order_id', orderId)
        .in('status', AGGREGATE_REFUND_STATUSES),

        supabaseAdmin
            .from('orders')
            .select('total_amount, payment_status, status, previous_state')
            .eq('id', orderId)
            .single()
    ]);

    // Calculate Physical Status
    const returnableItems = (orderItems || []).filter(i => i.is_returnable !== false);
    const totalReturnableQty = returnableItems.reduce((s, i) => s + (i.quantity || 0), 0);
    const totalReturnedQty = returnableItems.reduce((s, i) => s + (i.returned_quantity || 0), 0);

    // Default to either delivered or previous_state if no returns are active
    const advancedReturnLifecycleStatuses = new Set([
        'pickup_scheduled',
        'pickup_attempted',
        'pickup_completed',
        'picked_up',
        'in_transit_to_warehouse',
        'qc_initiated',
        'qc_passed',
        'qc_failed',
        'partial_refund',
        'zero_refund',
        'return_back_to_customer',
        'dispose_liquidate'
    ]);

    let newStatus = order.status; 
    if (totalReturnedQty > 0) {
        if (!advancedReturnLifecycleStatuses.has(order.status)) {
            newStatus = (totalReturnedQty >= totalReturnableQty) ? 'returned' : 'partially_returned';
        }
    } else if (TRANSIENT_RETURN_ORDER_STATUSES.has(order.status) || order.status === 'return_picked_up') {
        // If we were in a return status but now have 0 returned items (e.g. all cancelled/rejected), revert
        newStatus = order.previous_state || 'delivered';
    }

    // Calculate Payment Status
    const normalizedRefunds = (refunds || []).map((refund) => {
        const status = String(refund.status || '').trim().toUpperCase();

        if (['PROCESSED', 'COMPLETED', 'REFUNDED'].includes(status)) {
            return { ...refund, normalized_status: 'PROCESSED' };
        }

        if (['CREATED', 'INITIATED', 'REFUND_INITIATED', 'PENDING', 'PROCESSING', 'RAZORPAY_PROCESSING'].includes(status)) {
            return { ...refund, normalized_status: 'PENDING' };
        }

        return { ...refund, normalized_status: status };
    });
    const successfulRefunds = normalizedRefunds.filter((refund) => refund.normalized_status === 'PROCESSED');
    const pendingRefunds = normalizedRefunds.filter((refund) => refund.normalized_status === 'PENDING');
    const totalRefunded = successfulRefunds.reduce((sum, refund) => sum + Number(refund.amount || 0), 0);

    let newPaymentStatus = order.payment_status;
    if (totalRefunded > 0) {
        newPaymentStatus = (totalRefunded >= order.total_amount) ? 'refunded' : 'partially_refunded';
    } else if (pendingRefunds.length > 0) {
        newPaymentStatus = 'refund_initiated';
    }

    // 3. Update Order
    const updates = {};
    if (newStatus && newStatus !== order.status) updates.status = newStatus;
    if (newPaymentStatus !== order.payment_status) {
        updates.payment_status = newPaymentStatus;
    }

    if (Object.keys(updates).length > 0) {
        // PERF: Update only what changed, avoiding unnecessary payment_status forcing that shuffles timeline
        await supabaseAdmin.from('orders').update(updates).eq('id', orderId);

        // SYNC LOGGING: Log status changes (Physical)
        if (updates.status) {
            let message = null;
            if (updates.status === 'returned') {
                message = ORDER.ORDER_RETURNED_NOTE;
            } else if (updates.status === 'partially_returned') {
                message = ORDER.PARTIALLY_RETURNED_NOTE;
            }

            if (message) {
                await orderService.logStatusHistory(orderId, updates.status, 'SYSTEM', message, 'SYSTEM');
            }
        }

        // SYNC LOGGING: Log payment changes (Financial)
        // Note: These now log independently so "Order Returned" and "Refund Completed" appear in correct order
        if (updates.payment_status) {
            const payMsg = updates.payment_status === 'refunded'
                ? ORDER.REFUND_PROCESSED_NOTE
                : updates.payment_status === 'refund_initiated'
                    ? ORDER.REFUND_INITIATED_NOTE
                    : ORDER.PARTIALLY_REFUNDED_NOTE;
            await orderService.logStatusHistory(orderId, updates.payment_status, 'SYSTEM', payMsg, 'SYSTEM');
        }
    }
};

/**
 * Get the most recent active return request for an order
 */
const getActiveReturnRequest = async (orderId, userId = null) => {
    await assertOrderAccess(orderId, userId);

    let query = supabase
        .from('returns')
        .select(`
            *,
            return_items (*, order_items (*))
        `)
        .eq('order_id', orderId)
        .in('status', ACTIVE_RETURN_STATUSES);

    if (userId) {
        query = query.eq('user_id', userId);
    }

    const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) throw error;
    return refreshReturnRequestImages(data);
};

const getOrderReturnRequests = async (orderId, userId = null) => {
    await assertOrderAccess(orderId, userId);

    // Fetch ALL return requests for an order to show history
    let query = supabase
        .from('returns')
        .select(`
            id, order_id, user_id, status, refund_amount, reason, created_at,
            return_items (
                id,
                status,
                quantity,
                reason,
                images,
                order_item_id,
                order_items (id, product_id, title)
            )
        `)
        .eq('order_id', orderId);

    if (userId) {
        query = query.eq('user_id', userId);
    }

    const { data, error } = await query
        .order('created_at', { ascending: false });

    if (error) throw error;
    return Promise.all((data || []).map(refreshReturnRequestImages));
};

/**
 * processQCResult
 * Orchestrates the conclusion of a QC audit and initiates the subsequent financial actions.
 */
const processQCResult = async (returnItemId, qcData, adminId) => {
    log.operationStart('PROCESS_QC_RESULT', { returnItemId, status: qcData.status });

    try {
        // 1. Optimized Fetch: Item + Return + Order (User ID) in one round-trip
        const { data: rawItem, error: fetchError } = await supabaseAdmin
            .from('return_items')
            .select(`
                id, return_id, order_item_id, quantity, status,
                returns (
                    id, order_id,
                    orders (user_id)
                ),
                order_items (
                    id, product_id, variant_id, title,
                    price_per_unit, quantity, 
                    taxable_amount, cgst, sgst, igst, total_amount,
                    attribute_snapshot, variant_snapshot
                )
            `)
            .eq('id', returnItemId)
            .single();

        if (fetchError || !rawItem) throw new Error(ReturnMessages.ITEM_NOT_FOUND);

        const item = {
            ...rawItem,
            returns: Array.isArray(rawItem.returns) ? rawItem.returns[0] : rawItem.returns,
            order_items: Array.isArray(rawItem.order_items) ? rawItem.order_items[0] : rawItem.order_items,
        };

        if (item.status !== 'qc_initiated') {
            const statusError = new Error(`QC can only be finalized from qc_initiated. Current status: ${item.status}`);
            statusError.status = 400;
            throw statusError;
        }

        // 2. Submit QC Audit with pre-fetched User ID (Eliminates extra lookup in QCService)
        const QCService = require('./qc.service');
        const audit = await QCService.submitQCAudit({
            ...qcData,
            return_id: item.return_id,
            return_item_id: item.id,
            order_id: item.returns.order_id,
            userId: item.returns?.orders?.user_id
        }, adminId);

        // 3. Update Item status to result of QC
        const nextStatus = qcData.status === 'passed' ? 'qc_passed' : 'qc_failed';
        await supabaseAdmin
            .from('return_items')
            .update({ status: nextStatus })
            .eq('id', returnItemId);

        const finalAction = qcData.action_taken || (qcData.status === 'passed' ? 'FULL_REFUND' : 'ZERO_REFUND');
        const lifecycleStatus = finalAction === 'FULL_REFUND'
            ? 'qc_passed'
            : finalAction === 'PARTIAL_REFUND'
                ? 'partial_refund'
                : finalAction === 'ZERO_REFUND'
                    ? 'zero_refund'
                    : finalAction === 'RETURN_TO_CUSTOMER'
                        ? 'return_to_customer'
                        : 'dispose_liquidate';

        await Promise.all([
            supabaseAdmin
                .from('returns')
                .update({ status: lifecycleStatus, updated_at: new Date().toISOString() })
                .eq('id', item.return_id),
            supabaseAdmin
                .from('orders')
                .update({
                    status: ORDER_STATUS_BY_RETURN_STATUS[lifecycleStatus] || lifecycleStatus,
                    updated_at: new Date().toISOString()
                })
                .eq('id', item.returns.order_id)
        ]);

        if (lifecycleStatus === 'qc_passed' || lifecycleStatus === 'qc_failed') {
            await logStatusHistory(
                item.returns.order_id,
                lifecycleStatus,
                adminId,
                lifecycleStatus === 'qc_passed' ? 'Quality check passed.' : 'Quality check failed.',
                'ADMIN'
            );
        } else {
            const outcomeHistoryStatus = lifecycleStatus === 'return_to_customer'
                ? 'return_to_customer'
                : lifecycleStatus === 'dispose_liquidate'
                    ? 'dispose_liquidate'
                    : lifecycleStatus;
            await logStatusHistory(
                item.returns.order_id,
                outcomeHistoryStatus,
                adminId,
                `QC outcome recorded: ${finalAction}.`,
                'ADMIN'
            );
        }

        // 4. Handle Inventory Routing
        if (qcData.inventory_action === 'SELLABLE') {
            const inventoryService = require('./inventory.service');
            await inventoryService.restoreInventory([{
                product_id: item.order_items.product_id,
                variant_id: item.order_items.variant_id || item.order_items.variant_snapshot?.variant_id || null,
                quantity: item.quantity
            }]);
        }

        // 5. Trigger adjusted refund or final branching action
        if (finalAction === 'PARTIAL_REFUND' || finalAction === 'FULL_REFUND') {
            await handleItemRefund(item, adminId, audit);
        } else if (finalAction === 'ZERO_REFUND') {
            log.info('ZERO_REFUND_FINALIZED', 'QC finalized with zero refund outcome', {
                returnItemId,
                orderId: item.returns.order_id
            });
        } else {
            // TERMINAL STATES (Return to customer / Dispose)
            const finalStatus = finalAction === 'RETURN_TO_CUSTOMER' ? 'return_to_customer' : 'dispose_liquidate';
            await supabaseAdmin
                .from('return_items')
                .update({ status: finalStatus })
                .eq('id', returnItemId);

            await logStatusHistory(item.returns.order_id, finalStatus, adminId, `QC Closed: ${finalAction}. Note: ${qcData.notes || 'None'}`, 'ADMIN', finalStatus);
        }

        // 6. Final re-aggregation
        await aggregateReturnState(item.return_id);
        await aggregateOrderState(item.returns.order_id);

        return { success: true, auditId: audit.id };

    } catch (error) {
        log.operationError('PROCESS_QC_RESULT_ERROR', error);
        throw error;
    }
};

module.exports = {
    getReturnableItems,
    createReturnRequest,
    processReturnApproval,
    processReturnRejection,
    cancelReturnRequest,
    updateReturnStatus,
    getOrderReturnRequests,
    getActiveReturnRequest,
    updateReturnItemStatus,
    aggregateOrderState,
    handleItemRefund,
    processQCResult
};
