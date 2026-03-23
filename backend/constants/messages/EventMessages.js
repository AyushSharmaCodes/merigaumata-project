class EventMessages {
    static NOT_FOUND = 'errors.event.notFound';
    static REGISTRATION_NOT_FOUND = 'errors.event.registrationNotFound';
    static REGISTRATION_CLOSED = 'errors.event.registrationClosed';
    static REGISTRATION_ALREADY_CANCELLED = 'errors.event.registrationAlreadyCancelled';
    static REGISTRATION_CANCELLED = 'success.event.registrationCancelled';
    static DUPLICATE_REGISTRATION = 'errors.event.duplicateRegistration';
    static EVENT_CANCELLED = 'errors.event.eventCancelled';
    static PAYMENT_VERIFICATION_FAILED = 'errors.event.paymentVerificationFailed';
    static REGISTRATION_FAILED_REFUNDED = 'errors.event.registrationFailedRefunded';
    static REGISTRATION_FAILED_CONTACT_SUPPORT = 'errors.event.registrationFailedContactSupport';
    static CANCELLATION_DEADLINE_EXCEEDED = 'errors.event.cancellationDeadlineExceeded';
    static DEFAULT_TITLE = 'common.event.defaultTitle';

    // Capacity
    static CAPACITY_FULL = 'errors.event.capacityFull';

    // Cancellation
    static CANCELLATION_FAILED = 'errors.event.cancellationFailed';
    static CANCELLATION_JOB_ENQUEUE_FAILED = 'errors.event.cancellationJobEnqueueFailed';
}

module.exports = EventMessages;
