const { supabase, supabaseAdmin } = require('../config/supabase');
const logger = require('../utils/logger');
const Razorpay = require('razorpay');
const { PricingCalculator } = require('./pricing-calculator.service');
const { RefundCalculator } = require('./refund-calculator.service');
const { RefundService } = require('./refund.service');
const { FinancialEventLogger } = require('./financial-event-logger.service');
const { DeliveryChargeService } = require('./delivery-charge.service');
const inventoryService = require('./inventory.service');
const emailService = require('./email');
const { createModuleLogger } = require('../utils/logging-standards');
const orderService = require('./order.service');
const ReturnMessages = require('../constants/messages/ReturnMessages');
const { wrapRazorpayWithTimeout } = require('../utils/razorpay-timeout');

const log = createModuleLogger('ReturnService');
const { logStatusHistory } = require('./history.service');
const { ORDER } = require('../constants/messages');
const AdminNotificationService = require('./admin-notification.service');
const realtimeService = require('./realtime.service');

// Initialize Razorpay
const razorpay = wrapRazorpayWithTimeout(new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
}));

function isMissingColumnError(error, columnName) {
    if (!error) return false;

    const message = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`;
    return (
        error.code === '42703' ||
        error.code === 'PGRST204' ||
        (columnName ? message.includes(columnName) : /column/i.test(message))
    );
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
        'partially_returned',
        'pickupscheduled',
        'pickupattempted',
        'pickupcompleted',
        'intransittowarehouse',
        'qcinprogress',
        'qcpassed',
        'qcfailed',
        'return_completed',
        'return_closed'
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
    // Note: returned_quantity in order_items is updated AFTER approval. 
    // To be safe, we subtract any 'requested' or 'picked_up' quantities.

    const now = new Date();
    const returnableItems = items.filter(item => {
        // Sum up quantities from active (requested/picked_up) returns
        const pendingQty = existingReturns
            ?.filter(r => ['requested', 'picked_up'].includes(r.status))
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
            ?.filter(r => ['requested', 'picked_up'].includes(r.status))
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

    // 5. Update Order Status to 'return_requested' if not already
    const { error: orderUpdateError } = await supabaseAdmin
        .from('orders')
        .update({ status: 'return_requested' })
        .eq('id', orderId);

    if (orderUpdateError) {
        log.warn('RETURN_ORDER_STATUS_UPDATE_FAIL', 'Failed to update order status after return request creation', {
            orderId,
            returnId: returnRequest.id,
            code: orderUpdateError.code,
            message: orderUpdateError.message
        });
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
    await Promise.all([updateReturn, updateItems, updateOrder]);

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

                // 2. Determine previous status logically via aggregation
                await aggregateOrderState(returnRequest.order_id);
                
                await FinancialEventLogger.logReturnRejected(returnId, returnRequest.order_id, adminId, reason);

                log.info('RETURN_REJECTED', 'Return rejected and order state aggregated', {
                    orderId: returnRequest.order_id,
                    returnId,
                    newStatus: 'rejected'
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
    // Customers can only cancel if it's in 'requested' status.
    // Fixed: block if picked_up, approved, or rejected.
    if (returnRequest.status !== 'requested') {
        throw new Error(`Cannot cancel return in ${returnRequest.status} state. Picked up items cannot be cancelled.`);
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

    // 4. Log History and Aggregate Order State
    await orderService.logStatusHistory(returnRequest.order_id, 'return_cancelled', userId, ORDER.RETURN_CANCELLED_NOTE, 'USER');
    await aggregateOrderState(returnRequest.order_id);

    return { success: true };
};

const updateReturnStatus = async (returnId, status, adminId, notes = '') => {
    // 1. Fetch Return Request
    const { data: returnRequest, error: fetchError } = await supabaseAdmin
        .from('returns')
        .select('*')
        .eq('id', returnId)
        .single();

    if (fetchError || !returnRequest) throw new Error(ReturnMessages.REQUEST_NOT_FOUND);

    // 2. Validate Transition Logic
    const validStatuses = ['approved', 'pickup_scheduled', 'picked_up', 'item_returned', 'cancelled', 'completed'];
    if (!validStatuses.includes(status)) {
        throw new Error(`Invalid return status: ${status}`);
    }

    const updates = [
        supabaseAdmin.from('returns').update({
            status: status,
            staff_notes: notes || returnRequest.staff_notes,
            updated_at: new Date().toISOString()
        }).eq('id', returnId)
    ];

    // 4. If marking as picked_up, update all items too
    if (status === 'picked_up') {
        updates.push(
            supabaseAdmin.from('return_items').update({ status: 'picked_up' }).eq('return_id', returnId).eq('status', 'approved')
        );
        // NEW: Also transition the Order itself
        updates.push(
            supabaseAdmin.from('orders').update({ status: 'return_picked_up', updated_at: new Date().toISOString() }).eq('id', returnRequest.order_id)
        );
    }

    const results = await Promise.all(updates);
    const hasError = results.find(r => r.error);
    if (hasError) throw hasError.error;

    // 5. Offload Log Status History and Order State Aggregation
    (async () => {
        try {
            let historyNote = ORDER.DEFAULT_STATUS_UPDATE;
            if (status === 'picked_up') historyNote = ORDER.RETURN_PICKED_UP_NOTE;
            
            // Log history
            await orderService.logStatusHistory(returnRequest.order_id, `return_${status}`, adminId, historyNote, 'ADMIN');
            
            // If MARKED AS RETURNED (receipt of goods): Trigger refunds for all items
            if (status === 'item_returned') {
                const { data: items } = await supabaseAdmin
                    .from('return_items')
                    .select('*, returns (*), order_items (*)')
                    .eq('return_id', returnId)
                    .eq('status', 'approved'); // Only refund approved items

                if (items && items.length > 0) {
                    log.info('RETURN_BULK_REFUND_START', `Initiating refunds for ${items.length} items in return ${returnId}`);
                    for (const item of items) {
                        try {
                            const normalizedItem = {
                                ...item,
                                returns: Array.isArray(item.returns) ? item.returns[0] : item.returns,
                                order_items: Array.isArray(item.order_items) ? item.order_items[0] : item.order_items,
                            };
                            await handleItemRefund(normalizedItem, adminId);
                        } catch (refundErr) {
                            log.error('RETURN_BULK_REFUND_ITEM_ERROR', `Failed to refund item ${item.id} in bulk process`, { error: refundErr.message });
                        }
                    }
                }
            }

            // If cancelled, aggregate order state to revert status
            if (status === 'cancelled') {
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
        (async () => {
            try {
                const restoreResult = await inventoryService.restoreInventory([{
                    product_id: item.order_items.product_id,
                    variant_id: item.order_items.variant_id || item.order_items.variant_snapshot?.variant_id || null,
                    quantity: item.quantity
                }]);
                if (!restoreResult?.success) {
                    throw new Error('Failed to restore inventory for returned item');
                }

                // A. Log ITEM_RETURNED first to establish physical receipt
                await logStatusHistory(item.returns.order_id, 'ITEM_RETURNED', adminId, `${ORDER.ITEM_RETURNED_NOTE} (Return Item ID: ${item.id})`, 'ADMIN', 'ITEM_RETURNED');

                // B. Re-aggregate Return Request and Order state BEFORE refund logging so "Order Returned" follows "Item Returned"
                await aggregateReturnState(item.return_id);
                await aggregateOrderState(item.returns.order_id);

                // C. Trigger the refund
                await handleItemRefund(item, adminId);

                // D. Re-aggregate Order state AGAIN after refund to update payment status and log "Refund Completed/Partial"
                await aggregateOrderState(item.returns.order_id);
            } catch (err) {
                log.error('BACKGROUND_RETURN_PROCESS_ERROR', err.message, { returnItemId, error: err });
            }
        })();
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
 * Handle specific item refund via Razorpay
 */
const handleItemRefund = async (item, adminId) => {
    // Note: item.returns and item.order_items are already normalized to objects by the caller
    const returnId = item.return_id;
    const orderId = item.returns.order_id;
    const orderItem = item.order_items;

    // Idempotency: skip if we've already refunded this specific return_item
    const { data: existingRefund } = await supabaseAdmin
        .from('refunds')
        .select('id')
        .eq('return_id', returnId)
        .eq('status', 'processed')
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

    // 2. Calculate product refund for this item (with null safety)
    // 1. Calculate base refund for the item using central calculator
    // This correctly handles tax-inclusive/exclusive pricing snapshots
    const itemRefundBreakdown = RefundCalculator.calculateItemRefund(orderItem, item.quantity);
    let refundAmount = itemRefundBreakdown.totalRefund;

    // Check if this is the LAST item of the return request — attach delivery refund if so
    const { data: otherItems } = await supabaseAdmin
        .from('return_items')
        .select('status')
        .eq('return_id', returnId)
        .neq('id', item.id);

    const allOthersReturned = !otherItems?.length || otherItems.every(oi => oi.status === 'item_returned');
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
        .in('status', ['processed', 'pending']);

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
        status: RefundService.normalizeRefundStatus(refund.status),
        razorpay_refund_status: RefundService.normalizeRefundStatus(refund.status)
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
    const { data: items } = await supabaseAdmin
        .from('return_items')
        .select('status')
        .eq('return_id', returnId);

    const allReturned = items.every(i => i.status === 'item_returned');
    if (allReturned) {
        await supabaseAdmin.from('returns').update({ status: 'completed' }).eq('id', returnId);
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
            .eq('status', 'processed'),

        supabaseAdmin
            .from('orders')
            .select('total_amount, payment_status, status')
            .eq('id', orderId)
            .single()
    ]);

    // Calculate Physical Status
    const returnableItems = (orderItems || []).filter(i => i.is_returnable !== false);
    const totalReturnableQty = returnableItems.reduce((s, i) => s + (i.quantity || 0), 0);
    const totalReturnedQty = returnableItems.reduce((s, i) => s + (i.returned_quantity || 0), 0);

    let newStatus = 'delivered'; // Default to delivered if no returns are completed/partial
    if (totalReturnedQty > 0) {
        newStatus = (totalReturnedQty >= totalReturnableQty) ? 'returned' : 'partially_returned';
    }

    // Calculate Payment Status
    const totalRefunded = (refunds || []).reduce((s, r) => s + Number(r.amount), 0);

    let newPaymentStatus = order.payment_status;
    if (totalRefunded > 0) {
        newPaymentStatus = (totalRefunded >= order.total_amount) ? 'refunded' : 'partially_refunded';
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
                : ORDER.PARTIALLY_REFUNDED_NOTE;
            await orderService.logStatusHistory(orderId, updates.payment_status, 'SYSTEM', payMsg, 'SYSTEM');
        }
    }
};

const getOrderReturnRequests = async (orderId) => {
    // Fetch ALL return requests for an order to show history
    const { data, error } = await supabase
        .from('returns')
        .select(`
            *,
            return_items (
                id,
                status,
                quantity,
                reason,
                images,
                condition,
                order_item_id,
                order_items (
                    title,
                    price_per_unit,
                    product_id,
                    variant_snapshot
                )
            )
        `)
        .eq('order_id', orderId)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
};

module.exports = {
    getReturnableItems,
    createReturnRequest,
    processReturnApproval,
    processReturnRejection,
    cancelReturnRequest,
    updateReturnStatus,
    getOrderReturnRequests,
    updateReturnItemStatus,
    aggregateOrderState
};
