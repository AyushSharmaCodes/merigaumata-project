class DonationMessages {
    // Errors
    static INVALID_AMOUNT = 'errors.donation.invalidAmount';
    static NOT_FOUND = 'errors.donation.notFound';
    static MISSING_DETAILS = 'errors.donation.missingDetails';
    static INVALID_SIGNATURE = 'errors.donation.invalidSignature';
    static SETUP_FAILED = 'errors.donation.setupFailed';
    static UPDATE_FAILED = 'errors.donation.updateFailed';
    static PROCESSING_FAILED = 'errors.donation.processingFailed';
    static PROCESSING_FAILED_WITH_RELEASE = 'errors.donation.processingFailedWithRelease';
    static STATUS_UPDATE_FAILED = 'errors.donation.statusUpdateFailed';

    // Success
    static CREATED = 'success.donation.created';
    static VERIFIED = 'success.donation.verified';
    static CANCELLED = 'success.donation.cancelled';
    static PAUSED = 'success.donation.paused';
    static RESUMED = 'success.donation.resumed';

    // Fallbacks
    static ANONYMOUS_DONOR = 'common.donation.anonymousDonor';
    static DEFAULT_PLAN_NAME = 'common.donation.defaultPlanName';
    static DEFAULT_PLAN_DESCRIPTION = 'common.donation.defaultPlanDescription';
    static QR_CODE_NAME = 'common.donation.qrCodeName';
    static QR_CODE_DESCRIPTION = 'common.donation.qrCodeDescription';
}

module.exports = DonationMessages;
