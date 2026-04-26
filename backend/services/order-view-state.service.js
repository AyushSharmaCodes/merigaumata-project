const { ORDER_STATUS } = require('../config/constants');

const RETURN_ELIGIBLE_ORDER_STATUSES = new Set([
    ORDER_STATUS.DELIVERED,
    ORDER_STATUS.RETURN_REQUESTED,
    ORDER_STATUS.RETURN_REJECTED,
    ORDER_STATUS.RETURN_APPROVED,
    ORDER_STATUS.PICKUP_SCHEDULED,
    ORDER_STATUS.PICKUP_ATTEMPTED,
    ORDER_STATUS.PICKUP_COMPLETED,
    ORDER_STATUS.PICKED_UP,
    ORDER_STATUS.IN_TRANSIT_TO_WAREHOUSE,
    ORDER_STATUS.PARTIALLY_RETURNED,
    ORDER_STATUS.QC_INITIATED,
    ORDER_STATUS.QC_PASSED,
    ORDER_STATUS.QC_FAILED,
    ORDER_STATUS.PARTIAL_REFUND,
    ORDER_STATUS.ZERO_REFUND,
    ORDER_STATUS.RETURN_BACK_TO_CUSTOMER,
    ORDER_STATUS.DISPOSE_OR_LIQUIDATE
]);

const PRE_SHIPMENT_CANCELABLE_STATUSES = new Set([
    ORDER_STATUS.PENDING,
    ORDER_STATUS.CONFIRMED,
    ORDER_STATUS.PROCESSING,
    ORDER_STATUS.PACKED
]);

const INTERNAL_INVOICE_TYPES = new Set(['TAX_INVOICE', 'BILL_OF_SUPPLY']);

const HIGH_FREQUENCY_ORDER_STATUSES = new Set([
    ORDER_STATUS.PENDING,
    ORDER_STATUS.CONFIRMED,
    ORDER_STATUS.PROCESSING,
    ORDER_STATUS.PACKED,
    ORDER_STATUS.SHIPPED,
    ORDER_STATUS.OUT_FOR_DELIVERY,
    ORDER_STATUS.DELIVERY_UNSUCCESSFUL,
    ORDER_STATUS.DELIVERY_REATTEMPT_SCHEDULED,
    ORDER_STATUS.RTO_IN_TRANSIT,
    ORDER_STATUS.RETURNED_TO_ORIGIN,
    ORDER_STATUS.RETURN_REQUESTED,
    ORDER_STATUS.RETURN_APPROVED,
    ORDER_STATUS.PICKUP_SCHEDULED,
    ORDER_STATUS.PICKUP_ATTEMPTED,
    ORDER_STATUS.PICKUP_COMPLETED,
    ORDER_STATUS.PICKED_UP,
    ORDER_STATUS.IN_TRANSIT_TO_WAREHOUSE,
    ORDER_STATUS.PARTIALLY_RETURNED,
    ORDER_STATUS.QC_INITIATED,
    ORDER_STATUS.REFUND_INITIATED
]);

const RETURN_REQUEST_BLOCKING_STATUSES = new Set([
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
    'partial_refund',
    'zero_refund',
    'return_to_customer',
    'dispose_liquidate',
    'completed'
]);

const CUSTOMER_CANCELABLE_RETURN_STATUSES = new Set(['requested', 'approved']);

function normalizeStatus(value) {
    return String(value || '').trim().toLowerCase();
}

function getLatestReturnRequest(order) {
    const returns = Array.isArray(order?.return_requests) ? order.return_requests : [];
    return returns
        .slice()
        .sort((a, b) => new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime())[0] || null;
}

function getActiveReturnRequest(order) {
    const returns = Array.isArray(order?.return_requests) ? order.return_requests : [];
    return returns
        .slice()
        .sort((a, b) => new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime())
        .find((returnRequest) => {
            const status = normalizeStatus(returnRequest.status);
            return status !== 'rejected' && status !== 'cancelled';
        }) || returns[0] || null;
}

function deriveLifecycleFlow(status) {
    const normalized = normalizeStatus(status);

    if (normalized === ORDER_STATUS.CANCELLED_BY_ADMIN || normalized === ORDER_STATUS.CANCELLED_BY_CUSTOMER) {
        return 'cancellation';
    }

    if ([
        ORDER_STATUS.DELIVERY_UNSUCCESSFUL,
        ORDER_STATUS.DELIVERY_REATTEMPT_SCHEDULED,
        ORDER_STATUS.RTO_IN_TRANSIT,
        ORDER_STATUS.RETURNED_TO_ORIGIN
    ].includes(normalized)) {
        return 'delivery_recovery';
    }

    if ([
        ORDER_STATUS.RETURN_REQUESTED,
        ORDER_STATUS.RETURN_APPROVED,
        ORDER_STATUS.PICKUP_SCHEDULED,
        ORDER_STATUS.PICKUP_ATTEMPTED,
        ORDER_STATUS.PICKUP_COMPLETED,
        ORDER_STATUS.PICKUP_FAILED,
        ORDER_STATUS.PICKED_UP,
        ORDER_STATUS.IN_TRANSIT_TO_WAREHOUSE,
        ORDER_STATUS.PARTIALLY_RETURNED,
        ORDER_STATUS.RETURNED,
        ORDER_STATUS.QC_INITIATED,
        ORDER_STATUS.QC_PASSED,
        ORDER_STATUS.QC_FAILED,
        ORDER_STATUS.PARTIAL_REFUND,
        ORDER_STATUS.ZERO_REFUND,
        ORDER_STATUS.RETURN_BACK_TO_CUSTOMER,
        ORDER_STATUS.DISPOSE_OR_LIQUIDATE,
        ORDER_STATUS.REFUND_INITIATED,
        ORDER_STATUS.GATEWAY_PROCESSING,
        ORDER_STATUS.REFUNDED
    ].includes(normalized)) {
        return 'return';
    }

    return 'normal';
}

function deriveStepState(order) {
    const normalizedStatus = normalizeStatus(order?.status);
    const activeReturn = getActiveReturnRequest(order);

    const lifecycleFlow = deriveLifecycleFlow(normalizedStatus);

    return {
        current_status: normalizedStatus,
        current_flow: lifecycleFlow,
        active_return_request_id: activeReturn?.id || null,
        active_return_status: activeReturn ? normalizeStatus(activeReturn.status) : null,
        is_terminal: [
            ORDER_STATUS.CANCELLED_BY_ADMIN,
            ORDER_STATUS.CANCELLED_BY_CUSTOMER,
            ORDER_STATUS.ZERO_REFUND,
            ORDER_STATUS.RETURN_BACK_TO_CUSTOMER,
            ORDER_STATUS.DISPOSE_OR_LIQUIDATE,
            ORDER_STATUS.REFUNDED
        ].includes(normalizedStatus)
    };
}

function deriveDocumentState(order) {
    const invoices = Array.isArray(order?.invoices) ? order.invoices : [];
    const internalInvoice = invoices.find((invoice) =>
        INTERNAL_INVOICE_TYPES.has(invoice.type) && invoice.public_url
    ) || null;
    const receiptInvoice = invoices.find((invoice) =>
        invoice.type === 'RAZORPAY' && invoice.public_url
    ) || null;

    return {
        can_download_receipt: !!receiptInvoice,
        receipt_invoice_id: receiptInvoice?.id || null,
        receipt_url: receiptInvoice?.public_url || null,
        can_download_invoice: !!internalInvoice,
        invoice_id: internalInvoice?.id || null,
        invoice_url: internalInvoice?.public_url || null
    };
}

function deriveReturnAvailability(order) {
    const normalizedStatus = normalizeStatus(order?.status);
    const items = Array.isArray(order?.items) ? order.items : [];
    const returnRequests = Array.isArray(order?.return_requests) ? order.return_requests : [];

    const pendingReturnQtyByOrderItemId = new Map();

    for (const returnRequest of returnRequests) {
        const returnStatus = normalizeStatus(returnRequest?.status);
        if (!RETURN_REQUEST_BLOCKING_STATUSES.has(returnStatus)) continue;

        for (const returnItem of returnRequest.return_items || []) {
            const orderItemId = returnItem.order_item_id;
            if (!orderItemId) continue;
            const quantity = Number(returnItem.quantity || 0);
            pendingReturnQtyByOrderItemId.set(
                orderItemId,
                (pendingReturnQtyByOrderItemId.get(orderItemId) || 0) + quantity
            );
        }
    }

    let returnableItemCount = 0;
    let returnableQuantityCount = 0;

    for (const item of items) {
        const isReturnable = item.is_returnable !== false && item.product?.isReturnable !== false && item.product_snapshot?.is_returnable !== false;
        if (!isReturnable) continue;

        const orderedQty = Number(item.quantity || 0);
        const returnedQty = Number(item.returned_quantity || 0);
        const pendingQty = Number(pendingReturnQtyByOrderItemId.get(item.id) || 0);
        const remainingQty = Math.max(0, orderedQty - returnedQty - pendingQty);

        if (remainingQty > 0) {
            returnableItemCount += 1;
            returnableQuantityCount += remainingQty;
        }
    }

    const latestReturn = getLatestReturnRequest(order);

    return {
        can_request_return: RETURN_ELIGIBLE_ORDER_STATUSES.has(normalizedStatus) && returnableItemCount > 0,
        returnable_item_count: returnableItemCount,
        returnable_quantity_count: returnableQuantityCount,
        has_return_requests: returnRequests.length > 0,
        latest_return_request_id: latestReturn?.id || null,
        latest_return_status: latestReturn ? normalizeStatus(latestReturn.status) : null,
        can_cancel_latest_return: latestReturn ? CUSTOMER_CANCELABLE_RETURN_STATUSES.has(normalizeStatus(latestReturn.status)) : false
    };
}

function deriveAvailableAdminTransitions(status) {
    switch (normalizeStatus(status)) {
    case ORDER_STATUS.PENDING:
        return [ORDER_STATUS.CONFIRMED];
    case ORDER_STATUS.CONFIRMED:
        return [ORDER_STATUS.PROCESSING];
    case ORDER_STATUS.PROCESSING:
        return [ORDER_STATUS.PACKED];
    case ORDER_STATUS.PACKED:
        return [ORDER_STATUS.SHIPPED];
    case ORDER_STATUS.SHIPPED:
        return [ORDER_STATUS.OUT_FOR_DELIVERY, ORDER_STATUS.DELIVERY_UNSUCCESSFUL];
    case ORDER_STATUS.OUT_FOR_DELIVERY:
        return [ORDER_STATUS.DELIVERED, ORDER_STATUS.DELIVERY_UNSUCCESSFUL];
    case ORDER_STATUS.DELIVERY_UNSUCCESSFUL:
        return [ORDER_STATUS.DELIVERY_REATTEMPT_SCHEDULED, ORDER_STATUS.RTO_IN_TRANSIT];
    case ORDER_STATUS.DELIVERY_REATTEMPT_SCHEDULED:
        return [ORDER_STATUS.OUT_FOR_DELIVERY, ORDER_STATUS.RTO_IN_TRANSIT];
    case ORDER_STATUS.RTO_IN_TRANSIT:
        return [ORDER_STATUS.RETURNED_TO_ORIGIN];
    default:
        return [];
    }
}

function deriveAdminActionState(order, documentState, user) {
    const role = normalizeStatus(user?.role);
    const isAdminOrManager = role === 'admin' || role === 'manager';
    const currentStatus = normalizeStatus(order?.status);
    const activeReturn = getActiveReturnRequest(order);
    const activeReturnStatus = normalizeStatus(activeReturn?.status);

    return {
        can_manage_invoice: isAdminOrManager,
        can_generate_invoice: isAdminOrManager && !documentState.can_download_invoice,
        can_regenerate_invoice: isAdminOrManager,
        can_cancel_order: isAdminOrManager && PRE_SHIPMENT_CANCELABLE_STATUSES.has(currentStatus),
        available_status_transitions: isAdminOrManager ? deriveAvailableAdminTransitions(currentStatus) : [],
        active_return_request_id: activeReturn?.id || null,
        can_approve_active_return: isAdminOrManager && activeReturnStatus === 'requested',
        can_reject_active_return: isAdminOrManager && activeReturnStatus === 'requested',
        can_mark_active_return_picked_up: isAdminOrManager && ['approved', 'pickup_scheduled'].includes(activeReturnStatus)
    };
}

function deriveSyncState(order) {
    const currentStatus = normalizeStatus(order?.status);
    const paymentStatus = normalizeStatus(order?.payment_status || order?.paymentStatus);
    const highFrequency = HIGH_FREQUENCY_ORDER_STATUSES.has(currentStatus) || (
        currentStatus === ORDER_STATUS.RETURNED && !['refunded', 'partially_refunded'].includes(paymentStatus)
    );

    return {
        requires_high_frequency_polling: highFrequency,
        poll_interval_ms: highFrequency ? 8000 : 30000
    };
}

function buildOrderViewState(order, user = null) {
    const normalizedStatus = normalizeStatus(order?.status);
    const stepState = deriveStepState(order);
    const documentState = deriveDocumentState(order);
    const returnState = deriveReturnAvailability(order);
    const adminActionState = deriveAdminActionState(order, documentState, user);
    const syncState = deriveSyncState(order);

    return {
        actions: {
            can_cancel_order: PRE_SHIPMENT_CANCELABLE_STATUSES.has(normalizedStatus),
            can_request_return: returnState.can_request_return,
            can_cancel_latest_return: returnState.can_cancel_latest_return,
            admin: adminActionState
        },
        documents: documentState,
        returns: returnState,
        lifecycle: stepState,
        sync: syncState
    };
}

module.exports = {
    buildOrderViewState
};
