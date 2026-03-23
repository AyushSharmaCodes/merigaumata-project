class OrderMessages {
    static ORDER_NOT_FOUND = 'errors.order.notFound';
    static STATUS_UPDATED = 'success.order.statusUpdated';
    static CANCELLED = 'success.order.cancelled';
    static CANCEL_SUCCESS = 'success.order.cancelSuccess';
    static RETURN_REQUESTED = 'success.order.returnRequested';
    static RETURN_SUCCESS = 'success.order.returnSuccess';
    static INVALID_TRANSITION = 'errors.order.invalidTransition';
    static UPDATE_FAILED = 'errors.order.updateFailed';
    static ORDER_CANNOT_BE_CANCELLED = 'errors.order.cannotBeCancelled';
    static DEFAULT_STATUS_UPDATE = 'common.order.statusUpdated';
    static REFUND_INITIATED_NOTE = 'common.order.refundInitiatedNote';
    static CANCELLED_BY_USER = 'common.order.cancelledByUser';
    static ORDER_CREATED = 'common.order.created';
    static ONLY_DELIVERED_RETURNABLE = 'errors.order.onlyDeliveredReturnable';
    static RETURN_REQUESTED_NOTE = 'common.order.returnRequestedNote';
    static RETURN_PICKED_UP_NOTE = 'common.order.returnPickedUpNote';

    // Technical/Requirement Errors
    static ORDER_DATA_REQUIRED = 'errors.order.orderDataRequired';
    static ORDER_FETCH_FAILED = 'errors.order.fetchFailed';
    static PAYMENT_FETCH_FAILED = 'errors.payment.fetchFailed';
    static RAZORPAY_ID_MISSING = 'errors.payment.razorpayIdMissing';
    static RETURN_APPROVED_NOTE = 'common.order.returnApprovedNote';
    static RETURN_REJECTED_NOTE = 'common.order.returnRejectedNote';
    static RETURN_CANCELLED_NOTE = 'common.order.returnCancelledNote';
    static ITEM_RETURNED_NOTE = 'common.order.itemReturnedNote';
    static ORDER_RETURNED_NOTE = 'common.order.orderReturnedNote';
    static PARTIALLY_RETURNED_NOTE = 'common.order.partiallyReturnedNote';
    static PAYMENT_STATUS_AUTO_UPDATE = 'common.order.paymentStatusAutoUpdate';
    static PAYMENT_SUCCESS_NOTE = 'common.order.paymentSuccessNote';
    static PAYMENT_FAILED_NOTE = 'common.order.paymentFailedNote';
    static REFUND_PROCESSED_NOTE = 'common.order.refundProcessedNote';
    static PARTIALLY_REFUNDED_NOTE = 'common.order.partiallyRefundedNote';
}

module.exports = OrderMessages;
