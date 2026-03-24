/**
 * Webhook Routes
 * Handles incoming webhooks from external payment providers
 */

const express = require('express');
const router = express.Router();
const { RazorpayWebhookLogger } = require('../services/razorpay-webhook-logger.service');
const { createModuleLogger } = require('../utils/logging-standards');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');

const log = createModuleLogger('WebhookRoutes');

/**
 * @route POST /api/webhooks/razorpay
 * @description Handle incoming Razorpay webhooks
 * @access Public (verified via signature)
 */
router.post('/razorpay', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
        const signature = req.headers['x-razorpay-signature'];
        const rawBody = req.body.toString();

        // Parse the event
        let event;
        try {
            event = JSON.parse(rawBody);
        } catch (parseError) {
            log.warn('WEBHOOK_PARSE_ERROR', 'Failed to parse webhook body');
            return res.status(400).json({ error: req.t ? req.t('errors.webhook.invalidJson') : 'Invalid webhook payload' });
        }

        log.info('WEBHOOK_RECEIVED', `Received Razorpay webhook: ${event.event}`, {
            eventType: event.event,
            hasSignature: !!signature
        });

        // Process the webhook
        const result = await RazorpayWebhookLogger.processWebhookEvent(
            event,
            rawBody,
            signature || ''
        );

        if (result.success) {
            return res.status(200).json({ status: 'ok', verified: result.verified });
        } else {
            if (!result.verified) {
                // Return 401 to prevent further processing from unauthorized sources
                return res.status(401).json({ status: 'unauthorized', error: result.error });
            }
            if (result.shouldRetry) {
                // Return 500 to tell Razorpay to retry the webhook delivery
                return res.status(500).json({ status: 'error', error: result.error, retry: true });
            }
            // Return 200 for logical failures (e.g., idempotency already captured) to prevent Razorpay from retrying
            return res.status(200).json({ status: 'logged', error: result.error });
        }

    } catch (error) {
        log.operationError('WEBHOOK_HANDLER', error);
        // Return 500 on massive uncaught handlers so Razorpay will retry
        return res.status(500).json({ status: 'error', message: req.t ? req.t('errors.system.internalProcessing') : 'Webhook processing failed' });
    }
});


/**
 * @route GET /api/webhooks/logs
 * @description Get recent webhook logs (admin only)
 * @access Admin/Manager
 */
router.get('/logs', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        // Note: Add auth middleware for admin protection in production
        const limit = parseInt(req.query.limit) || 50;
        const logs = await RazorpayWebhookLogger.getRecentLogs(limit);

        res.status(200).json({
            success: true,
            count: logs.length,
            data: logs
        });
    } catch (error) {
        res.status(500).json({ error: req.t('errors.webhook.logsFetchFailed') });
    }
});

module.exports = router;
