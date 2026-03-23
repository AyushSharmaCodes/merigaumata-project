'use strict'

// Load environment variables before New Relic reads them
require('dotenv').config();

/**
 * New Relic agent configuration.
 *
 * See lib/config/default.js in the agent distribution for a more complete
 * description of configuration variables and their potential values.
 */
exports.config = {
    /**
     * Array of application names.
     */
    app_name: [process.env.NEW_RELIC_APP_NAME || 'ecommerce-backend'],

    /**
     * Your New Relic license key.
     */
    license_key: process.env.NEW_RELIC_LICENSE_KEY,

    /**
     * Host for New Relic collector (use 'collector.eu.newrelic.com' for EU accounts)
     */
    host: process.env.NEW_RELIC_HOST || 'collector.newrelic.com',

    /**
     * Agent logging configuration
     */
    logging: {
        level: process.env.NEW_RELIC_LOG_LEVEL || 'info',
        filepath: 'stdout', // Send logs to stdout for containerized apps
        enabled: true
    },

    /**
     * Application logging with New Relic log forwarding
     */
    application_logging: {
        enabled: true,
        forwarding: {
            enabled: true,
            max_samples_stored: 10000
        },
        metrics: {
            enabled: true
        },
        local_decorating: {
            enabled: true // Adds New Relic metadata to logs
        }
    },

    /**
     * Distributed tracing for end-to-end request tracking
     */
    distributed_tracing: {
        enabled: true
    },

    /**
     * Transaction tracer configuration
     */
    transaction_tracer: {
        enabled: true,
        transaction_threshold: 'apdex_f',
        record_sql: 'obfuscated', // Record SQL queries (obfuscated for security)
        explain_threshold: 500 // Explain queries slower than 500ms
    },

    /**
     * Error collector configuration
     */
    error_collector: {
        enabled: true,
        ignore_status_codes: [404], // Don't report 404s as errors
        capture_events: true,
        max_event_samples_stored: 100
    },

    /**
     * Request header capture
     */
    allow_all_headers: true,

    /**
     * Custom attributes configuration
     */
    attributes: {
        enabled: true,
        include: [
            'request.headers.userAgent',
            'request.headers.referer',
            'request.method',
            'request.uri'
        ],
        exclude: [
            'request.headers.cookie',
            'request.headers.authorization',
            'request.headers.proxyAuthorization',
            'request.headers.setCookie*',
            'request.headers.x*',
            'response.headers.cookie',
            'response.headers.authorization',
            'response.headers.proxyAuthorization',
            'response.headers.setCookie*',
            'response.headers.x*'
        ]
    },

    /**
     * Slow SQL query tracking
     */
    slow_sql: {
        enabled: true
    },

    /**
     * Custom instrumentation API
     */
    api: {
        custom_events_enabled: true,
        custom_parameters_enabled: true
    }
}
