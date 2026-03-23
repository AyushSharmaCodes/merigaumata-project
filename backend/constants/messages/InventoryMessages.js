class InventoryMessages {
    // Errors
    static INSUFFICIENT_STOCK = 'errors.inventory.insufficientStock';
    static PRODUCT_NOT_FOUND = 'errors.inventory.productNotFound';
    static VARIANT_NOT_FOUND = 'errors.inventory.variantNotFound';
    static INVALID_QUANTITY = 'errors.inventory.invalidQuantity';
    static OUT_OF_STOCK = 'errors.inventory.outOfStock';
    static RESERVATION_FAILED = 'errors.inventory.reservationFailed';
    static RESERVATION_EXPIRED = 'errors.inventory.reservationExpired';
    static STOCK_UPDATE_FAILED = 'errors.inventory.stockUpdateFailed';
    static MRP_REQUIRED_NO_VARIANTS = 'errors.inventory.mrpRequiredNoVariants';

    // Success
    static STOCK_UPDATED = 'success.inventory.stockUpdated';
    static RESERVATION_SUCCESS = 'success.inventory.reservationSuccess';
    static PRODUCT_CREATED = 'success.inventory.productCreated';
    static PRODUCT_UPDATED = 'success.inventory.productUpdated';
    static PRODUCT_DELETED = 'success.inventory.productDeleted';
    static DEFAULT_PRODUCT_TITLE = 'common.inventory.defaultProductTitle';
    static VARIANT_LABEL = 'common.inventory.variantLabel';
}

module.exports = InventoryMessages;
