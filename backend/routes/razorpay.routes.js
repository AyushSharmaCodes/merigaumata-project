const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const crypto = require('crypto');
const { handleEvent } = require('../services/webhook.service');

/**
 * Razorpay Webhook Route
 * Handles asynchronous payment events
 */

router.post('/webhook', async (req, res) => {
    try {
        const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

        // Verify signature
        const shasum = crypto.createHmac('sha256', secret);
        shasum.update(JSON.stringify(req.body));
        const digest = shasum.digest('hex');

        if (digest !== req.headers['x-razorpay-signature']) {
            logger.error('Razorpay Webhook Signature Verification Failed');
            return res.status(400).json({ status: 'failure', message: req.t('errors.payment.invalidSignature') });
        }

        // Handle event
        const event = req.body.event;
        logger.info(`Received Razorpay Webhook Event: ${event}`);

        await handleEvent(req.body);

        res.json({ status: 'ok' });

    } catch (error) {
        logger.error({ err: error }, 'Razorpay Webhook Error:');
        res.status(500).json({ error: req.t('errors.payment.webhookFailed') });
    }
});

module.exports = router;
