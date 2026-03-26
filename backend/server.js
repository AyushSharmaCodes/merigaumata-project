// Validate environment variables BEFORE anything else
require('dotenv').config();
const { validateEnvironment } = require('./utils/env-validator');
validateEnvironment(); // Will throw and prevent server startup if critical vars are missing

const newrelic = process.env.NEW_RELIC_ENABLED !== 'false' ? require('newrelic') : null;
const express = require('express');
// Trigger restart for bootstrap verification
const cors = require('cors');
const cookieParser = require('cookie-parser');
const logger = require('./utils/logger');
const pinoHttp = require('pino-http');
const crypto = require('crypto');
const pino = require('pino');
const { SYSTEM, LOGS } = require('./constants/messages');


// Routes
const authRoutes = require('./routes/auth.routes');
const productRoutes = require('./routes/product.routes');
const orderRoutes = require('./routes/order.routes');
const categoryRoutes = require('./routes/category.routes');
const uploadRoutes = require('./routes/upload.routes');
const eventRoutes = require('./routes/event.routes');
const blogRoutes = require('./routes/blog.routes');
const testimonialRoutes = require('./routes/testimonial.routes');
const galleryFolderRoutes = require('./routes/gallery-folder.routes');
const galleryRoutes = require('./routes/gallery-item.routes');
const galleryVideoRoutes = require('./routes/gallery-video.routes');
const carouselRoutes = require('./routes/carousel.routes');
const faqRoutes = require('./routes/faq.routes');
const socialMediaRoutes = require('./routes/social-media.routes');
const contactInfoRoutes = require('./routes/contact-info.routes');
const bankDetailsRoutes = require('./routes/bank-details.routes');
const newsletterRoutes = require('./routes/newsletter.routes');
const managerRoutes = require('./routes/manager.routes');
const contactRoutes = require('./routes/contact.routes');
const adminEventRoutes = require('./routes/admin-event.routes');
const adminAlertRoutes = require('./routes/admin-alert.routes');
const reviewRoutes = require('./routes/review.routes');
const commentRoutes = require('./routes/comments.routes');
const userRoutes = require('./routes/user.routes');
const profileRoutes = require('./routes/profile.routes');
const addressRoutes = require('./routes/address.routes');
const aboutRoutes = require('./routes/about.routes');
const couponRoutes = require('./routes/coupon.routes');
const cartRoutes = require('./routes/cart.routes');
const checkoutRoutes = require('./routes/checkout.routes');
const adminNotificationRoutes = require('./routes/admin-notification.routes');
const geoRoutes = require('./routes/geo.routes');
const razorpayRoutes = require('./routes/razorpay.routes');
const eventRegistrationRoutes = require('./routes/event-registration.routes');
const donationRoutes = require('./routes/donation.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const returnRoutes = require('./routes/return.routes');
const emailRoutes = require('./routes/email.routes');
const settingsRoutes = require('./routes/settings.routes');
const policyRoutes = require('./routes/policy.routes');
const accountDeletionRoutes = require('./routes/account-deletion.routes');
const jobsRoutes = require('./routes/jobs.routes');
const productVariantRoutes = require('./routes/product-variant.routes');
const webhookRoutes = require('./routes/webhook.routes');
const invoiceRoutes = require('./routes/invoice.routes');
const cronRoutes = require('./routes/cron.routes');
const deliveryConfigsRoutes = require('./routes/delivery-configs.routes');
const customInvoiceRoutes = require('./routes/custom-invoice.routes');
const translationRoutes = require('./routes/translation.routes');
const realtimeRoutes = require('./routes/realtime.routes');
const publicRoutes = require('./routes/public.routes');
const { authenticateToken, requireRole } = require('./middleware/auth.middleware');

// Middleware
const { tracingMiddleware } = require('./middleware/tracing.middleware');
const friendlyErrorInterceptor = require('./middleware/friendly-error.middleware');
const { i18nMiddleware } = require('./middleware/i18n.middleware');
const errorMiddleware = require('./middleware/error.middleware');

// Libraries & Services
const { bootstrapAdmin, getBootstrapStatus } = require('./lib/bootstrap');
const { SupabaseLogger } = require('./services/supabase-logger');
const { initScheduler, stopScheduler } = require('./lib/scheduler');
const ReservationCleanupService = require('./services/reservation-cleanup.service');
const { getHealthSnapshot, getReadinessSnapshot } = require('./services/health.service');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 5001;
const ENABLE_INTERNAL_SCHEDULER = process.env.ENABLE_INTERNAL_SCHEDULER !== 'false';
const ENABLE_RESERVATION_CLEANUP = process.env.ENABLE_RESERVATION_CLEANUP !== 'false';
const JSON_BODY_LIMIT = process.env.JSON_BODY_LIMIT || '2mb';
const URLENCODED_BODY_LIMIT = process.env.URLENCODED_BODY_LIMIT || '1mb';

function parseTrustProxy(value) {
    if (value === undefined || value === null || value === '') {
        return false;
    }

    const normalizedValue = String(value).trim().toLowerCase();

    if (['false', '0', 'off', 'no'].includes(normalizedValue)) {
        return false;
    }

    if (['true', '1', 'on', 'yes'].includes(normalizedValue)) {
        return true;
    }

    const numericValue = Number(normalizedValue);
    if (!Number.isNaN(numericValue) && Number.isInteger(numericValue)) {
        return numericValue;
    }

    return value;
}

function getTrustProxySetting() {
    if (process.env.TRUST_PROXY !== undefined && process.env.TRUST_PROXY !== '') {
        return parseTrustProxy(process.env.TRUST_PROXY);
    }

    // Default to one trusted proxy hop in production so client IP and HTTPS
    // detection work correctly behind a standard load balancer or reverse proxy.
    if (process.env.NODE_ENV === 'production') {
        return 1;
    }

    return false;
}

function normalizeOrigin(origin) {
    try {
        return new URL(origin).origin;
    } catch {
        return null;
    }
}

const TRUST_PROXY = getTrustProxySetting();
app.set('trust proxy', TRUST_PROXY);

// Middleware
app.use((req, res, next) => {
    logger.debug({ method: req.method, url: req.url }, LOGS.INCOMING_REQUEST);
    next();
});
app.use(cors({
    origin: function (origin, callback) {
        // Get allowed origins from environment variable
        // Format: ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
        const allowedOrigins = process.env.ALLOWED_ORIGINS
            ? process.env.ALLOWED_ORIGINS
                .split(',')
                .map(url => normalizeOrigin(url.trim()))
                .filter(Boolean)
            : [];

        if (allowedOrigins.length === 0) {
            logger.warn({ msg: SYSTEM.ALLOWED_ORIGINS_NOT_SET }, 'ALLOWED_ORIGINS environment variable not set. CORS will block all cross-origin requests.');
        }

        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        const normalizedOrigin = normalizeOrigin(origin);

        if (normalizedOrigin && allowedOrigins.includes(normalizedOrigin)) {
            callback(null, true);
        } else {
            logger.warn({ origin, normalizedOrigin }, LOGS.CORS_BLOCKED);
            callback(new Error(SYSTEM.CORS_ERROR));
        }

    },
    credentials: true, // Allow cookies
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'x-guest-id', 'X-Correlation-ID', 'X-Idempotency-Key', 'x-rtb-fingerprint-id', 'x-user-lang', 'x-user-currency', 'x-span-id', 'x-trace-id'],
    exposedHeaders: ['x-rtb-fingerprint-id', 'Content-Disposition']
}));
app.use(cookieParser()); // Parse cookies
app.use(i18nMiddleware);
// Increase payload size limit to handle images (base64 encoded)

// Request Logging (Pino) - Log every request
app.use(pinoHttp({
    logger: logger.pino,
    // Define custom serializers or configuration if needed
    customLogLevel: function (req, res, err) {
        if (res.statusCode >= 400 && res.statusCode < 500) {
            return 'warn';
        } else if (res.statusCode >= 500 || err) {
            return 'error';
        }
        return 'info';
    },
    // Redact sensitive headers
    serializers: {
        req: (req) => {
            if (req.headers) {
                req.headers['authorization'] = '[REDACTED]';
                req.headers['cookie'] = '[REDACTED]';
            }
            return req;
        }
    },
    // Quieter logging for health checks
    autoLogging: {
        ignore: (req) => req.url === '/api/health'
    }
}));

// Apply tracing middleware - generates/extracts traceId, spanId, correlationId
app.use(tracingMiddleware);
app.use(friendlyErrorInterceptor);

app.use(express.json({ limit: JSON_BODY_LIMIT }));
app.use(express.urlencoded({ limit: URLENCODED_BODY_LIMIT, extended: true }));

// Routes
const logRoutes = require('./routes/log.routes');
app.use('/api/logs', logRoutes);

app.use((req, res, next) => {
    if (newrelic) {
        newrelic.addCustomAttribute('traceId', req.traceId);
        newrelic.addCustomAttribute('spanId', req.spanId);
        newrelic.addCustomAttribute('correlationId', req.correlationId);

        // Add User ID from header if present
        const userIdHeader = req.user?.id || req.headers['x-user-id'] || req.headers['X-User-ID'];
        if (userIdHeader) {
            newrelic.addCustomAttribute('userId', userIdHeader);
        }
    }
    next();
});

// Routes
app.get('/api/health/live', (req, res) => {
    res.json({
        status: 'ok',
        message: SYSTEM.HEALTH_CHECK_OK,
        timestamp: new Date().toISOString()
    });
});

app.get('/api/health', async (req, res) => {
    const snapshot = await getHealthSnapshot();
    res.status(snapshot.status === 'ok' ? 200 : 503).json(snapshot);
});

app.get('/api/health/ready', async (req, res) => {
    const snapshot = await getReadinessSnapshot();
    res.status(snapshot.ready ? 200 : 503).json(snapshot);
});

app.get('/api/health/bootstrap', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
        const status = await getBootstrapStatus();
        res.json({
            success: true,
            bootstrap: status
        });
    } catch (error) {
        logger.error({ err: error, req }, '[Health] Failed to fetch bootstrap status');
        res.status(500).json({
            success: false,
            error: SYSTEM.INTERNAL_ERROR
        });
    }
});


app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/testimonials', testimonialRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/gallery-items', galleryRoutes);
app.use('/api/gallery-folders', galleryFolderRoutes);
app.use('/api/gallery-videos', galleryVideoRoutes);
app.use('/api/carousel-slides', carouselRoutes);
app.use('/api/faqs', faqRoutes);
app.use('/api/social-media', socialMediaRoutes);
app.use('/api/contact-info', contactInfoRoutes);
app.use('/api/bank-details', bankDetailsRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/managers', managerRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/admin/events', adminEventRoutes);
app.use('/api/admin/alerts', adminAlertRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/about', aboutRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/checkout', checkoutRoutes);
app.use('/api/admin/notifications', adminNotificationRoutes);
app.use('/api/geo', geoRoutes);
app.use('/api/razorpay', razorpayRoutes);
app.use('/api/event-registrations', eventRegistrationRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/returns', returnRoutes);
// Compatibility alias: browser was observed calling /api/return-requests/item-status
// Mounting returnRoutes here so /api/return-requests/* resolves to the same handlers as /api/returns/*
// The /item-status flat route inside returnRoutes handles the exact observed call.
app.use('/api/return-requests', returnRoutes);

app.use('/api/email', emailRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/policies', policyRoutes);
app.use('/api/account/delete', accountDeletionRoutes);
app.use('/api/admin/jobs', jobsRoutes);
app.use('/api', productVariantRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/cron', cronRoutes);
app.use('/api/admin/delivery-configs', deliveryConfigsRoutes);
app.use('/api/custom-invoices', customInvoiceRoutes);
app.use('/api/translate', translationRoutes);
app.use('/api/realtime', realtimeRoutes);
app.use('/api/public', publicRoutes);

// Global Error Handler (Must be last)
app.use(errorMiddleware);


let server;

function startServer(port, attempt = 0) {
    const maxAttempts = 10;
    const numericPort = Number(port);
    const host = process.env.HOST || '0.0.0.0';
    server = app.listen(numericPort, () => {
        logger.info({ context: { port: numericPort, host }, module: 'Server', operation: 'START' }, LOGS.SERVER_RUNNING);
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            if (attempt >= maxAttempts) {
                logger.error(LOGS.PORT_RETRY);
                process.exit(1);
            }
            const fallbackPort = numericPort + 1;
            logger.warn({ context: { port: numericPort, fallback: fallbackPort } }, LOGS.PORT_IN_USE);
            startServer(fallbackPort, attempt + 1);

        } else {
            logger.error({ err }, LOGS.SERVER_ERROR);
        }
    });
    return server;
}

async function initializeAndStart() {
    try {
        logger.info({ module: 'Server', operation: 'INIT' }, LOGS.DB_CONNECTION_VERIFIED);
        // await SupabaseLogger.checkConnection();
        logger.info({ module: 'Server', operation: 'INIT' }, LOGS.DB_CONNECTION_VERIFIED);
        logger.info({
            module: 'Server',
            operation: 'OBSERVABILITY',
            context: {
                newRelicEnabled: process.env.NEW_RELIC_ENABLED !== 'false',
                newRelicLoaded: Boolean(newrelic),
                newRelicAppName: process.env.NEW_RELIC_APP_NAME || null,
                newRelicHost: process.env.NEW_RELIC_HOST || 'collector.newrelic.com',
                logProvider: process.env.LOG_PROVIDER || 'file'
            }
        }, 'Observability configuration evaluated');


        await bootstrapAdmin();

        if (ENABLE_INTERNAL_SCHEDULER) {
            initScheduler();
        } else {
            logger.info({ module: 'Server', operation: 'INIT' }, 'Internal scheduler disabled for this instance');
        }

        if (ENABLE_RESERVATION_CLEANUP) {
            ReservationCleanupService.init();
        } else {
            logger.info({ module: 'Server', operation: 'INIT' }, 'Reservation cleanup disabled for this instance');
        }

        startServer(PORT);

        // Graceful Shutdown Logic
        const shutdown = (signal) => {
            logger.info({ context: { signal }, module: 'Server', operation: 'SHUTDOWN' }, LOGS.SHUTTING_DOWN);


            if (server) {
                // Stop scheduled jobs first when enabled for this instance
                if (ENABLE_INTERNAL_SCHEDULER) {
                    stopScheduler();
                }

                if (ENABLE_RESERVATION_CLEANUP) {
                    ReservationCleanupService.stop();
                }

                server.close(() => {
                    logger.info({ module: 'Server', operation: 'SHUTDOWN' }, LOGS.HTTP_CLOSED);
                    // Close other resources if any (e.g. database pools, redis) here

                    process.exit(0);
                });

                // Force exit if closing takes too long
                setTimeout(() => {
                    logger.error({ module: 'Server', operation: 'SHUTDOWN' }, LOGS.FORCE_SHUTDOWN);
                    process.exit(1);
                }, 10000);

            } else {
                process.exit(0);
            }
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));

        // Process-level crash listeners
        process.on('unhandledRejection', (reason, promise) => {
            logger.fatal({
                module: 'Server',
                operation: 'CRASH_PREVENTION',
                err: reason,
                context: { promise }
            }, 'Unhandled Rejection at Promise');
            // Trace context might not be available here, but logger.fatal uses the base logger.
        });

        process.on('uncaughtException', (error) => {
            logger.fatal({
                module: 'Server',
                operation: 'CRASH_PREVENTION',
                err: error
            }, 'Uncaught Exception thrown');

            // For uncaught exceptions, we should probably shutdown because the process state might be corrupted
            shutdown('UNCAUGHT_EXCEPTION');
        });

    } catch (error) {
        logger.fatal({ err: error }, LOGS.INIT_FAILED);
        process.exit(1);
    }
}

initializeAndStart();
