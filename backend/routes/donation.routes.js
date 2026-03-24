const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const { authenticateToken, optionalAuth } = require('../middleware/auth.middleware');
const { requestLock } = require('../middleware/requestLock.middleware');
const { idempotency } = require('../middleware/idempotency.middleware');
const DonationService = require('../services/donation.service');
const { getFriendlyMessage } = require('../utils/error-messages');

/**
 * POST /api/donations/create-order
 * Create a One-Time Donation Order
 */
router.post('/create-order', optionalAuth, requestLock('donation-create-order'), idempotency(), async (req, res) => {
    try {
        const userId = req.user?.id || null;
        const result = await DonationService.createOneTimeOrder(userId, req.body);
        res.json({ success: true, ...result });
    } catch (error) {
        logger.error({ err: error }, 'Error creating donation order:');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

/**
 * POST /api/donations/create-subscription
 * Create a Monthly Donation Subscription
 */
router.post('/create-subscription', optionalAuth, requestLock('donation-create-subscription'), idempotency(), async (req, res) => {
    try {
        const userId = req.user?.id || null;
        const result = await DonationService.createSubscription(userId, req.body);
        res.json({ success: true, ...result });
    } catch (error) {
        logger.error({ err: error }, 'Error creating subscription:');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

/**
 * POST /api/donations/verify
 * Verify One-Time Payment
 */
router.post('/verify', optionalAuth, requestLock('donation-verify'), idempotency(), async (req, res) => {
    try {
        const donation = await DonationService.verifyPayment(req.body);
        res.json({
            success: true,
            message: req.t('success.donation.verified'),
            donation
        });
    } catch (error) {
        logger.error({ err: error }, 'Error verifying donation:');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

/**
 * POST /api/donations/webhook
 * Handle Razorpay Webhooks
 */
router.post('/webhook', async (req, res) => {
    try {
        await DonationService.processWebhook(req.headers['x-razorpay-signature'], req.body);
        res.json({ status: 'ok' });
    } catch (error) {
        logger.error({ err: error }, 'Webhook processing error:');
        res.status(500).json({ error: req.t('errors.donation.webhookFailed') });
    }
});

/**
 * GET /api/donations/qr-code
 * Get a Razorpay QR Code for anonymous donations
 */
router.get('/qr-code', async (req, res) => {
    try {
        const result = await DonationService.createQRCode();
        res.json({ success: true, ...result });
    } catch (error) {
        logger.error({ err: error }, 'Error creating QR code:');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// ------------------------------------------------------------------
// Subscription Management Endpoints
// ------------------------------------------------------------------

/**
 * GET /api/donations/subscriptions
 * Fetch user's active/past subscriptions
 */
router.get('/subscriptions', authenticateToken, async (req, res) => {
    try {
        const subscriptions = await DonationService.getUserSubscriptions(req.user.id);
        res.json({ subscriptions });
    } catch (error) {
        logger.error({ err: error }, 'Error fetching subscriptions:');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

/**
 * POST /api/donations/cancel-subscription
 */
router.post('/cancel-subscription', authenticateToken, async (req, res) => {
    try {
        await DonationService.cancelSubscription(req.user.id, req.body.subscriptionId);
        res.json({ success: true, message: req.t('success.donation.subscriptionCancelled') });
    } catch (error) {
        logger.error({ err: error }, 'Error cancelling subscription:');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

/**
 * POST /api/donations/pause-subscription
 */
router.post('/pause-subscription', authenticateToken, async (req, res) => {
    try {
        await DonationService.pauseSubscription(req.user.id, req.body.subscriptionId);
        res.json({ success: true, message: req.t('success.donation.subscriptionPaused') });
    } catch (error) {
        logger.error({ err: error }, 'Error pausing subscription:');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

/**
 * POST /api/donations/resume-subscription
 */
router.post('/resume-subscription', authenticateToken, async (req, res) => {
    try {
        await DonationService.resumeSubscription(req.user.id, req.body.subscriptionId);
        res.json({ success: true, message: req.t('success.donation.subscriptionResumed') });
    } catch (error) {
        logger.error({ err: error }, 'Error resuming subscription:');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

module.exports = router;
