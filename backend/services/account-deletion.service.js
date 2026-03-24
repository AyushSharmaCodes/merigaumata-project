const { supabase, supabaseAdmin } = require('../lib/supabase');
const logger = require('../utils/logger');
const crypto = require('crypto');
const { sendOTP, verifyOTP } = require('./otp.service');
const emailService = require('./email');
const { AUTH, LOGS } = require('../constants/messages');
const DonationService = require('./donation.service');
const { DeletionJobProcessor } = require('./deletion-job-processor');
const { translate } = require('../utils/i18n.util');

/**
 * Account Deletion Service
 * Handles account deletion eligibility, OTP verification, and job management
 */
class AccountDeletionService {

    // =====================================================
    // ELIGIBILITY CHECK
    // =====================================================

    /**
     * Check if user is eligible for account deletion
     * Returns blocking reasons if not eligible
     */
    static async checkEligibility(userId, correlationId = null) {
        const blockingReasons = [];
        correlationId = correlationId || crypto.randomUUID();

        logger.info({ userId, correlationId }, '[AccountDeletion] Checking eligibility');

        try {
            // 0. Block Admin Account Deletion
            const { data: userData, error: userError } = await supabase
                .from('profiles')
                .select('roles(name)')
                .eq('id', userId)
                .single();

            if (userError) {
                logger.error({ err: userError, userId }, '[AccountDeletion] Error checking user role for eligibility');
            }

            const userRole = userData?.roles?.name || 'customer';

            if (userRole === 'admin') {
                blockingReasons.push({
                    type: 'ADMIN_ACCOUNT',
                    message: translate('errors.account.adminCannotDelete'),
                    severity: 'CRITICAL'
                });
                // Return immediately for admin as it's a hard block
                return { eligible: false, blockingReasons };
            }

            // 1. Check for active Razorpay subscriptions (recurring donations)
            const { data: activeSubscriptions, error: subError } = await supabase
                .from('donation_subscriptions')
                .select('id, razorpay_subscription_id, status')
                .eq('user_id', userId)
                .in('status', ['active', 'paused', 'created', 'authenticated']);

            if (subError) {
                logger.error({ err: subError, userId }, '[AccountDeletion] Error checking subscriptions');
            }

            if (activeSubscriptions && activeSubscriptions.length > 0) {
                blockingReasons.push({
                    type: 'RECURRING_DONATION',
                    count: activeSubscriptions.length,
                    message: `You have ${activeSubscriptions.length} active recurring donation(s). Please cancel them before deleting your account.`,
                    action: { label: 'Manage Donations', url: '/profile?tab=donations' }
                });
            }

            // 2. Check for pending/authorized payments
            const { data: pendingPayments, error: payError } = await supabase
                .from('donations')
                .select('id, payment_status, amount')
                .eq('user_id', userId)
                .in('payment_status', ['created', 'authorized', 'pending']);

            if (payError) {
                logger.error({ err: payError, userId }, '[AccountDeletion] Error checking payments');
            }

            if (pendingPayments && pendingPayments.length > 0) {
                blockingReasons.push({
                    type: 'PENDING_PAYMENT',
                    count: pendingPayments.length,
                    message: `You have ${pendingPayments.length} pending payment(s). Please wait for them to complete or cancel them.`,
                    action: { label: 'View Payments', url: '/profile?tab=donations' }
                });
            }

            // 3. Check for upcoming/ongoing event registrations
            const now = new Date().toISOString();
            const { data: activeRegistrations, error: regError } = await supabase
                .from('event_registrations')
                .select(`
                    id, 
                    status,
                    events!inner(id, title, start_date, end_date, status)
                `)
                .eq('user_id', userId)
                .neq('status', 'cancelled')
                .neq('status', 'refunded')
                .gte('events.end_date', now)
                .neq('events.status', 'cancelled');

            if (regError) {
                logger.error({ err: regError, userId }, '[AccountDeletion] Error checking event registrations');
            }

            if (activeRegistrations && activeRegistrations.length > 0) {
                blockingReasons.push({
                    type: 'UPCOMING_EVENT',
                    count: activeRegistrations.length,
                    message: `You are registered for ${activeRegistrations.length} upcoming/ongoing event(s). Please cancel your registrations first.`,
                    action: { label: 'View Events', url: '/profile?tab=events' }
                });
            }

            // 4. Check for pending orders
            const { data: pendingOrders, error: orderError } = await supabase
                .from('orders')
                .select('id, order_number, status')
                .eq('user_id', userId)
                .in('status', ['pending', 'confirmed', 'processing', 'shipped']);

            if (orderError) {
                logger.error({ err: orderError, userId }, '[AccountDeletion] Error checking orders');
            }

            if (pendingOrders && pendingOrders.length > 0) {
                blockingReasons.push({
                    type: 'PENDING_ORDER',
                    count: pendingOrders.length,
                    message: `You have ${pendingOrders.length} pending order(s). Please wait for them to be delivered or cancelled.`,
                    action: { label: 'View Orders', url: '/my-orders' }
                });
            }

            // 5. Check for legal holds
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('deletion_status')
                .eq('id', userId)
                .single();

            if (profileError) {
                logger.error({ err: profileError, userId }, '[AccountDeletion] Error checking profile');
            }

            if (profile?.deletion_status === 'LEGAL_HOLD') {
                blockingReasons.push({
                    type: 'LEGAL_HOLD',
                    message: translate('errors.account.legalReview'),
                    action: { label: 'Contact Support', url: '/contact' }
                });
            }

            const eligible = blockingReasons.length === 0;

            logger.info({
                userId,
                correlationId,
                eligible,
                blockerCount: blockingReasons.length
            }, '[AccountDeletion] Eligibility check complete');

            return {
                eligible,
                blockingReasons,
                correlationId
            };

        } catch (error) {
            logger.error({ err: error, userId, correlationId }, '[AccountDeletion] Eligibility check failed');
            throw error;
        }
    }

    // =====================================================
    // OTP FLOW
    // =====================================================

    /**
     * Request deletion OTP
     */
    static async requestDeletionOTP(userId, email, correlationId = null, lang = 'en') {
        correlationId = correlationId || crypto.randomUUID();

        logger.info({ userId, correlationId }, '[AccountDeletion] Requesting deletion OTP');

        // First check eligibility
        const eligibility = await this.checkEligibility(userId, correlationId);

        if (!eligibility.eligible) {
            return {
                success: false,
                error: AUTH.DELETION_BLOCKED,
                blockingReasons: eligibility.blockingReasons
            };
        }

        // Send OTP with metadata indicating deletion purpose
        try {
            const result = await sendOTP(email, {
                purpose: 'ACCOUNT_DELETION',
                userId: userId,
                correlationId: correlationId
            }, lang);

            return {
                success: true,
                message: AUTH.DELETION_OTP_SENT,
                correlationId
            };
        } catch (error) {
            logger.error({ err: error, userId, correlationId }, '[AccountDeletion] Failed to send OTP');
            throw new Error(translate('errors.account.verificationFailed'));
        }
    }

    /**
     * Verify deletion OTP and generate DAT (Deletion Authorization Token)
     */
    static async verifyDeletionOTP(userId, email, otp, deviceFingerprint = null, correlationId = null) {
        correlationId = correlationId || crypto.randomUUID();

        logger.info({ userId, correlationId }, '[AccountDeletion] Verifying deletion OTP');

        // Re-check eligibility
        const eligibility = await this.checkEligibility(userId, correlationId);

        if (!eligibility.eligible) {
            return {
                success: false,
                error: AUTH.DELETION_BLOCKED,
                blockingReasons: eligibility.blockingReasons
            };
        }

        // Verify OTP
        try {
            const otpResult = await verifyOTP(email, otp);

            if (!otpResult.success) {
                return {
                    success: false,
                    error: otpResult.error || translate('auth.invalidOTP')
                };
            }

            // Generate DAT (Deletion Authorization Token)
            const dat = crypto.randomBytes(32).toString('hex');
            const datHash = crypto.createHash('sha256').update(dat).digest('hex');
            const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

            // Store DAT using supabaseAdmin to bypass RLS
            const { error: datError } = await supabaseAdmin
                .from('deletion_authorization_tokens')
                .insert({
                    user_id: userId,
                    token_hash: datHash,
                    device_fingerprint: deviceFingerprint,
                    action: 'ACCOUNT_DELETE',
                    expires_at: expiresAt.toISOString()
                });

            if (datError) {
                logger.error({ err: datError, userId, correlationId }, '[AccountDeletion] Failed to create DAT');
                throw new Error(AUTH.DELETION_AUTH_FAILED);
            }

            // Write audit log
            await this.writeAuditLog(userId, 'DELETION_OTP_VERIFIED', 'USER', userId, {
                correlationId: correlationId
            });

            logger.info({ userId, correlationId }, '[AccountDeletion] OTP verified, DAT generated');

            return {
                success: true,
                authorizationToken: dat,
                expiresAt: expiresAt.toISOString(),
                correlationId
            };

        } catch (error) {
            logger.error({ err: error, userId, correlationId }, '[AccountDeletion] OTP verification failed');
            throw error;
        }
    }

    // =====================================================
    // DELETION CONFIRMATION
    // =====================================================

    /**
     * Confirm immediate deletion
     */
    static async confirmImmediateDeletion(userId, authorizationToken, reason = null, correlationId = null, lang = 'en') {
        correlationId = correlationId || crypto.randomUUID();

        logger.info({ userId, correlationId }, '[AccountDeletion] Confirming immediate deletion');

        // Validate DAT
        const datValid = await this.validateDAT(userId, authorizationToken);
        if (!datValid.valid) {
            return {
                success: false,
                error: AUTH.INVALID_DAT
            };
        }

        // Final eligibility check
        const eligibility = await this.checkEligibility(userId, correlationId);
        if (!eligibility.eligible) {
            return {
                success: false,
                error: AUTH.DELETION_BLOCKED,
                blockingReasons: eligibility.blockingReasons
            };
        }

        try {
            // Get current profile data for anonymization and notification
            const { data: profileData } = await supabase
                .from('profiles')
                .select('email, name')
                .eq('id', userId)
                .single();

            const oldEmail = profileData?.email;
            const userName = profileData?.name;
            // Use consistent anonymized email format (will be overwritten by DeletionJobProcessor anyway)
            const anonymizedHash = crypto.createHash('sha256').update(userId).digest('hex').substring(0, 16);
            const anonymizedEmail = `deleted-${anonymizedHash}@anonymous.local`;

            // Create deletion job using Admin
            const { data: job, error: jobError } = await supabaseAdmin
                .from('account_deletion_jobs')
                .insert({
                    user_id: userId,
                    status: 'PENDING',
                    mode: 'IMMEDIATE',
                    correlation_id: correlationId
                })
                .select()
                .single();

            if (jobError) throw jobError;

            try {
                // Update profile status and anonymize email immediately using Admin to ensure write
                const { error: profileError } = await supabaseAdmin
                    .from('profiles')
                    .update({
                        email: anonymizedEmail,
                        is_deleted: true,
                        deletion_status: 'DELETION_IN_PROGRESS',
                        deletion_requested_at: new Date().toISOString(),
                        deletion_reason: reason
                    })
                    .eq('id', userId);

                if (profileError) throw profileError;
            } catch (profileError) {
                // Compensate for partially-created jobs so users are not stranded in an inconsistent state.
                await supabaseAdmin
                    .from('account_deletion_jobs')
                    .update({
                        status: 'CANCELLED',
                        error_log: [{
                            reason: 'PROFILE_UPDATE_FAILED',
                            message: profileError.message,
                            timestamp: new Date().toISOString()
                        }],
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', job.id);
                throw profileError;
            }

            // Mark DAT as used
            await this.markDATUsed(userId, authorizationToken);

            // Write audit log
            await this.writeAuditLog(userId, 'DELETION_CONFIRMED', 'USER', userId, {
                mode: 'IMMEDIATE',
                correlationId,
                jobId: job.id
            });

            // Send deletion confirmation email after state is durably persisted while still using the captured original email.
            if (oldEmail) {
                emailService.sendAccountDeletedEmail(oldEmail, { name: userName }, { lang }).catch(err =>
                    logger.error({ err, userId }, '[AccountDeletion] Failed to send deletion confirmation email')
                );
            }

            // Trigger async processing (use setImmediate to return immediately)
            setImmediate(async () => {
                try {
                    await DeletionJobProcessor.processJob(job.id);
                } catch (err) {
                    logger.error({ err, jobId: job.id }, '[AccountDeletion] Job processing failed');
                }
            });

            logger.info({ userId, correlationId, jobId: job.id }, '[AccountDeletion] Immediate deletion enqueued');

            return {
                success: true,
                message: AUTH.DELETION_INITIATED,
                jobId: job.id,
                correlationId
            };

        } catch (error) {
            logger.error({ err: error, userId, correlationId }, '[AccountDeletion] Failed to initiate deletion');
            throw error;
        }
    }

    /**
     * Schedule deletion for future date
     */
    static async scheduleDeletion(userId, authorizationToken, days, reason = null, correlationId = null, lang = 'en') {
        correlationId = correlationId || crypto.randomUUID();

        if (![7, 15, 30].includes(days)) {
            return {
                success: false,
                error: AUTH.INVALID_GRACE_PERIOD
            };
        }

        logger.info({ userId, correlationId, days }, '[AccountDeletion] Scheduling deletion');

        // Validate DAT
        const datValid = await this.validateDAT(userId, authorizationToken);
        if (!datValid.valid) {
            return {
                success: false,
                error: AUTH.INVALID_DAT
            };
        }

        // Eligibility check
        const eligibility = await this.checkEligibility(userId, correlationId);
        if (!eligibility.eligible) {
            return {
                success: false,
                error: AUTH.DELETION_BLOCKED,
                blockingReasons: eligibility.blockingReasons
            };
        }

        try {
            const scheduledFor = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

            // Get current profile data for notification
            const { data: profileData } = await supabase
                .from('profiles')
                .select('email, name')
                .eq('id', userId)
                .single();

            const userEmail = profileData?.email;
            const userName = profileData?.name;

            // Create scheduled job via Admin
            const { data: job, error: jobError } = await supabaseAdmin
                .from('account_deletion_jobs')
                .insert({
                    user_id: userId,
                    status: 'PENDING',
                    mode: 'SCHEDULED',
                    scheduled_for: scheduledFor.toISOString(),
                    correlation_id: correlationId
                })
                .select()
                .single();

            if (jobError) throw jobError;

            try {
                // Update profile status via Admin
                const { error: profileError } = await supabaseAdmin
                    .from('profiles')
                    .update({
                        deletion_status: 'PENDING_DELETION',
                        scheduled_deletion_at: scheduledFor.toISOString(),
                        deletion_requested_at: new Date().toISOString(),
                        deletion_reason: reason
                    })
                    .eq('id', userId);

                if (profileError) throw profileError;
            } catch (profileError) {
                await supabaseAdmin
                    .from('account_deletion_jobs')
                    .update({
                        status: 'CANCELLED',
                        error_log: [{
                            reason: 'PROFILE_UPDATE_FAILED',
                            message: profileError.message,
                            timestamp: new Date().toISOString()
                        }],
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', job.id);
                throw profileError;
            }

            // Mark DAT as used
            await this.markDATUsed(userId, authorizationToken);

            // Write audit log
            await this.writeAuditLog(userId, 'DELETION_SCHEDULED', 'USER', userId, {
                mode: 'SCHEDULED',
                days,
                scheduledFor: scheduledFor.toISOString(),
                correlationId,
                jobId: job.id
            });

            if (userEmail) {
                emailService.sendAccountDeletionScheduledEmail(userEmail, { name: userName, scheduledDate: scheduledFor }, { lang }).catch(err =>
                    logger.error({ err, userId }, '[AccountDeletion] Failed to send deletion scheduled email')
                );
            }

            logger.info({ userId, correlationId, jobId: job.id, scheduledFor }, '[AccountDeletion] Deletion scheduled');

            return {
                success: true,
                message: AUTH.DELETION_SCHEDULED,
                jobId: job.id,
                scheduledFor: scheduledFor.toISOString(),
                correlationId
            };

        } catch (error) {
            logger.error({ err: error, userId, correlationId }, '[AccountDeletion] Failed to schedule deletion');
            throw error;
        }
    }

    /**
     * Cancel scheduled deletion
     */
    static async cancelScheduledDeletion(userId, correlationId = null) {
        correlationId = correlationId || crypto.randomUUID();

        logger.info({ userId, correlationId }, '[AccountDeletion] Cancelling scheduled deletion');

        try {
            // Check current status
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('deletion_status')
                .eq('id', userId)
                .single();

            if (profileError) throw profileError;

            if (!['PENDING_DELETION', 'PENDING_DELETION_BLOCKED'].includes(profile?.deletion_status)) {
                return {
                    success: false,
                    error: AUTH.NO_DELETION_TO_CANCEL
                };
            }

            // Update profile via Admin
            const { error: updateError } = await supabaseAdmin
                .from('profiles')
                .update({
                    deletion_status: 'ACTIVE',
                    scheduled_deletion_at: null,
                    deletion_requested_at: null,
                    deletion_reason: null
                })
                .eq('id', userId);

            if (updateError) throw updateError;

            // Cancel pending jobs via Admin
            const { error: jobError } = await supabaseAdmin
                .from('account_deletion_jobs')
                .update({ status: 'CANCELLED', updated_at: new Date().toISOString() })
                .eq('user_id', userId)
                .eq('status', 'PENDING');

            if (jobError) {
                logger.warn({ err: jobError, userId }, '[AccountDeletion] Failed to cancel jobs');
            }

            // Write audit log
            await this.writeAuditLog(userId, 'DELETION_CANCELLED', 'USER', userId, {
                correlationId
            });

            logger.info({ userId, correlationId }, '[AccountDeletion] Scheduled deletion cancelled');

            return {
                success: true,
                message: AUTH.DELETION_CANCELLED,
                correlationId
            };

        } catch (error) {
            logger.error({ err: error, userId, correlationId }, '[AccountDeletion] Failed to cancel deletion');
            throw error;
        }
    }

    // =====================================================
    // HELPER METHODS
    // =====================================================

    /**
     * Validate Deletion Authorization Token
     */
    static async validateDAT(userId, token) {
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        // Use supabaseAdmin to validate secure tokens (though SELECT from client is also allowed by RLS)
        const { data, error } = await supabaseAdmin
            .from('deletion_authorization_tokens')
            .select('*')
            .eq('user_id', userId)
            .eq('token_hash', tokenHash)
            .eq('used', false)
            .gt('expires_at', new Date().toISOString())
            .single();

        if (error || !data) {
            return { valid: false, error: 'Invalid or expired authorization token' };
        }

        return { valid: true, tokenId: data.id };
    }

    /**
     * Mark DAT as used
     */
    static async markDATUsed(userId, token) {
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        await supabaseAdmin
            .from('deletion_authorization_tokens')
            .update({ used: true, used_at: new Date().toISOString() })
            .eq('user_id', userId)
            .eq('token_hash', tokenHash);
    }

    /**
     * Write audit log
     */
    static async writeAuditLog(userId, action, actor, actorId, metadata = {}) {
        const userHash = crypto.createHash('sha256').update(userId).digest('hex');

        try {
            await supabaseAdmin
                .from('account_deletion_audit')
                .insert({
                    user_hash: userHash,
                    action,
                    actor,
                    actor_id: actorId,
                    mode: metadata.mode || null,
                    result: metadata.result || 'SUCCESS',
                    blocking_reasons: metadata.blockingReasons || null,
                    metadata,
                    correlation_id: metadata.correlationId || crypto.randomUUID()
                });
        } catch (error) {
            logger.error({ err: error, userId, action }, '[AccountDeletion] Failed to write audit log');
        }
    }

    /**
     * Get deletion status for user
     */
    static async getDeletionStatus(userId) {
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('deletion_status, scheduled_deletion_at, deletion_requested_at')
            .eq('id', userId)
            .single();

        if (error) throw error;

        const { data: job } = await supabase
            .from('account_deletion_jobs')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        return {
            status: profile?.deletion_status || 'ACTIVE',
            scheduledFor: profile?.scheduled_deletion_at,
            requestedAt: profile?.deletion_requested_at,
            latestJob: job
        };
    }
}

module.exports = AccountDeletionService;
