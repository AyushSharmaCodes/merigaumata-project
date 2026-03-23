class SystemMessages {
    static INTERNAL_ERROR = 'errors.system.internalError';
    static VALIDATION_ERROR = 'errors.system.validationError';
    static NETWORK_ERROR = 'errors.system.networkError';
    static CORS_ERROR = 'errors.system.corsError';
    static UNHANDLED_EXCEPTION = 'errors.system.unhandledException';
    static RATE_LIMIT_ERROR = 'errors.system.rateLimitError';

    // Success / API Responses
    static SERVER_RUNNING = 'success.system.serverRunning';
    static SHUTTING_DOWN = 'success.system.shuttingDown';
    static HEALTH_CHECK_OK = 'success.system.healthCheckOk';

    // Logs
    static ALLOWED_ORIGINS_NOT_SET = 'logs.system.allowedOriginsNotSet';
    static STACK_TRACE_LEAK = 'logs.system.stackTraceLeak';
    static TECHNICAL_ERROR_INTERCEPTED = 'logs.system.technicalErrorIntercepted';

    // Environment / Setup
    static ENV_VAR_REQUIRED = 'errors.system.envVarRequired';
    static FRONTEND_URL_REQUIRED = 'errors.system.frontendUrlRequired';

    // Files & Parsing
    static UNSUPPORTED_FILE_TYPE = 'errors.system.unsupportedFileType';
    static PARSE_ERROR = 'errors.system.parseError';
    static UPLOAD_STORAGE_FAIL = 'errors.system.uploadStorageFail';
    static DATABASE_SAVE_FAIL = 'errors.system.databaseSaveFail';
    static AUTO_RETRY_REASON = 'Auto-retry: Previous pending registration cancelled';
}

module.exports = SystemMessages;
