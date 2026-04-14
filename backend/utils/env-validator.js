const logger = require('./logger');

/**
 * Required Environment Variables
 * These are critical for the application to function securely.
 * Note: Many operational toggles are now moved to the `system_switches` database table,
 * but their .env counterparts serve as essential fallbacks during startup or DB failure.
 */
const REQUIRED_ENV_VARS = [
    'JWT_SECRET',
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'FRONTEND_URL',
    'NODE_ENV'
];

/**
 * Optional but recommended environment variables.
 * These act as fallbacks for dynamic settings in the `system_switches` DB table.
 */
const RECOMMENDED_ENV_VARS = [
    'ALLOWED_ORIGINS',
    'PORT',
    'DATABASE_URL'
];

const PRODUCTION_RECOMMENDED_ENV_VARS = [
    'BACKEND_URL',
    'CRON_SECRET',
    'RAZORPAY_KEY_ID',
    'RAZORPAY_KEY_SECRET',
    'RAZORPAY_WEBHOOK_SECRET',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_REDIRECT_URI',
    'TRUST_PROXY'
];

/**
 * Validates that all required environment variables are set
 * @throws {Error} If any required variable is missing
 */
function validateEnvironment() {
    const missing = [];
    const warnings = [];

    // Check required variables
    for (const varName of REQUIRED_ENV_VARS) {
        if (!process.env[varName]) {
            missing.push(varName);
        }
    }

    // Check recommended variables
    for (const varName of RECOMMENDED_ENV_VARS) {
        if (!process.env[varName]) {
            warnings.push(varName);
        }
    }

    // Log warnings for recommended variables
    if (warnings.length > 0) {
        logger.warn({
            module: 'EnvValidator',
            operation: 'VALIDATE',
            context: { missingRecommended: warnings }
        }, `Recommended environment variables not set: ${warnings.join(', ')}`);
    }

    if (process.env.NODE_ENV === 'production') {
        const missingProductionRecommended = PRODUCTION_RECOMMENDED_ENV_VARS.filter(varName => !process.env[varName]);
        if (missingProductionRecommended.length > 0) {
            logger.warn({
                module: 'EnvValidator',
                operation: 'VALIDATE',
                context: { missingProductionRecommended }
            }, `Production-recommended environment variables not set: ${missingProductionRecommended.join(', ')}`);
        }
    }

    const newRelicEnabled = process.env.NEW_RELIC_ENABLED !== 'false';
    if (newRelicEnabled) {
        const missingNewRelicVars = ['NEW_RELIC_LICENSE_KEY', 'NEW_RELIC_APP_NAME']
            .filter(varName => !process.env[varName]);

        if (missingNewRelicVars.length > 0) {
            logger.warn({
                module: 'EnvValidator',
                operation: 'VALIDATE',
                context: { missingNewRelicVars }
            }, `New Relic is enabled but missing config: ${missingNewRelicVars.join(', ')}`);
        }
    }

    // Throw error for missing required variables
    if (missing.length > 0) {
        const errorMessage = `CRITICAL: Missing required environment variables: ${missing.join(', ')}. ` +
            `Please ensure these are set in your .env file or environment configuration.`;

        logger.fatal({
            module: 'EnvValidator',
            operation: 'VALIDATE',
            context: { missingRequired: missing }
        }, errorMessage);

        throw new Error(errorMessage);
    }

    // Validate JWT_SECRET length (should be at least 32 characters for security)
    if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
        logger.warn({
            module: 'EnvValidator',
            operation: 'VALIDATE',
            context: { length: process.env.JWT_SECRET.length }
        }, 'JWT_SECRET should be at least 32 characters for adequate security');
    }

    logger.info({
        module: 'EnvValidator',
        operation: 'VALIDATE',
        context: {
            newRelicEnabled: process.env.NEW_RELIC_ENABLED !== 'false',
            newRelicConfigured: Boolean(process.env.NEW_RELIC_LICENSE_KEY && process.env.NEW_RELIC_APP_NAME)
        }
    }, 'All required environment variables validated successfully');
}

module.exports = {
    validateEnvironment,
    REQUIRED_ENV_VARS,
    RECOMMENDED_ENV_VARS
};
