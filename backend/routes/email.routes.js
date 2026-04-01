/**
 * Email Routes
 * API endpoints for sending emails programmatically
 * 
 * All endpoints require admin or manager authentication
 */
const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');
const { requestLock } = require('../middleware/requestLock.middleware');
const { idempotency } = require('../middleware/idempotency.middleware');
const validate = require('../middleware/validate.middleware');
const emailService = require('../services/email');
const logger = require('../utils/logger');
const { getFriendlyMessage } = require('../utils/error-messages');

// Validation schemas
const sendEmailSchema = z.object({
    to: z.string().email('Invalid recipient email address'),
    subject: z.string().min(1, 'Subject is required').max(500, 'Subject too long'),
    html: z.string().min(1, 'HTML content is required'),
    text: z.string().optional(),
    attachments: z.array(z.object({
        filename: z.string(),
        path: z.string().optional(),
        content: z.union([z.string(), z.instanceof(Buffer)]).optional(),
        contentType: z.string().optional()
    })).optional()
});

const sendTemplatedEmailSchema = z.object({
    to: z.string().email('Invalid recipient email address'),
    eventType: z.string().min(1, 'Event type is required'),
    data: z.record(z.any()).optional(),
    userId: z.string().uuid().optional(),
    referenceId: z.string().uuid().optional()
});

/**
 * GET /api/email/status
 * Get the current email provider status and configuration
 */
router.get('/status', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const providerName = emailService.provider?.name || 'unknown';
        const isConfigured = emailService.provider?.isConfigured?.() ?? false;
        const canVerifyConnection = typeof emailService.provider?.verifyConnection === 'function';
        const connectionVerified = canVerifyConnection
            ? await emailService.provider.verifyConnection()
            : null;

        const providerConfig = providerName === 'ses'
            ? {
                region: process.env.AWS_SES_REGION || process.env.AWS_REGION || null,
                fromEmail: process.env.AWS_SES_FROM_EMAIL || process.env.SMTP_FROM_EMAIL || null,
                fromName: process.env.AWS_SES_FROM_NAME || process.env.APP_NAME || null,
                hasStaticCredentials: Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY),
                useManagedTemplates: process.env.AWS_SES_USE_MANAGED_TEMPLATES === 'true',
                hasReplyTo: Boolean(process.env.AWS_SES_REPLY_TO),
                configurationSetName: process.env.AWS_SES_CONFIGURATION_SET || null,
                hasIdentityArn: Boolean(process.env.AWS_SES_IDENTITY_ARN),
                feedbackForwardingEmail: process.env.AWS_SES_FEEDBACK_FORWARDING_EMAIL || null
            }
            : providerName === 'smtp'
                ? {
                    host: process.env.SMTP_HOST || null,
                    port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : null,
                    secure: process.env.SMTP_SECURE === 'true',
                    fromEmail: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || null,
                    fromName: process.env.SMTP_FROM_NAME || process.env.APP_NAME || null
                }
                : {};

        logger.debug({
            provider: providerName,
            configured: isConfigured,
            connectionVerified,
            requestedBy: req.user.id
        }, 'Email status check');

        res.json({
            success: true,
            data: {
                provider: providerName,
                configured: isConfigured,
                connectionVerified,
                ready: isConfigured && (connectionVerified !== false),
                providerConfig
            }
        });
    } catch (error) {
        logger.error({ err: error, requestedBy: req.user.id }, req.t('errors.email.statusFetchFailed'));
        res.status(500).json({
            success: false,
            error: req.t('errors.email.statusFetchFailed')
        });
    }
});

/**
 * POST /api/email/send
 * Send a raw email with custom HTML content
 * 
 * Required: admin or manager role
 * 
 * Body:
 * - to: Recipient email address
 * - subject: Email subject
 * - html: HTML content
 * - text: (optional) Plain text content
 * - attachments: (optional) Array of attachment objects
 */
router.post('/send',
    authenticateToken,
    requireRole('admin'),
    requestLock('email-send'),
    idempotency(),
    validate(sendEmailSchema),
    async (req, res) => {
        const { to, subject, html, text, attachments } = req.body;

        logger.info({
            to,
            subject,
            userId: req.user.id,
            hasAttachments: Boolean(attachments?.length)
        }, 'Manual email send request');

        try {
            // Use the provider directly for raw email sends
            const result = await emailService.provider.send({
                to,
                subject,
                html,
                text,
                attachments
            });

            if (result.success) {
                logger.info({
                    to,
                    subject,
                    messageId: result.messageId,
                    provider: result.provider
                }, 'Manual email sent successfully');

                res.json({
                    success: true,
                    data: {
                        messageId: result.messageId,
                        provider: result.provider || emailService.provider.name
                    },
                    message: req.t('success.email.sent')
                });
            } else {
                logger.error({
                    to,
                    subject,
                    error: result.error
                }, 'Manual email send failed');

                res.status(500).json({
                    success: false,
                    error: result.error || 'Failed to send email'
                });
            }
        } catch (error) {
            logger.error({ err: error, to, subject }, 'Email send error');
            res.status(500).json({
                success: false,
                error: getFriendlyMessage(error, 500)
            });
        }
    }
);

/**
 * POST /api/email/send-templated
 * Send an email using a predefined template
 * 
 * Required: admin or manager role
 * 
 * Body:
 * - to: Recipient email address
 * - eventType: Template event type (from EmailEventTypes)
 * - data: Template data object
 * - userId: (optional) User ID for logging
 * - referenceId: (optional) Reference ID for logging
 */
router.post('/send-templated',
    authenticateToken,
    requireRole('admin'),
    requestLock('email-send-templated'),
    idempotency(),
    validate(sendTemplatedEmailSchema),
    async (req, res) => {
        const { to, eventType, data = {}, userId, referenceId } = req.body;

        logger.info({
            to,
            eventType,
            userId: req.user.id
        }, 'Templated email send request');

        try {
            const result = await emailService.send(eventType, to, data, {
                userId,
                referenceId
            });

            if (result.success) {
                logger.info({
                    to,
                    eventType,
                    messageId: result.messageId,
                    provider: emailService.provider.name
                }, req.t('success.email.templatedSent'));

                res.json({
                    success: true,
                    data: {
                        messageId: result.messageId,
                        provider: emailService.provider.name
                    },
                    message: req.t('success.email.templatedSent')
                });
            } else {
                logger.error({
                    to,
                    eventType,
                    error: result.error,
                    provider: emailService.provider.name
                }, 'Templated email send failed');

                res.status(500).json({
                    success: false,
                    error: result.error || 'Failed to send templated email'
                });
            }
        } catch (error) {
            logger.error({ err: error, to, eventType }, 'Templated email send error');
            res.status(500).json({
                success: false,
                error: getFriendlyMessage(error, 500)
            });
        }
    }
);

/**
 * POST /api/email/test
 * Send a test email to verify configuration
 * 
 * Required: admin role only
 * 
 * Body:
 * - to: (optional) Recipient email, defaults to sender's email
 */
router.post('/test',
    authenticateToken,
    requireRole('admin'),
    requestLock('email-send-test'),
    idempotency(),
    async (req, res) => {
        const to = req.body.to || req.user.email;

        if (!to) {
            return res.status(400).json({
                success: false,
                error: req.t('errors.email.recipientRequired')
            });
        }

        logger.info({ to, adminId: req.user.id }, 'Test email request');

        try {
            const testHtml = `
                <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
                    <h1 style="color: #4F46E5;">Email Configuration Test</h1>
                    <p>This is a test email from your application.</p>
                    <div style="background: #F3F4F6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <strong>Provider:</strong> ${emailService.provider.name}<br>
                        <strong>Time:</strong> ${new Date().toISOString()}<br>
                        <strong>Requested by:</strong> ${req.user.email}
                    </div>
                    <p style="color: #6B7280; font-size: 14px;">
                        If you received this email, your email configuration is working correctly.
                    </p>
                </div>
            `;

            const result = await emailService.provider.send({
                to,
                subject: `[Test] Email Configuration Test - ${new Date().toLocaleDateString()}`,
                html: testHtml
            });

            if (result.success) {
                logger.info({
                    to,
                    messageId: result.messageId,
                    provider: emailService.provider.name,
                    adminId: req.user.id
                }, req.t('success.email.testSent'));

                res.json({
                    success: true,
                    data: {
                        messageId: result.messageId,
                        provider: emailService.provider.name,
                        sentTo: to
                    },
                    message: req.t('success.email.testSent')
                });
            } else {
                logger.error({
                    to,
                    error: result.error,
                    provider: emailService.provider.name,
                    adminId: req.user.id
                }, 'Test email send failed');

                res.status(500).json({
                    success: false,
                    error: getFriendlyMessage(result.error || 'Failed to send test email', 500),
                    provider: emailService.provider.name
                });
            }
        } catch (error) {
            logger.error({ err: error, to }, 'Test email error');
            res.status(500).json({
                success: false,
                error: getFriendlyMessage(error, 500)
            });
        }
    }
);

module.exports = router;
