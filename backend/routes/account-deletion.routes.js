const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth.middleware');
const { requestLock } = require('../middleware/requestLock.middleware');
const { idempotency } = require('../middleware/idempotency.middleware');
const { scheduleBackgroundTask } = require('../utils/background-task');
const AccountDeletionService = require('../services/account-deletion.service');
const { DeletionJobProcessor } = require('../services/deletion-job-processor');
const supabase = require('../config/supabase');

/**
 * Account Deletion Routes
 * All routes require authentication
 */

/**
 * GET /api/account/delete/eligibility
 * Check if user is eligible for account deletion
 */
router.get('/eligibility', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const correlationId = req.correlationId;

        const result = await AccountDeletionService.checkEligibility(userId, correlationId);

        res.json(result);
    } catch (error) {
        logger.error({ err: error, userId: req.user?.id }, 'Error checking deletion eligibility');
        res.status(500).json({ error: req.t('errors.deletion.checkEligibilityFailed') });
    }
});

/**
 * GET /api/account/delete/status
 * Get current deletion status for user
 */
router.get('/status', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        const status = await AccountDeletionService.getDeletionStatus(userId);

        res.json(status);
    } catch (error) {
        logger.error({ err: error, userId: req.user?.id }, 'Error getting deletion status');
        res.status(500).json({ error: req.t('errors.deletion.getStatusFailed') });
    }
});

/**
 * POST /api/account/delete/request-otp
 * Request OTP for account deletion
 */
router.post('/request-otp', authenticateToken, requestLock('account-delete-request-otp'), idempotency(), async (req, res) => {
    try {
        const userId = req.user.id;
        const email = req.user.email;
        const correlationId = req.correlationId;

        if (!email) {
            return res.status(400).json({ error: req.t('errors.deletion.emailRequired') });
        }

        const lang = req.get('x-user-lang') || 'en';
        const result = await AccountDeletionService.requestDeletionOTP(userId, email, correlationId, lang);

        if (!result.success) {
            return res.status(400).json({
                error: result.error,
                blockingReasons: result.blockingReasons
            });
        }

        res.json(result);
    } catch (error) {
        logger.error({ err: error, userId: req.user?.id }, 'Error requesting deletion OTP');
        res.status(500).json({ error: req.t('errors.deletion.sendCodeFailed') });
    }
});

/**
 * POST /api/account/delete/verify-otp
 * Verify OTP and get Deletion Authorization Token
 */
router.post('/verify-otp', authenticateToken, requestLock('account-delete-verify-otp'), idempotency(), async (req, res) => {
    try {
        const userId = req.user.id;
        const email = req.user.email;
        const { otp, deviceFingerprint } = req.body;
        const correlationId = req.correlationId;

        if (!otp) {
            return res.status(400).json({ error: req.t('errors.deletion.otpRequired') });
        }

        const result = await AccountDeletionService.verifyDeletionOTP(
            userId,
            email,
            otp,
            deviceFingerprint,
            correlationId
        );

        if (!result.success) {
            return res.status(400).json({
                error: result.error,
                blockingReasons: result.blockingReasons
            });
        }

        res.json(result);
    } catch (error) {
        logger.error({ err: error, userId: req.user?.id }, 'Error verifying deletion OTP');
        res.status(500).json({ error: req.t('errors.deletion.verifyCodeFailed') });
    }
});

/**
 * POST /api/account/delete/confirm
 * Confirm immediate account deletion
 * Requires valid DAT (Deletion Authorization Token)
 */
router.post('/confirm', authenticateToken, requestLock('account-delete-confirm'), idempotency(), async (req, res) => {
    try {
        const userId = req.user.id;
        const { authorizationToken, reason } = req.body;
        const correlationId = req.correlationId;

        if (!authorizationToken) {
            return res.status(400).json({ error: req.t('errors.deletion.tokenRequired') });
        }

        const lang = req.get('x-user-lang') || 'en';
        const result = await AccountDeletionService.confirmImmediateDeletion(
            userId,
            authorizationToken,
            reason,
            correlationId,
            lang
        );

        if (!result.success) {
            return res.status(400).json({
                error: result.error,
                blockingReasons: result.blockingReasons
            });
        }

        // Clear active session cookies immediately after confirmation.
        res.clearCookie('access_token');
        res.clearCookie('refresh_token');
        res.clearCookie('logged_in');

        res.json(result);
    } catch (error) {
        logger.error({ err: error, userId: req.user?.id }, 'Error confirming deletion');
        res.status(500).json({ error: req.t('errors.deletion.initiateFailed') });
    }
});

/**
 * @route POST /account/delete/schedule
 * @desc Schedule account deletion for 15 days in the future
 * @access Private
 */
router.post('/schedule', authenticateToken, requestLock('account-delete-schedule'), idempotency(), async (req, res) => {
    try {
        const { authorizationToken, days, reason } = req.body;

        if (!authorizationToken) {
            return res.status(400).json({ error: req.t('errors.deletion.tokenRequired') });
        }

        // Strictly enforce 15 days 
        if (days !== 15) {
            return res.status(400).json({ error: 'Scheduled deletion is strictly enforced to 15 days. Please update your request.' });
        }

        const lang = req.get('x-user-lang') || 'en';
        const result = await AccountDeletionService.scheduleDeletion(
            req.user.id,
            authorizationToken,
            days,
            reason,
            req.correlationId,
            lang
        );

        if (!result.success) {
            return res.status(400).json({
                error: result.error,
                blockingReasons: result.blockingReasons
            });
        }

        res.json(result);
    } catch (error) {
        logger.error({ err: error, userId: req.user?.id }, 'Error scheduling deletion');
        res.status(500).json({ error: req.t('errors.deletion.scheduleFailed') });
    }
});

/**
 * POST /api/account/delete/cancel
 * Cancel scheduled account deletion
 */
router.post('/cancel', authenticateToken, requestLock('account-delete-cancel'), idempotency(), async (req, res) => {
    try {
        const userId = req.user.id;
        const correlationId = req.correlationId;

        const result = await AccountDeletionService.cancelScheduledDeletion(userId, correlationId);

        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }

        res.json(result);
    } catch (error) {
        logger.error({ err: error, userId: req.user?.id }, 'Error cancelling deletion');
        res.status(500).json({ error: req.t('errors.deletion.cancelFailed') });
    }
});

/**
 * POST /api/account/delete/admin/process-pending
 * Admin-only: Manually trigger processing of PENDING deletion jobs
 */
router.post('/admin/process-pending', authenticateToken, requestLock((req) => `account-delete-admin-process:${req.body?.jobId || 'all'}`), idempotency(), async (req, res) => {
    try {
        // Check if user is admin
        if (req.user.role !== 'admin' && req.user.role !== 'manager') {
            return res.status(403).json({ error: req.t('errors.auth.adminRequired') });
        }

        const { jobId } = req.body;
        const correlationId = req.correlationId;

        if (!jobId) {
            // Process all pending jobs
            const result = await DeletionJobProcessor.processScheduledDeletions();
            return res.json({ success: true, message: req.t('success.jobs.scheduledTriggered'), ...result });
        }

        // Process specific job
        const { data: job, error: fetchError } = await supabase
            .from('account_deletion_jobs')
            .select('*')
            .eq('id', jobId)
            .single();

        if (fetchError || !job) {
            return res.status(404).json({ error: req.t('errors.deletion.jobNotFound') });
        }

        if (job.status !== 'PENDING') {
            return res.status(400).json({ error: req.t('errors.deletion.jobStatusInvalid', { status: job.status }) });
        }


        scheduleBackgroundTask({
            operationName: 'AccountDeletionRoutes.processPendingJob',
            context: { correlationId, userId: req.user.id },
            errorMessage: '[AdminProcessPending] Job processing failed',
            task: async () => {
                await DeletionJobProcessor.processJob(jobId);
            }
        });

        logger.info({ jobId, correlationId, adminId: req.user.id }, '[AdminProcessPending] Manual job processing triggered');

        res.json({
            success: true,
            message: req.t('success.jobs.processingTriggered'),
            jobId
        });
    } catch (error) {
        logger.error({ err: error, userId: req.user?.id }, 'Error processing pending job');
        res.status(500).json({ error: req.t('errors.deletion.processFailed') });
    }
});

module.exports = router;
