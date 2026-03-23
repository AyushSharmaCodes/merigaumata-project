class InvoiceMessages {
    // Errors
    static GENERATION_FAILED = 'errors.invoice.generationFailed';
    static SEND_FAILURE = 'errors.invoice.sendFailure';
    static ORDER_NOT_FOUND = 'errors.invoice.orderNotFound';
    static INVALID_FORMAT = 'errors.invoice.invalidFormat';

    // Success
    static GENERATED = 'success.invoice.generated';
    static SENT = 'success.invoice.sent';
    static DOWNLOADED = 'success.invoice.downloaded';
    static DEFAULT_PAYMENT_DESCRIPTION = 'common.invoice.defaultPaymentDescription';
    static PAYMENT_FOR_PREFIX = 'common.invoice.paymentForPrefix';
}

module.exports = InvoiceMessages;
