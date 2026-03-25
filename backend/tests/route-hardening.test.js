jest.mock('../middleware/auth.middleware', () => ({
    authenticateToken: function authenticateToken(req, res, next) { next(); },
    optionalAuth: function optionalAuth(req, res, next) { next(); },
    requireAuth: function requireAuth(req, res, next) { next(); },
    requireRole: jest.fn(() => function requireRoleMiddleware(req, res, next) { next(); }),
    checkPermission: jest.fn(() => function checkPermissionMiddleware(req, res, next) { next(); })
}));

jest.mock('../middleware/requestLock.middleware', () => ({
    requestLock: jest.fn(() => function requestLockMiddleware(req, res, next) { next(); })
}));

jest.mock('../middleware/idempotency.middleware', () => ({
    idempotency: jest.fn(() => function idempotencyMiddleware(req, res, next) { next(); })
}));

jest.mock('../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
}));

jest.mock('../config/supabase', () => ({
    from: jest.fn(),
    rpc: jest.fn(),
    supabase: {
        from: jest.fn(),
        storage: {
            from: jest.fn(() => ({
                getPublicUrl: jest.fn(() => ({ data: { publicUrl: '' } }))
            }))
        }
    },
    supabaseAdmin: {
        from: jest.fn(),
        storage: {
            from: jest.fn(() => ({
                upload: jest.fn(),
                remove: jest.fn(),
                getPublicUrl: jest.fn(() => ({ data: { publicUrl: '' } })),
                createSignedUrl: jest.fn(() => ({ data: { signedUrl: '' }, error: null }))
            }))
        }
    }
}));
jest.mock('../lib/supabase', () => ({
    supabase: {
        from: jest.fn(),
        storage: {
            from: jest.fn(() => ({
                upload: jest.fn(),
                getPublicUrl: jest.fn(() => ({ data: { publicUrl: '' } })),
                remove: jest.fn()
            }))
        }
    }
}));

jest.mock('../services/donation.service', () => ({
    createOneTimeOrder: jest.fn(),
    createSubscription: jest.fn(),
    verifyPayment: jest.fn(),
    processWebhook: jest.fn(),
    createQRCode: jest.fn(),
    getUserSubscriptions: jest.fn(),
    cancelSubscription: jest.fn(),
    pauseSubscription: jest.fn(),
    resumeSubscription: jest.fn()
}));

jest.mock('../services/event-registration.service', () => ({
    createRegistrationOrder: jest.fn(),
    verifyPayment: jest.fn(),
    getUserRegistrations: jest.fn(),
    getRegistrationById: jest.fn(),
    cancelRegistration: jest.fn()
}));

jest.mock('../services/deletion-job-processor', () => ({
    DeletionJobProcessor: {
        processJob: jest.fn()
    }
}));

jest.mock('../services/event-cancellation.service', () => ({
    processJob: jest.fn()
}));

jest.mock('../services/refund.service', () => ({
    RefundService: {
        normalizeRefundStatus: jest.fn((status) => status),
        retryRefund: jest.fn(),
        executeRefund: jest.fn()
    }
}));

jest.mock('../services/account-deletion.service', () => ({
    checkEligibility: jest.fn(),
    getDeletionStatus: jest.fn(),
    requestDeletionOTP: jest.fn(),
    verifyDeletionOTP: jest.fn(),
    confirmImmediateDeletion: jest.fn(),
    scheduleDeletion: jest.fn(),
    cancelScheduledDeletion: jest.fn()
}));

jest.mock('../services/reconciliation.service', () => ({
    runReconciliation: jest.fn()
}));

jest.mock('../services/event.service', () => ({}));
jest.mock('../services/email', () => ({
    sendEventRegistrationEmail: jest.fn(),
    sendEventCancellationEmail: jest.fn(),
    sendEventUpdateEmail: jest.fn(),
    send: jest.fn(),
    provider: {
        name: 'mock-provider',
        isConfigured: jest.fn(() => true),
        send: jest.fn()
    }
}));
jest.mock('../services/invoice-orchestrator.service', () => ({
    InvoiceOrchestrator: {
        generateInternalInvoice: jest.fn()
    }
}));
jest.mock('../services/address.service', () => ({
    getUserAddresses: jest.fn(),
    setPrimaryAddress: jest.fn(),
    formatAddress: jest.fn((value) => value),
    createAddress: jest.fn(),
    updateAddress: jest.fn()
}));
jest.mock('../services/product.service', () => ({
    getAllProducts: jest.fn(),
    exportAllProducts: jest.fn(),
    getProductById: jest.fn(),
    createProduct: jest.fn(),
    updateProduct: jest.fn(),
    deleteProduct: jest.fn()
}));
jest.mock('../services/photo.service', () => ({
    deletePhotoByUrl: jest.fn(),
    deletePhotosByUrls: jest.fn()
}));
jest.mock('../services/custom-auth.service', () => ({
    generateRandomPassword: jest.fn(),
    upsertLocalAccount: jest.fn(),
    deleteAuthArtifacts: jest.fn()
}));
jest.mock('../services/settings.service', () => ({
    getDeliverySettings: jest.fn(),
    updateDeliverySettings: jest.fn(),
    getCurrencySettings: jest.fn(),
    updateCurrencySettings: jest.fn()
}));
jest.mock('../services/currency-exchange.service', () => ({
    CurrencyExchangeService: {
        getCurrencyContext: jest.fn()
    }
}));
jest.mock('../controllers/contact.controller', () => ({
    submitContactForm: jest.fn((req, res) => res?.json?.({ ok: true })),
    getMessages: jest.fn((req, res) => res?.json?.([])),
    getMessageDetail: jest.fn((req, res) => res?.json?.({})),
    updateMessageStatus: jest.fn((req, res) => res?.json?.({ ok: true }))
}));
jest.mock('../controllers/policy.controller', () => ({
    uploadPolicy: jest.fn((req, res) => res?.json?.({ ok: true })),
    getAllLanguageVersions: jest.fn((req, res) => res?.json?.([])),
    getPolicyVersion: jest.fn((req, res) => res?.json?.({})),
    getPublicPolicy: jest.fn((req, res) => res?.json?.({}))
}));
jest.mock('../services/coupon.service', () => ({
    getActiveCoupons: jest.fn(),
    invalidateCouponCache: jest.fn()
}));
jest.mock('../services/product-variant.service', () => ({
    getVariantsByProductId: jest.fn(),
    createVariant: jest.fn(),
    getVariantById: jest.fn(),
    updateVariant: jest.fn(),
    deleteVariant: jest.fn(),
    setDefaultVariant: jest.fn(),
    createProductWithVariants: jest.fn(),
    updateProductWithVariants: jest.fn()
}));
jest.mock('../services/admin-alert.service', () => ({
    getUnreadAlerts: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
    markAsReadByReference: jest.fn()
}));
jest.mock('../services/review.service', () => ({
    getProductReviews: jest.fn(),
    getAllReviews: jest.fn(),
    createReview: jest.fn(),
    deleteReview: jest.fn()
}));
jest.mock('../services/comment.service', () => ({
    getComments: jest.fn(),
    createComment: jest.fn(),
    updateComment: jest.fn(),
    deleteComment: jest.fn(),
    flagComment: jest.fn()
}));
jest.mock('../services/moderation.service', () => ({
    getFlaggedComments: jest.fn(),
    approveComment: jest.fn(),
    hideComment: jest.fn(),
    restoreComment: jest.fn(),
    deleteCommentPermanently: jest.fn(),
    getModerationHistory: jest.fn()
}));
jest.mock('../services/custom-invoice.service', () => ({
    generateCustomInvoice: jest.fn()
}));
jest.mock('../services/auth.service', () => ({
    sendGoogleUserVerificationEmail: jest.fn(),
    authenticateGoogleUser: jest.fn(),
    checkEmailExists: jest.fn(),
    syncSession: jest.fn(),
    validateCredentials: jest.fn(),
    resendConfirmationEmail: jest.fn(),
    registerUser: jest.fn(),
    verifyEmail: jest.fn(),
    verifyLoginOtp: jest.fn(),
    refreshToken: jest.fn(),
    getUserProfile: jest.fn(),
    logout: jest.fn(),
    sendChangePasswordOTP: jest.fn(),
    changePassword: jest.fn(),
    requestPasswordReset: jest.fn(),
    validateResetToken: jest.fn(),
    resetPassword: jest.fn()
}));
jest.mock('../services/translation.service', () => ({
    translateProfileResult: jest.fn(),
    translateText: jest.fn()
}));
jest.mock('../utils/phone-validator', () => ({
    validate: jest.fn()
}));
jest.mock('../services/google-oauth.service', () => ({
    createAuthorizationRequest: jest.fn(),
    exchangeCode: jest.fn()
}));
jest.mock('@supabase/supabase-js', () => ({
    createClient: jest.fn()
}));
jest.mock('../services/cart.service', () => ({
    getUserCart: jest.fn(),
    addToCart: jest.fn(),
    updateCartItem: jest.fn(),
    removeFromCart: jest.fn(),
    applyCouponToCart: jest.fn(),
    removeCouponFromCart: jest.fn(),
    calculateCartTotals: jest.fn(),
    clearCart: jest.fn()
}));
jest.mock('../middleware/rateLimit.middleware', () => ({
    checkCommentRateLimit: function checkCommentRateLimit(req, res, next) { next(); },
    uploadWriteRateLimit: function uploadWriteRateLimit(req, res, next) { next(); },
    authRateLimit: function authRateLimit(req, res, next) { next(); },
    authSessionRateLimit: function authSessionRateLimit(req, res, next) { next(); }
}));
jest.mock('../middleware/validation.middleware', () => ({
    validateCommentInput: function validateCommentInput(req, res, next) { next(); },
    validateFlagInput: function validateFlagInput(req, res, next) { next(); }
}));
jest.mock('../middleware/adminOnly.middleware', () => ({
    requireAdminOrManager: function requireAdminOrManager(req, res, next) { next(); }
}));
jest.mock('uuid', () => ({
    v4: jest.fn(() => 'test-uuid')
}));

describe('Route hardening middleware wiring', () => {
    test('donation subscription mutations are protected by request lock and idempotency', () => {
        const donationRoutes = require('../routes/donation.routes');

        const cancelRoute = donationRoutes.stack.find((layer) => layer.route?.path === '/cancel-subscription');
        const pauseRoute = donationRoutes.stack.find((layer) => layer.route?.path === '/pause-subscription');
        const resumeRoute = donationRoutes.stack.find((layer) => layer.route?.path === '/resume-subscription');

        expect(cancelRoute.route.stack.map((layer) => layer.name)).toEqual(
            expect.arrayContaining(['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'])
        );
        expect(pauseRoute.route.stack.map((layer) => layer.name)).toEqual(
            expect.arrayContaining(['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'])
        );
        expect(resumeRoute.route.stack.map((layer) => layer.name)).toEqual(
            expect.arrayContaining(['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'])
        );
    });

    test('admin job retry and process routes are protected by request lock and idempotency', () => {
        const jobsRoutes = require('../routes/jobs.routes');

        const retryRoute = jobsRoutes.stack.find((layer) => layer.route?.path === '/:id/retry');
        const processRoute = jobsRoutes.stack.find((layer) => layer.route?.path === '/:id/process');

        expect(retryRoute.route.stack.map((layer) => layer.name)).toEqual(
            expect.arrayContaining(['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'])
        );
        expect(processRoute.route.stack.map((layer) => layer.name)).toEqual(
            expect.arrayContaining(['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'])
        );
    });

    test('event registration cancel route is protected by request lock and idempotency', () => {
        const eventRegistrationRoutes = require('../routes/event-registration.routes');
        const cancelRoute = eventRegistrationRoutes.stack.find((layer) => layer.route?.path === '/cancel');

        expect(cancelRoute.route.stack.map((layer) => layer.name)).toEqual(
            expect.arrayContaining(['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'])
        );
    });

    test('account deletion mutations are protected by request lock and idempotency', () => {
        const accountDeletionRoutes = require('../routes/account-deletion.routes');
        const protectedPaths = [
            '/request-otp',
            '/verify-otp',
            '/confirm',
            '/schedule',
            '/cancel',
            '/admin/process-pending'
        ];

        protectedPaths.forEach((path) => {
            const route = accountDeletionRoutes.stack.find((layer) => layer.route?.path === path);
            expect(route.route.stack.map((layer) => layer.name)).toEqual(
                expect.arrayContaining(['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'])
            );
        });
    });

    test('admin event mutations are protected by request lock and idempotency', () => {
        const adminEventRoutes = require('../routes/admin-event.routes');
        const protectedPaths = [
            '/:id/cancel',
            '/:id/update-schedule',
            '/reconciliation/run',
            '/:id/retry-cancellation'
        ];

        protectedPaths.forEach((path) => {
            const route = adminEventRoutes.stack.find((layer) => layer.route?.path === path);
            expect(route.route.stack.map((layer) => layer.name)).toEqual(
                expect.arrayContaining(['requestLockMiddleware', 'idempotencyMiddleware'])
            );
        });
    });

    test('invoice retry and address mutations are protected by request lock and idempotency where applicable', () => {
        const invoiceRoutes = require('../routes/invoice.routes');
        const addressRoutes = require('../routes/address.routes');

        const invoiceRetryRoute = invoiceRoutes.stack.find((layer) => layer.route?.path === '/orders/:id/retry');
        expect(invoiceRetryRoute.route.stack.map((layer) => layer.name)).toEqual(
            expect.arrayContaining(['requireAuth', 'requestLockMiddleware', 'idempotencyMiddleware'])
        );

        ['/', '/:id', '/:id/set-primary'].forEach((path) => {
            const methods = path === '/' ? ['post'] : path === '/:id' ? ['put'] : ['post'];
            methods.forEach((method) => {
                const route = addressRoutes.stack.find((layer) => layer.route?.path === path && layer.route.methods[method]);
                expect(route.route.stack.map((layer) => layer.name)).toEqual(
                    expect.arrayContaining(['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'])
                );
            });
        });
    });

    test('product, category, blog, and social media admin mutations are protected by request lock and idempotency where applicable', () => {
        const productRoutes = require('../routes/product.routes');
        const categoryRoutes = require('../routes/category.routes');
        const blogRoutes = require('../routes/blog.routes');
        const socialMediaRoutes = require('../routes/social-media.routes');

        [
            { router: productRoutes, path: '/', method: 'post', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: productRoutes, path: '/:id', method: 'put', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: productRoutes, path: '/:id', method: 'delete', required: ['authenticateToken', 'requestLockMiddleware'] },
            { router: categoryRoutes, path: '/', method: 'post', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: categoryRoutes, path: '/:id', method: 'put', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: categoryRoutes, path: '/:id', method: 'delete', required: ['authenticateToken', 'requestLockMiddleware'] },
            { router: blogRoutes, path: '/', method: 'post', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: blogRoutes, path: '/:id', method: 'put', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: blogRoutes, path: '/:id', method: 'delete', required: ['authenticateToken', 'requestLockMiddleware'] },
            { router: socialMediaRoutes, path: '/', method: 'post', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: socialMediaRoutes, path: '/:id', method: 'put', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: socialMediaRoutes, path: '/:id', method: 'delete', required: ['authenticateToken', 'requestLockMiddleware'] },
            { router: socialMediaRoutes, path: '/reorder/bulk', method: 'put', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] }
        ].forEach(({ router, path, method, required }) => {
            const route = router.stack.find((layer) => layer.route?.path === path && layer.route.methods[method]);
            expect(route.route.stack.map((layer) => layer.name)).toEqual(
                expect.arrayContaining(required)
            );
        });
    });

    test('carousel and gallery admin mutations are protected by request lock and idempotency where applicable', () => {
        const carouselRoutes = require('../routes/carousel.routes');
        const galleryItemRoutes = require('../routes/gallery-item.routes');
        const galleryFolderRoutes = require('../routes/gallery-folder.routes');
        const galleryVideoRoutes = require('../routes/gallery-video.routes');

        [
            { router: carouselRoutes, path: '/', method: 'post', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: carouselRoutes, path: '/:id', method: 'put', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: carouselRoutes, path: '/:id', method: 'delete', required: ['authenticateToken', 'requestLockMiddleware'] },
            { router: galleryItemRoutes, path: '/', method: 'post', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: galleryItemRoutes, path: '/:id', method: 'put', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: galleryItemRoutes, path: '/:id', method: 'delete', required: ['authenticateToken', 'requestLockMiddleware'] },
            { router: galleryFolderRoutes, path: '/', method: 'post', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: galleryFolderRoutes, path: '/:id', method: 'put', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: galleryFolderRoutes, path: '/:id/set-carousel', method: 'put', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: galleryFolderRoutes, path: '/:id', method: 'delete', required: ['authenticateToken', 'requestLockMiddleware'] },
            { router: galleryVideoRoutes, path: '/', method: 'post', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: galleryVideoRoutes, path: '/:id', method: 'put', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: galleryVideoRoutes, path: '/:id', method: 'delete', required: ['authenticateToken', 'requestLockMiddleware'] }
        ].forEach(({ router, path, method, required }) => {
            const route = router.stack.find((layer) => layer.route?.path === path && layer.route.methods[method]);
            expect(route.route.stack.map((layer) => layer.name)).toEqual(
                expect.arrayContaining(required)
            );
        });
    });

    test('contact info, bank details, and faq admin mutations are protected by request lock and idempotency where applicable', () => {
        const contactInfoRoutes = require('../routes/contact-info.routes');
        const bankDetailsRoutes = require('../routes/bank-details.routes');
        const faqRoutes = require('../routes/faq.routes');

        [
            { router: contactInfoRoutes, path: '/address', method: 'put', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: contactInfoRoutes, path: '/phones', method: 'post', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: contactInfoRoutes, path: '/phones/:id', method: 'put', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: contactInfoRoutes, path: '/phones/:id', method: 'delete', required: ['authenticateToken', 'requestLockMiddleware'] },
            { router: contactInfoRoutes, path: '/emails', method: 'post', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: contactInfoRoutes, path: '/emails/:id', method: 'put', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: contactInfoRoutes, path: '/emails/:id', method: 'delete', required: ['authenticateToken', 'requestLockMiddleware'] },
            { router: contactInfoRoutes, path: '/office-hours', method: 'post', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: contactInfoRoutes, path: '/office-hours/:id', method: 'put', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: contactInfoRoutes, path: '/office-hours/:id', method: 'delete', required: ['authenticateToken', 'requestLockMiddleware'] },
            { router: bankDetailsRoutes, path: '/', method: 'post', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: bankDetailsRoutes, path: '/:id', method: 'put', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: bankDetailsRoutes, path: '/:id', method: 'delete', required: ['authenticateToken', 'requestLockMiddleware'] },
            { router: faqRoutes, path: '/', method: 'post', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: faqRoutes, path: '/:id', method: 'put', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: faqRoutes, path: '/:id/toggle-active', method: 'patch', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: faqRoutes, path: '/:id', method: 'delete', required: ['authenticateToken', 'requestLockMiddleware'] },
            { router: faqRoutes, path: '/reorder/bulk', method: 'put', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] }
        ].forEach(({ router, path, method, required }) => {
            const route = router.stack.find((layer) => layer.route?.path === path && layer.route.methods[method]);
            expect(route.route.stack.map((layer) => layer.name)).toEqual(
                expect.arrayContaining(required)
            );
        });
    });

    test('about, newsletter, and testimonial mutations are protected by request lock and idempotency where applicable', () => {
        const aboutRoutes = require('../routes/about.routes');
        const newsletterRoutes = require('../routes/newsletter.routes');
        const testimonialRoutes = require('../routes/testimonial.routes');

        [
            { router: aboutRoutes, path: '/cards', method: 'post', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: aboutRoutes, path: '/cards/:id', method: 'put', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: aboutRoutes, path: '/cards/:id', method: 'delete', required: ['authenticateToken', 'requestLockMiddleware'] },
            { router: aboutRoutes, path: '/stats', method: 'post', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: aboutRoutes, path: '/stats/:id', method: 'put', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: aboutRoutes, path: '/stats/:id', method: 'delete', required: ['authenticateToken', 'requestLockMiddleware'] },
            { router: aboutRoutes, path: '/timeline', method: 'post', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: aboutRoutes, path: '/timeline/:id', method: 'put', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: aboutRoutes, path: '/timeline/:id', method: 'delete', required: ['authenticateToken', 'requestLockMiddleware'] },
            { router: aboutRoutes, path: '/team', method: 'post', required: ['authenticateToken', 'requestLockMiddleware'] },
            { router: aboutRoutes, path: '/team/:id', method: 'put', required: ['authenticateToken', 'requestLockMiddleware'] },
            { router: aboutRoutes, path: '/team/:id', method: 'delete', required: ['authenticateToken', 'requestLockMiddleware'] },
            { router: aboutRoutes, path: '/goals', method: 'post', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: aboutRoutes, path: '/goals/:id', method: 'put', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: aboutRoutes, path: '/goals/:id', method: 'delete', required: ['authenticateToken', 'requestLockMiddleware'] },
            { router: aboutRoutes, path: '/settings', method: 'put', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: newsletterRoutes, path: '/subscribers', method: 'post', required: ['requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: newsletterRoutes, path: '/subscribers/:id', method: 'put', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: newsletterRoutes, path: '/subscribers/:id', method: 'delete', required: ['authenticateToken', 'requestLockMiddleware'] },
            { router: newsletterRoutes, path: '/config', method: 'put', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: testimonialRoutes, path: '/', method: 'post', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: testimonialRoutes, path: '/:id', method: 'put', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: testimonialRoutes, path: '/:id', method: 'delete', required: ['authenticateToken', 'requestLockMiddleware'] }
        ].forEach(({ router, path, method, required }) => {
            const route = router.stack.find((layer) => layer.route?.path === path && layer.route.methods[method]);
            expect(route.route.stack.map((layer) => layer.name)).toEqual(
                expect.arrayContaining(required)
            );
        });
    });

    test('manager, user, settings, and contact admin mutations are protected by request lock and idempotency where applicable', () => {
        const managerRoutes = require('../routes/manager.routes');
        const userRoutes = require('../routes/user.routes');
        const settingsRoutes = require('../routes/settings.routes');
        const contactRoutes = require('../routes/contact.routes');

        [
            { router: managerRoutes, path: '/', method: 'post', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: managerRoutes, path: '/:id/permissions', method: 'put', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: managerRoutes, path: '/:id/toggle-status', method: 'put', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: managerRoutes, path: '/:id', method: 'delete', required: ['authenticateToken', 'requestLockMiddleware'] },
            { router: userRoutes, path: '/:id/block', method: 'post', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: settingsRoutes, path: '/delivery', method: 'patch', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: settingsRoutes, path: '/currency', method: 'patch', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: contactRoutes, path: '/:id/status', method: 'patch', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] }
        ].forEach(({ router, path, method, required }) => {
            const route = router.stack.find((layer) => layer.route?.path === path && layer.route.methods[method]);
            expect(route.route.stack.map((layer) => layer.name)).toEqual(
                expect.arrayContaining(required)
            );
        });
    });

    test('coupon, delivery config, and product variant admin mutations are protected by request lock and idempotency where applicable', () => {
        const couponRoutes = require('../routes/coupon.routes');
        const deliveryConfigsRoutes = require('../routes/delivery-configs.routes');
        const productVariantRoutes = require('../routes/product-variant.routes');

        [
            { router: couponRoutes, path: '/', method: 'post', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: couponRoutes, path: '/:id', method: 'put', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: couponRoutes, path: '/:id', method: 'delete', required: ['authenticateToken', 'requestLockMiddleware'] },
            { router: deliveryConfigsRoutes, path: '/', method: 'post', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: deliveryConfigsRoutes, path: '/:id', method: 'delete', required: ['authenticateToken', 'requestLockMiddleware'] },
            { router: productVariantRoutes, path: '/admin/products/:productId/variants', method: 'post', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: productVariantRoutes, path: '/admin/products/:productId/variants/:variantId', method: 'put', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: productVariantRoutes, path: '/admin/products/:productId/variants/:variantId', method: 'delete', required: ['authenticateToken', 'requestLockMiddleware'] },
            { router: productVariantRoutes, path: '/admin/products/:productId/variants/:variantId/set-default', method: 'post', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: productVariantRoutes, path: '/admin/products-with-variants', method: 'post', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: productVariantRoutes, path: '/admin/products-with-variants/:productId', method: 'put', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] }
        ].forEach(({ router, path, method, required }) => {
            const route = router.stack.find((layer) => layer.route?.path === path && layer.route.methods[method]);
            expect(route.route.stack.map((layer) => layer.name)).toEqual(
                expect.arrayContaining(required)
            );
        });
    });

    test('event, review, admin alert, and admin notification mutations are protected by request lock and idempotency where applicable', () => {
        const eventRoutes = require('../routes/event.routes');
        const reviewRoutes = require('../routes/review.routes');
        const adminAlertRoutes = require('../routes/admin-alert.routes');
        const adminNotificationRoutes = require('../routes/admin-notification.routes');

        [
            { router: eventRoutes, path: '/', method: 'post', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: eventRoutes, path: '/:id', method: 'put', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: eventRoutes, path: '/:id', method: 'delete', required: ['authenticateToken', 'requestLockMiddleware'] },
            { router: reviewRoutes, path: '/', method: 'post', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: reviewRoutes, path: '/:id', method: 'delete', required: ['authenticateToken', 'requestLockMiddleware'] },
            { router: adminAlertRoutes, path: '/:id/read', method: 'put', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: adminAlertRoutes, path: '/read-all', method: 'put', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: adminAlertRoutes, path: '/by-reference/:type/:id/read', method: 'put', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: adminNotificationRoutes, path: '/:id/read', method: 'put', required: ['requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: adminNotificationRoutes, path: '/read-all', method: 'put', required: ['requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: adminNotificationRoutes, path: '/:id/archive', method: 'put', required: ['requestLockMiddleware', 'idempotencyMiddleware'] }
        ].forEach(({ router, path, method, required }) => {
            const route = router.stack.find((layer) => layer.route?.path === path && layer.route.methods[method]);
            expect(route.route.stack.map((layer) => layer.name)).toEqual(
                expect.arrayContaining(required)
            );
        });
    });

    test('comment and custom invoice mutations are protected by request lock and idempotency where applicable', () => {
        const commentsRoutes = require('../routes/comments.routes');
        const customInvoiceRoutes = require('../routes/custom-invoice.routes');

        [
            { router: commentsRoutes, path: '/', method: 'post', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: commentsRoutes, path: '/:id', method: 'put', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: commentsRoutes, path: '/:id', method: 'delete', required: ['authenticateToken', 'requestLockMiddleware'] },
            { router: commentsRoutes, path: '/:id/flag', method: 'post', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: commentsRoutes, path: '/:id/approve', method: 'post', required: ['authenticateToken', 'requireAdminOrManager', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: commentsRoutes, path: '/:id/hide', method: 'post', required: ['authenticateToken', 'requireAdminOrManager', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: commentsRoutes, path: '/:id/restore', method: 'post', required: ['authenticateToken', 'requireAdminOrManager', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: commentsRoutes, path: '/:id/permanent', method: 'delete', required: ['authenticateToken', 'requireAdminOrManager', 'requestLockMiddleware'] },
            { router: customInvoiceRoutes, path: '/:orderId/generate', method: 'post', required: ['requireAuth', 'requestLockMiddleware', 'idempotencyMiddleware'] }
        ].forEach(({ router, path, method, required }) => {
            const route = router.stack.find((layer) => layer.route?.path === path && layer.route.methods[method]);
            expect(route.route.stack.map((layer) => layer.name)).toEqual(
                expect.arrayContaining(required)
            );
        });
    });

    test('profile account mutations are protected by request lock and idempotency where applicable', () => {
        const profileRoutes = require('../routes/profile.routes');

        [
            { path: '/', method: 'put', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { path: '/avatar', method: 'post', required: ['authenticateToken', 'requestLockMiddleware'] },
            { path: '/avatar', method: 'delete', required: ['authenticateToken', 'requestLockMiddleware'] },
            { path: '/delete-account', method: 'post', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { path: '/change-password', method: 'post', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { path: '/send-email-verification', method: 'post', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] }
        ].forEach(({ path, method, required }) => {
            const route = profileRoutes.stack.find((layer) => layer.route?.path === path && layer.route.methods[method]);
            expect(route.route.stack.map((layer) => layer.name)).toEqual(
                expect.arrayContaining(required)
            );
        });
    });

    test('order creation and upload mutations are protected by request lock and idempotency where applicable', () => {
        const orderRoutes = require('../routes/order.routes');
        const uploadRoutes = require('../routes/upload.routes');

        [
            { router: orderRoutes, path: '/', method: 'post', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: uploadRoutes, path: '/', method: 'post', required: ['uploadWriteRateLimit', 'authenticateToken', 'requestLockMiddleware'] },
            { router: uploadRoutes, path: '/by-url', method: 'delete', required: ['uploadWriteRateLimit', 'authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: uploadRoutes, path: '/:id', method: 'delete', required: ['uploadWriteRateLimit', 'authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] }
        ].forEach(({ router, path, method, required }) => {
            const route = router.stack.find((layer) => layer.route?.path === path && layer.route.methods[method]);
            expect(route.route.stack.map((layer) => layer.name)).toEqual(
                expect.arrayContaining(required)
            );
        });
    });

    test('cart and auth mutations are protected by request lock and idempotency where applicable', () => {
        const cartRoutes = require('../routes/cart.routes');
        const authRoutes = require('../routes/auth.routes');

        [
            { router: cartRoutes, path: '/items', method: 'post', required: ['requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: cartRoutes, path: '/items/:product_id', method: 'put', required: ['requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: cartRoutes, path: '/items/:product_id', method: 'delete', required: ['requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: cartRoutes, path: '/apply-coupon', method: 'post', required: ['requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: cartRoutes, path: '/coupon', method: 'delete', required: ['requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: cartRoutes, path: '/', method: 'delete', required: ['requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: authRoutes, path: '/google/exchange', method: 'post', required: ['authRateLimit', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: authRoutes, path: '/sync', method: 'post', required: ['authSessionRateLimit', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: authRoutes, path: '/resend-confirmation', method: 'post', required: ['authRateLimit', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: authRoutes, path: '/register', method: 'post', required: ['authRateLimit', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: authRoutes, path: '/verify-login-otp', method: 'post', required: ['authRateLimit', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: authRoutes, path: '/refresh', method: 'post', required: ['authSessionRateLimit', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: authRoutes, path: '/logout', method: 'post', required: ['authSessionRateLimit', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: authRoutes, path: '/send-change-password-otp', method: 'post', required: ['authSessionRateLimit', 'authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: authRoutes, path: '/change-password', method: 'post', required: ['authSessionRateLimit', 'authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: authRoutes, path: '/reset-password-request', method: 'post', required: ['authRateLimit', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: authRoutes, path: '/reset-password', method: 'post', required: ['authRateLimit', 'requestLockMiddleware', 'idempotencyMiddleware'] }
        ].forEach(({ router, path, method, required }) => {
            const route = router.stack.find((layer) => layer.route?.path === path && layer.route.methods[method]);
            expect(route.route.stack.map((layer) => layer.name)).toEqual(
                expect.arrayContaining(required)
            );
        });
    });

    test('contact form submission and admin email mutations are protected by request lock and idempotency where applicable', () => {
        const contactRoutes = require('../routes/contact.routes');
        const emailRoutes = require('../routes/email.routes');

        [
            { router: contactRoutes, path: '/', method: 'post', required: ['requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: emailRoutes, path: '/send', method: 'post', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: emailRoutes, path: '/send-templated', method: 'post', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] },
            { router: emailRoutes, path: '/test', method: 'post', required: ['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'] }
        ].forEach(({ router, path, method, required }) => {
            const route = router.stack.find((layer) => layer.route?.path === path && layer.route.methods[method]);
            expect(route.route.stack.map((layer) => layer.name)).toEqual(
                expect.arrayContaining(required)
            );
        });
    });

    test('policy upload mutation is protected by request lock and idempotency', () => {
        const policyRoutes = require('../routes/policy.routes');
        const route = policyRoutes.stack.find((layer) => layer.route?.path === '/upload' && layer.route.methods.post);

        expect(route.route.stack.map((layer) => layer.name)).toEqual(
            expect.arrayContaining(['authenticateToken', 'requestLockMiddleware', 'idempotencyMiddleware'])
        );
    });
});
