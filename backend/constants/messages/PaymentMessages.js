class PaymentMessages {
    // Errors
    static PAYMENT_FAILED = 'errors.payment.paymentFailed';
    static RAZORPAY_ERROR = 'errors.payment.razorpayError';
    static INVALID_SIGNATURE = 'errors.payment.invalidSignature';
    static GATEWAY_ERROR = 'errors.payment.gatewayError';
    static ORDER_CREATION_FAILED = 'errors.payment.orderCreationFailed';
    static REFUND_FAILED_NO_ID = 'errors.payment.refundFailedNoId';
    static PAYMENT_REFUNDED_FAILURE = 'errors.payment.refundedOnFailure';
    static SIGNATURE_INVALID = 'errors.payment.signatureInvalid';
    static VERIFICATION_FAILED = 'errors.payment.verificationFailed';
    static STATUS_INVALID = 'errors.payment.statusInvalid';
    static STATUS_UNSUPPORTED = 'errors.payment.statusUnsupported';
    static RECORD_NOT_FOUND = 'errors.payment.recordNotFound';
    static MISMATCH = 'errors.payment.mismatch';
    static ORDER_FAILED_REFUND_CRITICAL = 'errors.payment.orderFailedRefundCritical';
    static ORDER_FAILED_REFUNDED = 'errors.payment.orderFailedRefunded';

    // Success
    static PAYMENT_SUCCESS = 'success.payment.success';
    static REFUND_PROCESSED = 'success.payment.refundProcessed';
    static CAPTURED = 'success.payment.captured';
    static PAYMENT_SUCCESS_NOTE = 'common.order.paymentSuccessNote';
}

module.exports = PaymentMessages;
