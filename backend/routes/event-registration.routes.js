const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const { authenticateToken, optionalAuth } = require('../middleware/auth.middleware');
const EventRegistrationService = require('../services/event-registration.service');

/**
 * POST /api/event-registrations/create-order
 * Create Razorpay order for event registration
 */
router.post('/create-order', optionalAuth, async (req, res) => {
    try {
        const userId = req.user?.id || null;
        const result = await EventRegistrationService.createRegistrationOrder(userId, req.body);
        res.json(result);
    } catch (error) {
        // Log the full error for debugging
        logger.error({ err: error }, 'Error creating event registration order');

        // Check for cancelled event
        if (error.message && error.message.includes('cancelled')) {
            return res.status(400).json({ error: error.message });
        }

        // Check for Row-Level Security policy violation
        if (error.message && error.message.includes('row-level security policy')) {
            logger.error('RLS Policy Violation.');
            return res.status(500).json({
                error: req.t('errors.system.configError')
            });
        }

        // Handle specific business logic error messages
        const message = error.message || '';
        const lowerMessage = message.toLowerCase();
        
        const isNotFound = lowerMessage.includes('not found') || lowerMessage.includes('not_found');
        const isDuplicate = lowerMessage.includes('duplicate') || lowerMessage.includes('already registered');
        const isValidation = lowerMessage.includes('invalid') || lowerMessage.includes('required');
        
        // Broaden key detection: if it looks like an i18n key (e.g., "errors.event.duplicateRegistration"), treat it as 400
        const isTranslationKey = message.includes('.') && 
            (message.startsWith('errors.') || message.startsWith('validation.') || message.startsWith('success.') || message.startsWith('common.'));

        const statusCode = isNotFound ? 404 : (isDuplicate || isValidation || isTranslationKey) ? 400 : 500;

        // Sanitize the error message for 500s to avoid leaking internal details
        const finalMessage = statusCode === 500
            ? 'Failed to create registration. Please try again later.'
            : message;

        res.status(statusCode).json({ error: finalMessage, code: isTranslationKey ? message : undefined });
    }
});

/**
 * POST /api/event-registrations/verify-payment
 * Verify Razorpay payment and complete registration
 */
router.post('/verify-payment', optionalAuth, async (req, res) => {
    try {
        const result = await EventRegistrationService.verifyPayment(req.body);
        res.json(result);
    } catch (error) {
        logger.error({ err: error }, 'Error verifying event payment');

        if (error.message && error.message.includes('row-level security policy')) {
            logger.error('RLS Policy Violation in verifyPayment: Ensure SUPABASE_SERVICE_ROLE_KEY is set.');
            return res.status(500).json({ error: req.t('errors.payment.verificationConfigError') });
        }

        res.status(500).json({
            error: req.t('errors.payment.verificationFailedDeducted')
        });
    }
});

/**
 * GET /api/event-registrations/my
 * Get current user's event registrations
 */
router.get('/my', authenticateToken, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 5;
        const data = await EventRegistrationService.getUserRegistrations(req.user.id, { page, limit });
        res.json(data);
    } catch (error) {
        logger.error({ err: error }, 'Error fetching user registrations:');
        res.status(500).json({ error: req.t('errors.event.fetchRegistrationsFailed') });
    }
});

/**
 * GET /api/event-registrations/:id
 * Get registration by ID
 */
router.get('/:id', optionalAuth, async (req, res) => {
    try {
        const userId = req.user?.id || null;
        const data = await EventRegistrationService.getRegistrationById(req.params.id, userId);
        res.json(data);
    } catch (error) {
        logger.error({ err: error }, 'Error fetching registration:');
        const statusCode = error.message === 'Unauthorized' ? 403 :
            error.message === 'Registration not found' ? 404 : 500;
        res.status(statusCode).json({ error: error.message });
    }
});

/**
 * POST /api/event-registrations/cancel
 * Cancel an event registration
 */
router.post('/cancel', authenticateToken, async (req, res) => {
    try {
        const { registrationId, reason } = req.body;
        const result = await EventRegistrationService.cancelRegistration(req.user.id, registrationId, reason);
        res.json(result);
    } catch (error) {
        logger.error({ err: error }, 'Error cancelling registration');

        if (error.message && error.message.includes('row-level security policy')) {
            return res.status(500).json({ error: req.t('errors.system.configError') });
        }

        const statusCode = error.message.includes('not found') ? 404 : 400;
        const message = statusCode === 500 ? 'Failed to cancel registration' : error.message;

        res.status(statusCode).json({ error: message });
    }
});

module.exports = router;
