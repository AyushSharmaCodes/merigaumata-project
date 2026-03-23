class CartMessages {
    // Success
    static CART_CLEARED = 'success.cart.cleared';
    static ITEM_ADDED = 'success.cart.itemAdded';
    static ITEM_REMOVED = 'success.cart.itemRemoved';
    static CART_UPDATED = 'success.cart.updated';
    static COUPON_APPLIED = 'success.cart.couponApplied';
    static COUPON_REMOVED = 'success.cart.couponRemoved';

    // Errors
    static EMPTY_CART = 'errors.cart.empty';
    static INVALID_QUANTITY = 'errors.cart.invalidQuantity';
    static USER_GUEST_ID_REQUIRED = 'errors.cart.authRequired';
    static PRODUCT_NOT_FOUND = 'errors.inventory.productNotFound';
    static VARIANT_NOT_FOUND = 'errors.inventory.variantNotFound';
    static INSUFFICIENT_STOCK = 'errors.inventory.insufficientStock';

    // Logs
    static LOG_GET_ERROR = 'logs.cart.getError';
    static LOG_ADD_ERROR = 'logs.cart.addError';
    static LOG_UPDATE_ERROR = 'logs.cart.updateError';
    static LOG_REMOVE_ERROR = 'logs.cart.removeError';
    static LOG_COUPON_APPLY_ERROR = 'logs.cart.couponApplyError';
    static LOG_COUPON_REMOVE_ERROR = 'logs.cart.couponRemoveError';
    static LOG_TOTALS_ERROR = 'logs.cart.totalsError';
    static LOG_CLEAR_ERROR = 'logs.cart.clearError';
    static LOG_MERGE_SUCCESS = 'logs.cart.mergeSuccess';
    static LOG_MERGE_ERROR = 'logs.cart.mergeError';
}

module.exports = CartMessages;
