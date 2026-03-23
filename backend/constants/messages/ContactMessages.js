class ContactMessages {
    // Admin Alerts
    static NEW_MESSAGE_ALERT = 'admin.alerts.newContactMessage';

    // Email Templates
    static EMAIL_TITLE = 'emails.contact.title';
    static EMAIL_DESC = 'emails.contact.desc';
    static INFO_RECEIVED = 'emails.contact.infoReceived';
    static WE_WILL_CONTACT = 'emails.contact.weWillContact';
    static DETAILS = 'emails.contact.details';
    static MSG_SUMMARY = 'emails.contact.msgSummary';
    static NOT_PROVIDED = 'emails.contact.notProvided';
    static EMAIL_GREETING = 'emails.contact.greeting';

    // Logs
    static PROCESSING_SUBMISSION = 'logs.contact.processingSubmission';
    static ALERT_CREATE_FAILED = 'logs.contact.alertCreateFailed';
    static INTERNAL_NOTIFY_FAILED = 'logs.contact.internalNotifyFailed';
    static AUTO_REPLY_FAILED = 'logs.contact.autoReplyFailed';
    static FETCH_MESSAGES_ERROR = 'logs.contact.fetchMessagesError';
    static FETCH_DETAIL_ERROR = 'logs.contact.fetchDetailError';
    static FETCH_DETAIL_INIT = 'logs.contact.fetchDetailInit';
    static FETCH_DETAIL_SUCCESS = 'logs.contact.fetchDetailSuccess';
    static NO_MESSAGE_FOUND = 'logs.contact.noMessageFound';
    static AUTO_MARKING_READ = 'logs.contact.autoMarkingRead';
    static SYNC_ALERT_STATUS = 'logs.contact.syncAlertStatus';
    static SYNC_ALERT_FAILED = 'logs.contact.syncAlertFailed';
    static CREATE_SUCCESS = 'logs.contact.createSuccess';
    static CREATE_FAILED = 'logs.contact.createFailed';
    static UPDATE_MATCH_ERROR = 'logs.contact.updateMatchError';
    static UPDATE_FAILED = 'logs.contact.updateFailed';
}

module.exports = ContactMessages;
