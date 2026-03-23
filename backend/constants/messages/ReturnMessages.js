class ReturnMessages {
    // Errors
    static ORDER_NOT_FOUND = 'errors.return.orderNotFound';
    static INVALID_STATUS = 'errors.return.invalidStatus';
    static NOT_RETURNABLE = 'errors.return.notReturnable';
    static PERIOD_EXPIRED = 'errors.return.periodExpired';
    static ALREADY_REQUESTED = 'errors.return.alreadyRequested';
    static QUANTITY_MISMATCH = 'errors.return.quantityMismatch';
    static IMAGE_REQUIRED = 'errors.return.imageRequired';
    static BANK_DETAILS_REQUIRED = 'errors.return.bankDetailsRequired';
    static REQUEST_NOT_FOUND = 'errors.return.requestNotFound';

    // Success
    static RETURN_REQUESTED = 'success.return.requested';
    static RETURN_APPROVED = 'success.return.approved';
    static RETURN_REJECTED = 'success.return.rejected';
    static RETURN_COMPLETED = 'success.return.completed';
}

module.exports = ReturnMessages;
