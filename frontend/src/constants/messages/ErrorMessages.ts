export class ErrorMessages {
    static readonly AUTH_INVALID_EMAIL_PHONE = "errors.auth.invalidEmailPhone";
    static readonly AUTH_INVALID_OTP = "errors.auth.invalidOtp";
    static readonly AUTH_CHECK_INFO = "errors.auth.checkInfo";
    static readonly AUTH_FIX_ERRORS = "errors.auth.fixErrors";
    static readonly AUTH_NOTICE = "errors.auth.notice";
    static readonly AUTH_ERROR_OCCURRED = "errors.auth.errorOccurred";

    static readonly SYSTEM_INTERNAL_ERROR = "errors.system.internalError";
    static readonly SYSTEM_NETWORK_ERROR = "errors.system.networkError";
    static readonly SYSTEM_VALIDATION_ERROR = "errors.system.validationError";

    static readonly AUTH_LOGIN_REQUIRED = "errors.auth.loginRequired";
    static readonly AUTH_SESSION_EXPIRED = "errors.auth.sessionExpired";
    static readonly AUTH_FORBIDDEN = "errors.auth.forbidden";

    static readonly PAYMENT_FAILED = "errors.payment.failed";
    static readonly PAYMENT_GATEWAY_ERROR = "errors.payment.gatewayError";

    static readonly INVENTORY_INSUFFICIENT_STOCK = "errors.inventory.insufficientStock";

    // Friendly Titles
    static readonly TITLE_CHECK_INFO = "errors.titles.checkInfo";
    static readonly TITLE_LOGIN_REQUIRED = "errors.titles.loginRequired";
    static readonly TITLE_PAYMENT_UPDATE = "errors.titles.paymentUpdate";
    static readonly TITLE_STOCK_UPDATE = "errors.titles.stockUpdate";
    static readonly TITLE_OOPS = "errors.titles.oops";
    static readonly TITLE_CONNECTION_ISSUE = "errors.titles.connectionIssue";
    static readonly UNEXPECTED_ERROR_BOUNDARY = "errors.system.unexpectedErrorBoundary";
}
