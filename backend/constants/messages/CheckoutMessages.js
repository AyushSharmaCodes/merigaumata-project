class CheckoutMessages {
    static PRODUCT_REQUIRED = 'errors.checkout.productRequired';
    static ORDER_NUMBER_FAILED = 'errors.checkout.orderNumberFailed';
    static INVALID_SESSION = 'errors.checkout.invalidSession';
    static BILLING_ADDRESS_NOT_FOUND = 'errors.checkout.billingAddressNotFound';
    static SHIPPING_ADDRESS_NOT_FOUND = 'errors.checkout.shippingAddressNotFound';
    static SYSTEM_ERROR = 'errors.checkout.systemError';
    static ORDER_CREATION_FAILED = 'errors.payment.orderCreationFailed'; // Keep for context or remove? Better to remove if using PAYMENT

    static DEFAULT_CUSTOMER_NAME = 'common.checkout.defaultCustomerName';
    static DEFAULT_CUSTOMER_EMAIL = 'common.checkout.defaultCustomerEmail';
    static BUY_NOW_DEFAULT_NOTES = 'common.checkout.buyNowDefaultNotes';
    static ORDER_REF_PREFIX = 'common.checkout.orderRefPrefix';
}

module.exports = CheckoutMessages;
