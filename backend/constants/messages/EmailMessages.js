class EmailMessages {
    static GREETING_FALLBACK_HI = 'ji'; // 'जी'
    static GREETING_FALLBACK_EN = 'there';

    // Template Strings
    static DEAR = 'emails.common.dear';
    static VALUED_DONOR = 'emails.common.valuedDonor';
    static GENEROUS_DONOR = 'emails.common.generousDonor';
    static WITH_GRATITUDE = 'emails.common.withGratitude';
    static WITH_REGARDS = 'emails.common.withRegards';
    static TEAM = 'emails.common.team';
    static TAX_INFO = 'emails.common.taxInfo';
    static SECURITY_NOTE = 'emails.common.securityNote';
    static RIGHTS = 'emails.common.rights';
    static VISIT = 'emails.common.visit';

    // Log Keys
    static SENT_SUCCESS = 'logs.email.sentSuccess';
    static SEND_ERROR = 'logs.email.sendError';
    static TEMPLATE_GENERATED = 'logs.email.templateGenerated';
    static PROVIDER_INIT = 'logs.email.providerInit';
    static PROVIDER_FALLBACK = 'logs.email.providerFallback';
    static LOG_CREATE_FAILED = 'logs.email.logCreateFailed';
    static LOG_UPDATE_FAILED = 'logs.email.logUpdateFailed';
    static USER_LANG_FETCH_FAILED = 'logs.email.userLangFetchFailed';
    static BLOCKED_DEPRECATED = 'logs.email.blockedDeprecated';
}

module.exports = EmailMessages;
