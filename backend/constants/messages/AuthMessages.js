class AuthMessages {
    // Errors
    static USER_NOT_FOUND = 'errors.profile.notFound';
    static ACCOUNT_NOT_FOUND = 'errors.auth.accountNotFound';
    static ACCOUNT_BLOCKED = 'errors.auth.accountBlocked';
    static INVALID_PASSWORD = 'errors.auth.invalidPassword';
    static MANAGER_TEMP_PASSWORD_EXPIRED = 'errors.auth.managerTemporaryPasswordExpired';
    static ACCOUNT_DELETED = 'errors.auth.accountDeleted';
    static GOOGLE_ONLY_VERIFICATION = 'errors.auth.googleOnlyVerification';
    static AUTHENTICATION_REQUIRED = 'errors.auth.authenticationRequired';
    static FORBIDDEN = 'errors.auth.forbidden';
    static INSUFFICIENT_PERMISSIONS = 'errors.auth.insufficientPermissions';
    static MANAGER_NOT_FOUND = 'errors.auth.managerNotFound';
    static MANAGER_INACTIVE = 'errors.auth.managerInactive';
    static VERIFY_PERMISSIONS_FAILED = 'errors.auth.verifyPermissionsFailed';
    static DELETION_IN_PROGRESS = 'errors.auth.deletionInProgress';
    static SESSION_EXPIRED = 'errors.auth.sessionExpired';
    static ROLE_MISMATCH = 'errors.auth.roleMismatch';
    static INVALID_SESSION = 'errors.auth.invalidSession';
    static REACTIVATION_FAILED = 'errors.auth.reactivationFailed';
    static SYNC_FAILED = 'errors.auth.syncFailed';
    static SESSION_EXPIRED_OR_INVALID = 'errors.auth.sessionExpiredOrInvalid';
    static RESTORE_SESSION_FAILED = 'errors.auth.restoreSessionFailed';
    static VERIFICATION_TOKEN_REQUIRED = 'errors.auth.verificationTokenRequired';
    static INVALID_VERIFICATION_LINK = 'errors.auth.invalidVerificationLink';
    static VERIFICATION_LINK_EXPIRED = 'errors.auth.verificationLinkExpired';
    static REFRESH_TOKEN_REQUIRED = 'errors.auth.refreshTokenRequired';
    static INVALID_REFRESH_TOKEN = 'errors.auth.invalidRefreshToken';
    static REFRESH_TOKEN_EXPIRED = 'errors.auth.refreshTokenExpired';
    static SESSION_EXPIRED_PLEASE_LOGIN = 'errors.auth.sessionExpiredPleaseLogin';
    static EMAIL_NOT_FOUND = 'errors.auth.emailNotFound';
    static EMAIL_NOT_CONFIRMED = 'errors.auth.emailNotConfirmed';
    static ACCOUNT_DELETED_RETRY = 'errors.auth.accountDeletedRetry';
    static ACCOUNT_BLOCKED_CONTACT = 'errors.auth.accountBlockedContact';
    static PASSWORD_RESET_INIT_FAILED = 'errors.auth.passwordResetInitFailed';
    static PASSWORD_RESET_TOKEN_REQUIRED = 'errors.auth.passwordResetTokenRequired';
    static INVALID_RESET_LINK = 'errors.auth.invalidResetLink';
    static RESET_LINK_EXPIRED = 'errors.auth.resetLinkExpired';
    static EMAIL_ALREADY_VERIFIED = 'errors.auth.emailAlreadyVerified';
    static GOOGLE_SIGNIN_REQUIRED = 'errors.auth.googleSigninRequired';
    static USER_DATA_NOT_FOUND = 'errors.auth.userDataNotFound';
    static EMAIL_ALREADY_VERIFIED_LOGIN = 'errors.auth.emailAlreadyVerifiedLogin';
    static RESET_PASSWORD_FAILED = 'errors.auth.resetPasswordFailed';
    static ACCOUNT_ALREADY_EXISTS = 'errors.auth.accountAlreadyExists';
    static PROFILE_INIT_FAILED = 'errors.auth.profileInitFailed';
    static PROFILE_CREATE_FAILED = 'errors.auth.profileCreateFailed';

    // Deletion Flow Errors
    static DELETION_BLOCKED = 'errors.auth.deletionBlocked';
    static INVALID_DAT = 'errors.auth.invalidDat';
    static INVALID_GRACE_PERIOD = 'errors.auth.invalidGracePeriod';
    static NO_DELETION_TO_CANCEL = 'errors.auth.noDeletionToCancel';

    // Success
    static OTP_SENT = 'success.auth.otpSent';
    static LOGOUT_SUCCESS = 'success.auth.logout';
    static REGISTER_SUCCESS = 'success.auth.register';
    static PASSWORD_UPDATED = 'success.auth.passwordUpdated';
    static EMAIL_VERIFIED = 'success.auth.emailVerified';
    static LOGIN_SUCCESS = 'success.auth.login';
    static AUTH_SESSION_SYNCED = 'success.auth.sessionSynced';
    static AUTH_TOKEN_REFRESHED = 'success.auth.tokenRefreshed';
    static RESET_EMAIL_SENT_IF_EXISTS = 'success.auth.resetEmailSentIfExists';
    static PASSWORD_RESET_EMAIL_SENT = 'success.auth.resetEmailSent';
    static PASSWORD_RESET_SUCCESS = 'success.auth.passwordResetSuccess';
    static VERIFICATION_EMAIL_SENT = 'success.auth.verificationEmailSent';
    static CONFIRMATION_EMAIL_SENT = 'success.auth.confirmationEmailSent';

    // Deletion Flow Success
    static DELETION_INITIATED = 'success.auth.deletionInitiated';
    static DELETION_SCHEDULED = 'success.auth.deletionScheduled';
    static DELETION_CANCELLED = 'success.auth.deletionCancelled';
    static DELETION_OTP_SENT = 'success.auth.deletionOtpSent';

    // Logs
    static LOG_CHECK_EMAIL_ERROR = 'logs.auth.checkEmailError';
    static LOG_SESSION_SYNC_ERROR = 'logs.auth.sessionSyncError';
    static LOG_VALIDATE_CREDENTIALS_ERROR = 'logs.auth.validateCredentialsError';
    static LOG_RESEND_CONFIRMATION_ERROR = 'logs.auth.resendConfirmationError';
    static LOG_REGISTRATION_ERROR = 'logs.auth.registrationError';
    static LOG_EMAIL_VERIFICATION_ERROR = 'logs.auth.emailVerificationError';
    static LOG_VERIFY_LOGIN_OTP_ERROR = 'logs.auth.verifyLoginOtpError';
    static LOG_REFRESH_TOKEN_ERROR = 'logs.auth.refreshTokenError';
    static LOG_LOGOUT_ERROR = 'logs.auth.logoutError';
    static LOG_CHANGE_PASSWORD_ERROR = 'logs.auth.changePasswordError';
    static LOG_PASSWORD_RESET_REQUEST_ERROR = 'logs.auth.passwordResetRequestError';
    static LOG_TOKEN_VALIDATION_ERROR = 'logs.auth.tokenValidationError';
    static LOG_PASSWORD_RESET_ERROR = 'logs.auth.passwordResetError';

    static LOG_SYNC_REQUEST_RECEIVED = 'logs.auth.syncRequestReceived';
    static LOG_CREDENTIALS_VALIDATION_FAILED = 'logs.auth.credentialsValidationFailed';
    static LOG_OTP_SENT = 'logs.auth.otpSent';
    static LOG_REGISTER_SUCCESS = 'logs.auth.registerSuccess';
    static LOG_EMAIL_VERIFIED = 'logs.auth.emailVerified';
    static LOG_LOGIN_SUCCESS = 'logs.auth.loginSuccess';
    static LOG_CLEARING_COOKIES = 'logs.auth.clearingCookies';
    static LOG_LOGOUT_SUCCESS = 'logs.auth.logoutSuccess';
    static LOG_PASSWORD_UPDATED = 'logs.auth.passwordUpdated';
    static LOG_RESET_TOKEN_GENERATED = 'logs.auth.resetTokenGenerated';

    static LOG_SESSION_VALIDATION_FAILED = 'logs.auth.sessionValidationFailed';
    static LOG_WELCOME_COL_MISSING = 'logs.auth.welcomeColMissingFallback';
    static LOG_PROFILE_LOOKUP_FAILED = 'logs.auth.profileLookupFailed';
    static LOG_PROFILE_MISSING_CREATION = 'logs.auth.profileMissingCreation';
    static LOG_PROFILE_CREATION_FAILED = 'logs.auth.profileCreationFailed';
    static LOG_PROFILE_SYNC_REQUIRED = 'logs.auth.profileSyncRequired';
    static LOG_PROFILE_REACTIVATION_SYNC = 'logs.auth.profileReactivationSync';
    static LOG_REACTIVATION_FAILED = 'logs.auth.reactivationFailed';
    static LOG_DELETION_CANCEL_FAILED = 'logs.auth.deletionJobCancellationFailed';
    static LOG_GUEST_CART_MERGED = 'logs.auth.guestCartMerged';
    static LOG_GUEST_CART_MERGE_FAILED = 'logs.auth.guestCartMergeFailed';
    static LOG_SYNC_FINALIZING = 'logs.auth.syncSessionFinalizing';
    static LOG_UNEXPECTED_SYNC_ERROR = 'logs.auth.unexpectedSyncError';
    static LOG_WELCOME_LOOKUP_FAILED = 'logs.auth.triggerWelcomeLookupFailed';
    static LOG_WELCOME_ALREADY_SENT = 'logs.auth.welcomeEmailAlreadySent';
    static LOG_WELCOME_SKIPPED_MISSING = 'logs.auth.welcomeEmailSkippedTrackingMissing';
    static LOG_WELCOME_INIT = 'logs.auth.triggerWelcomeInit';
    static LOG_WELCOME_FLAG_UPDATE_FAILED = 'logs.auth.welcomeSentFlagUpdateFailed';
    static LOG_WELCOME_ERROR = 'logs.auth.triggerWelcomeError';
    static LOG_TOKEN_DECRYPTION_FAILED = 'logs.auth.tokenDecryptionFailed';
    static LOG_REGISTRATION_REQUEST = 'logs.auth.registrationRequestReceived';
    static LOG_CLEANUP_WARNING = 'logs.auth.cleanupWarning';
    static LOG_CALLING_PHONE_VALIDATOR = 'logs.auth.callingPhoneValidator';
    static LOG_SEND_CONFIRMATION_EMAIL_FAILED = 'logs.auth.sendConfirmationEmailFailed';
    static LOG_SUPABASE_REFRESH_FAILED = 'logs.auth.supabaseRefreshFailed';
    static LOG_STORE_RESET_TOKEN_FAILED = 'logs.auth.storePasswordResetTokenFailed';
    static LOG_SEND_RESET_EMAIL_FAILED = 'logs.auth.sendPasswordResetEmailFailed';
    static LOG_PASSWORD_RESET_SUCCESS = 'logs.auth.passwordResetSuccess';
    static LOG_GOOGLE_VERIFICATION_SENT = 'logs.auth.googleVerificationEmailSent';
    static LOG_SIGN_OUT_AFTER_RESET_FAILED = 'logs.auth.signOutAfterResetFailed';

    static DEFAULT_USER_NAME = 'common.user.defaultName';
    static VERIFICATION_EMAIL_FAILED = 'errors.auth.verificationEmailFailed';

    // Account Deletion & Profile
    static PROFILE_NOT_FOUND = 'errors.auth.profileNotFound';
    static DELETION_AUTH_FAILED = 'errors.auth.deletionAuthFailed';
    static SEND_CODE_FAILED = 'errors.auth.sendCodeFailed';

    // OTP
    static OTP_STORE_FAILED = 'errors.auth.otpStoreFailed';
}

module.exports = AuthMessages;
