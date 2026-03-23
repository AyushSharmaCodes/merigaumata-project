class PolicyMessages {
    // Errors
    static POLICY_NOT_FOUND = 'errors.policy.notFound';
    static INVALID_POLICY_TYPE = 'errors.policy.invalidType';
    static UPDATE_FAILED = 'errors.policy.updateFailed';
    static NO_FILE_UPLOADED = 'errors.policy.noFileUploaded';

    // Success
    static POLICY_UPDATED = 'success.policy.updated';
    static POLICY_CREATED = 'success.policy.created';
    static POLICY_UPLOADED = 'success.policy.uploaded';

    // Titles
    static SHIPPING_REFUND_TITLE = 'policy.title.shippingRefund';
    static PRIVACY_POLICY_TITLE = 'policy.title.privacy';
    static TERMS_CONDITIONS_TITLE = 'policy.title.terms';
    static GENERIC_POLICY_TITLE = 'policy.title.generic';

    // Logs
    static LOG_UPLOAD_ERROR = 'logs.policy.uploadError';
    static LOG_GET_ERROR = 'logs.policy.getError';
    static LOG_VERSION_ERROR = 'logs.policy.versionError';
}

module.exports = PolicyMessages;
