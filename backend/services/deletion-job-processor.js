const { supabaseAdmin: supabase } = require('../lib/supabase');
const logger = require('../utils/logger');
const crypto = require('crypto');
const emailService = require('./email');
const CustomAuthService = require('./custom-auth.service');

function getAccountDeletionService() {
    return require('./account-deletion.service');
}

/**
 * Deletion Job Processor
 * Handles async execution of account deletion jobs
 */
class DeletionJobProcessor {

    // Deletion steps in order
    static STEPS = [
        'VERIFY_STATUS',
        'REVOKE_SESSIONS',
        'DELETE_CART',
        'DELETE_ADDRESSES',
        'DELETE_NOTIFICATIONS',
        'ANONYMIZE_EVENT_REGISTRATIONS',
        'ANONYMIZE_RETURNS',
        'ANONYMIZE_PUBLIC_CONTENT',
        'ANONYMIZE_ORDERS',
        'ANONYMIZE_DONATIONS',
        'DELETE_INVOICE_FILES',
        'ANONYMIZE_INVOICES',
        'ANONYMIZE_CONTACT_MESSAGES',
        'ANONYMIZE_COUPON_USAGE',
        'ANONYMIZE_AUDIT_LOGS',
        'DELETE_STORAGE',
        'DELETE_PROFILE',
        'DELETE_AUTH_USER',
        'WRITE_AUDIT'
    ];

    /**
     * Process a deletion job
     */
    static async processJob(jobId) {
        const correlationId = crypto.randomUUID();
        logger.info({ jobId, correlationId }, '[DeletionJob] Starting job processing');

        let job = null;
        let userId = null;

        try {
            // 1. Claim the job
            const { data: claimedJob, error: claimError } = await supabase
                .from('account_deletion_jobs')
                .update({
                    status: 'IN_PROGRESS',
                    started_at: new Date().toISOString(),
                    current_step: 'LOCK_USER'
                })
                .eq('id', jobId)
                .eq('status', 'PENDING')
                .select()
                .single();

            if (claimError || !claimedJob) {
                if (claimError) {
                    logger.error({ jobId, err: claimError }, '[DeletionJob] Error claiming job');
                    throw claimError;
                }
                logger.warn({ jobId }, '[DeletionJob] Job already claimed or not found');
                return { success: false, error: 'Job already claimed or not found' };
            }

            job = claimedJob;
            userId = job.user_id;

            logger.info({ jobId, userId, correlationId }, '[DeletionJob] Job claimed, starting deletion');

            // 2. Get user profile
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (profileError || !profile) {
                throw new Error('User profile not found');
            }

            // 3. Verify status is DELETION_IN_PROGRESS
            if (profile.deletion_status !== 'DELETION_IN_PROGRESS') {
                await this.updateJobStep(jobId, 'VERIFY_STATUS', false, 'Invalid deletion status');
                throw new Error(`Invalid deletion status: ${profile.deletion_status}`);
            }

            await this.updateJobStep(jobId, 'VERIFY_STATUS', true);
            job.current_step = 'VERIFY_STATUS';

            // 4. Execute deletion steps
            await this.revokeAllSessions(jobId, userId);
            job.current_step = 'REVOKE_SESSIONS';

            await this.deleteCart(jobId, userId);
            job.current_step = 'DELETE_CART';

            await this.deleteAddresses(jobId, userId);
            job.current_step = 'DELETE_ADDRESSES';

            await this.deleteNotifications(jobId, userId);
            job.current_step = 'DELETE_NOTIFICATIONS';

            await this.anonymizeEventRegistrations(jobId, userId);
            job.current_step = 'ANONYMIZE_EVENT_REGISTRATIONS';

            await this.anonymizeOrders(jobId, userId, profile);
            job.current_step = 'ANONYMIZE_ORDERS';

            await this.anonymizeReturns(jobId, userId);
            job.current_step = 'ANONYMIZE_RETURNS';

            await this.anonymizePublicContent(jobId, userId);
            job.current_step = 'ANONYMIZE_PUBLIC_CONTENT';

            await this.anonymizeDonations(jobId, userId, profile);
            job.current_step = 'ANONYMIZE_DONATIONS';

            await this.deleteInvoiceFiles(jobId, userId);
            job.current_step = 'DELETE_INVOICE_FILES';

            await this.anonymizeInvoices(jobId, userId);
            job.current_step = 'ANONYMIZE_INVOICES';

            await this.anonymizeContactMessages(jobId, userId, profile);
            job.current_step = 'ANONYMIZE_CONTACT_MESSAGES';

            await this.anonymizeCouponUsage(jobId, userId);
            job.current_step = 'ANONYMIZE_COUPON_USAGE';

            await this.anonymizeAuditLogs(jobId, userId);
            job.current_step = 'ANONYMIZE_AUDIT_LOGS';

            await this.deleteStorageAssets(jobId, userId);
            job.current_step = 'DELETE_STORAGE';

            // FINAL CHECKS before permanent destruction
            if (await this.isJobCancelled(jobId)) {
                logger.info({ jobId, userId }, '[DeletionJob] Job cancelled during processing, stopping before profile deletion');
                return { success: false, error: 'Job cancelled by user' };
            }

            await this.deleteProfile(jobId, userId, profile);
            job.current_step = 'DELETE_PROFILE';

            await this.deleteAuthUser(jobId, userId);
            job.current_step = 'DELETE_AUTH_USER';

            // 5. Send final confirmation email for SCHEDULED deletions
            // (IMMEDIATE deletions send it in the service before anonymization)
            if (job.mode === 'SCHEDULED' && profile.email) {
                await emailService.sendAccountDeletedEmail(profile.email, { name: profile.name }).catch(err =>
                    logger.error({ err, userId }, '[DeletionJob] Failed to send final deletion email')
                );
            }

            await this.writeCompletionAudit(jobId, userId, correlationId);

            // 5. Mark job as completed
            const { error: completionError } = await supabase
                .from('account_deletion_jobs')
                .update({
                    status: 'COMPLETED',
                    completed_at: new Date().toISOString(),
                    current_step: null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', jobId);

            if (completionError) throw completionError;

            logger.info({ jobId, userId, correlationId }, '[DeletionJob] Job completed successfully');

            return { success: true, jobId, correlationId };

        } catch (error) {
            logger.error({ err: error, jobId, userId, correlationId }, '[DeletionJob] Job failed');

            // Update job with error
            if (job) {
                // Use current_step track variable if available, fallback to job.current_step
                // We will rely on manual updates to job.current_step in processJob
                const step = job.current_step;

                const errorLog = job.error_log || [];
                errorLog.push({
                    step: step,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });

                await supabase
                    .from('account_deletion_jobs')
                    .update({
                        status: 'FAILED',
                        error_log: errorLog,
                        retry_count: (job.retry_count || 0) + 1,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', jobId);
            }

            return { success: false, error: error.message, jobId, correlationId };
        }
    }

    /**
     * Update job step status
     */
    static async updateJobStep(jobId, step, success, error = null) {
        const { data: job, error: fetchError } = await supabase
            .from('account_deletion_jobs')
            .select('steps_completed')
            .eq('id', jobId)
            .single();

        if (fetchError) {
            logger.error({ err: fetchError, jobId }, '[DeletionJob] Failed to fetch job for step update');
            return;
        }

        const stepsCompleted = job?.steps_completed || [];
        if (success) {
            stepsCompleted.push({ step, completedAt: new Date().toISOString() });
        }

        const { error: updateError } = await supabase
            .from('account_deletion_jobs')
            .update({
                current_step: success ? null : step,
                steps_completed: stepsCompleted,
                updated_at: new Date().toISOString()
            })
            .eq('id', jobId);

        if (updateError) {
            logger.error({ err: updateError, jobId }, '[DeletionJob] Failed to update job step');
        }
    }

    /**
     * Check if job has been cancelled
     */
    static async isJobCancelled(jobId) {
        const { data: job, error } = await supabase
            .from('account_deletion_jobs')
            .select('status')
            .eq('id', jobId)
            .single();

        if (error) {
            logger.error({ err: error, jobId }, '[DeletionJob] Error checking cancellation');
            return false;
        }

        return job?.status === 'CANCELLED';
    }

    // =====================================================
    // DELETION STEP IMPLEMENTATIONS
    // =====================================================

    /**
     * Revoke all user sessions and tokens
     */
    static async revokeAllSessions(jobId, userId) {
        logger.info({ jobId, userId }, '[DeletionJob] Revoking sessions');
        await this.updateJobStep(jobId, 'REVOKE_SESSIONS', false);

        try {
            // Delete refresh tokens
            const { error: error1 } = await supabase
                .from('app_refresh_tokens')
                .delete()
                .eq('user_id', userId);
            if (error1) throw error1;

            // Delete OTPs
            const { error: error2 } = await supabase
                .from('otp_codes')
                .delete()
                .eq('identifier', userId);
            if (error2) throw error2;

            // Delete DATs
            const { error: error3 } = await supabase
                .from('deletion_authorization_tokens')
                .delete()
                .eq('user_id', userId);
            if (error3) throw error3;

            await this.updateJobStep(jobId, 'REVOKE_SESSIONS', true);
        } catch (error) {
            logger.error({ err: error, userId }, '[DeletionJob] Error revoking sessions');
            throw error;
        }
    }

    /**
     * Delete cart data
     */
    static async deleteCart(jobId, userId) {
        logger.info({ jobId, userId }, '[DeletionJob] Deleting cart');
        await this.updateJobStep(jobId, 'DELETE_CART', false);

        try {
            const { data: cart, error: cartFetchError } = await supabase
                .from('carts')
                .select('id')
                .eq('user_id', userId)
                .maybeSingle();
            if (cartFetchError) throw cartFetchError;

            if (cart?.id) {
                const { error: error1 } = await supabase
                    .from('cart_items')
                    .delete()
                    .eq('cart_id', cart.id);
                if (error1) throw error1;

                const { error: error2 } = await supabase
                    .from('carts')
                    .delete()
                    .eq('id', cart.id);
                if (error2) throw error2;
            }

            await this.updateJobStep(jobId, 'DELETE_CART', true);
        } catch (error) {
            logger.error({ err: error, userId }, '[DeletionJob] Error deleting cart');
            throw error;
        }
    }

    /**
     * Delete addresses and phone numbers
     */
    static async deleteAddresses(jobId, userId) {
        logger.info({ jobId, userId }, '[DeletionJob] Deleting addresses');
        await this.updateJobStep(jobId, 'DELETE_ADDRESSES', false);

        try {
            const { error: error1 } = await supabase.from('phone_numbers').delete().eq('user_id', userId);
            if (error1) throw error1;

            const { error: error2 } = await supabase.from('addresses').delete().eq('user_id', userId);
            if (error2) throw error2;

            await this.updateJobStep(jobId, 'DELETE_ADDRESSES', true);
        } catch (error) {
            logger.error({ err: error, userId }, '[DeletionJob] Error deleting addresses');
            throw error;
        }
    }

    /**
     * Delete notifications
     */
    static async deleteNotifications(jobId, userId) {
        logger.info({ jobId, userId }, '[DeletionJob] Deleting notifications');
        await this.updateJobStep(jobId, 'DELETE_NOTIFICATIONS', false);

        try {
            // order_notifications tracks admin recipients, not customer accounts.
            const { error: error1 } = await supabase.from('order_notifications').delete().eq('admin_id', userId);
            if (error1) throw error1;

            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('email')
                .eq('id', userId)
                .single();
            if (profileError) throw profileError;

            const { error: error2 } = await supabase
                .from('newsletter_subscribers')
                .delete()
                .eq('email', profile?.email || '__missing__');
            if (error2) throw error2;

            await this.updateJobStep(jobId, 'DELETE_NOTIFICATIONS', true);
        } catch (error) {
            logger.error({ err: error, userId }, '[DeletionJob] Error deleting notifications');
            throw error;
        }
    }

    /**
     * Anonymize event registrations (non-financial)
     */
    static async anonymizeEventRegistrations(jobId, userId) {
        logger.info({ jobId, userId }, '[DeletionJob] Anonymizing event registrations');
        await this.updateJobStep(jobId, 'ANONYMIZE_EVENT_REGISTRATIONS', false);

        try {
            // Anonymize rather than delete for audit purposes
            const anonymizedName = 'Deleted User';
            const anonymizedEmail = `deleted-${crypto.randomBytes(8).toString('hex')}@anonymous.local`;

            const { error } = await supabase
                .from('event_registrations')
                .update({
                    full_name: anonymizedName,
                    email: anonymizedEmail,
                    phone: null,
                    user_id: null
                })
                .eq('user_id', userId);

            if (error) throw error;

            await this.updateJobStep(jobId, 'ANONYMIZE_EVENT_REGISTRATIONS', true);
        } catch (error) {
            logger.error({ err: error, userId }, '[DeletionJob] Error anonymizing registrations');
            throw error;
        }
    }

    /**
     * Anonymize orders (keep for legal/tax purposes)
     */
    static async anonymizeOrders(jobId, userId, profile) {
        logger.info({ jobId, userId }, '[DeletionJob] Anonymizing orders');
        await this.updateJobStep(jobId, 'ANONYMIZE_ORDERS', false);

        try {
            const anonymizedHash = crypto.createHash('sha256').update(userId).digest('hex').substring(0, 16);

            const { error: error1 } = await supabase
                .from('orders')
                .update({
                    customer_name: 'Deleted User',
                    customer_email: `deleted-${anonymizedHash}@anonymous.local`,
                    customer_phone: null,
                    shipping_address_id: null,
                    billing_address_id: null,
                    shipping_address: { anonymized: true, reason: 'GDPR/Account Deletion' },
                    user_id: null // Disconnect from profile
                })
                .eq('user_id', userId);

            if (error1) throw error1;

            // Also nullify order_status_history to prevent FK constraint issues
            const { error: error2 } = await supabase
                .from('order_status_history')
                .update({ updated_by: null })
                .eq('updated_by', userId);

            if (error2) throw error2;

            await this.updateJobStep(jobId, 'ANONYMIZE_ORDERS', true);
        } catch (error) {
            logger.error({ err: error, userId }, '[DeletionJob] Error anonymizing orders');
            throw error;
        }
    }

    /**
     * Anonymize returns
     */
    static async anonymizeReturns(jobId, userId) {
        logger.info({ jobId, userId }, '[DeletionJob] Anonymizing returns');
        await this.updateJobStep(jobId, 'ANONYMIZE_RETURNS', false);

        try {
            // Nullify user_id in returns to allow deletion
            const { error } = await supabase
                .from('returns')
                .update({ user_id: null })
                .eq('user_id', userId);

            if (error) throw error;

            await this.updateJobStep(jobId, 'ANONYMIZE_RETURNS', true);
        } catch (error) {
            logger.error({ err: error, userId }, '[DeletionJob] Error anonymizing returns');
            throw error;
        }
    }

    /**
     * Anonymize donations (keep for legal/tax purposes)
     */
    static async anonymizeDonations(jobId, userId, profile) {
        logger.info({ jobId, userId }, '[DeletionJob] Anonymizing donations');
        await this.updateJobStep(jobId, 'ANONYMIZE_DONATIONS', false);

        try {
            const anonymizedHash = crypto.createHash('sha256').update(userId).digest('hex').substring(0, 16);

            // Anonymize one-time donations
            const { error: error1 } = await supabase
                .from('donations')
                .update({
                    donor_name: 'Deleted User',
                    donor_email: `deleted-${anonymizedHash}@anonymous.local`,
                    donor_phone: null,
                    is_anonymous: true,
                    user_id: null
                })
                .eq('user_id', userId);

            if (error1) throw error1;

            // Anonymize subscriptions
            const { error: error2 } = await supabase
                .from('donation_subscriptions')
                .update({
                    donor_name: 'Deleted User',
                    donor_email: `deleted-${anonymizedHash}@anonymous.local`,
                    donor_phone: null,
                    user_id: null
                })
                .eq('user_id', userId);

            if (error2) throw error2;

            await this.updateJobStep(jobId, 'ANONYMIZE_DONATIONS', true);
        } catch (error) {
            logger.error({ err: error, userId }, '[DeletionJob] Error anonymizing donations');
            throw error;
        }
    }

    /**
     * Anonymize public content (reviews, testimonials, comments)
     */
    static async anonymizePublicContent(jobId, userId) {
        logger.info({ jobId, userId }, '[DeletionJob] Anonymizing public content');
        await this.updateJobStep(jobId, 'ANONYMIZE_PUBLIC_CONTENT', false);

        try {
            const { error: error1 } = await supabase.from('testimonials').update({
                user_id: null,
                name: 'Deleted User',
                email: null
            }).eq('user_id', userId);
            if (error1) throw error1;

            const { error: error2 } = await supabase.from('reviews').update({ user_id: null }).eq('user_id', userId);
            if (error2) throw error2;

            const { error: error3 } = await supabase.from('comments').update({ user_id: null }).eq('user_id', userId);
            if (error3) throw error3;

            const { error: error4 } = await supabase.from('email_notifications').delete().eq('user_id', userId);
            if (error4) throw error4;

            await this.updateJobStep(jobId, 'ANONYMIZE_PUBLIC_CONTENT', true);
        } catch (error) {
            logger.error({ err: error, userId }, '[DeletionJob] Error anonymizing public content');
            throw error;
        }
    }

    /**
     * Delete physical invoice local/cloud files
     */
    static async deleteInvoiceFiles(jobId, userId) {
        logger.info({ jobId, userId }, '[DeletionJob] Deleting invoice files');
        await this.updateJobStep(jobId, 'DELETE_INVOICE_FILES', false);

        try {
            // Find all orders for this user to locate related invoices
            const { data: orders, error: orderError } = await supabase
                .from('orders')
                .select('id')
                .eq('user_id', userId);

            if (orderError) throw orderError;

            if (orders && orders.length > 0) {
                const orderIds = orders.map(o => o.id);
                // Invoices are likely linked by order_id
                const { data: invoices, error: invError } = await supabase
                    .from('invoices')
                    .select('file_path')
                    .in('order_id', orderIds)
                    .not('file_path', 'is', null);

                if (invError) throw invError;

                if (invoices && invoices.length > 0) {
                    const filePaths = invoices.map(i => i.file_path);
                    const { error: removeError } = await supabase.storage.from('invoices').remove(filePaths);
                    // It's acceptable if the files are already gone, we just log and proceed
                    if (removeError) {
                        logger.warn({ err: removeError, userId }, '[DeletionJob] Warning while deleting physical invoice files');
                    }
                }
            }

            await this.updateJobStep(jobId, 'DELETE_INVOICE_FILES', true);
        } catch (error) {
            logger.error({ err: error, userId }, '[DeletionJob] Error deleting invoice files');
            throw error;
        }
    }

    /**
     * Anonymize invoice database records
     */
    static async anonymizeInvoices(jobId, userId) {
        logger.info({ jobId, userId }, '[DeletionJob] Anonymizing invoices');
        await this.updateJobStep(jobId, 'ANONYMIZE_INVOICES', false);

        try {
            const { data: orders, error: orderError } = await supabase
                .from('orders')
                .select('id')
                .eq('user_id', userId);

            if (orderError) throw orderError;

            if (orders && orders.length > 0) {
                const orderIds = orders.map(o => o.id);
                const { error: updateError } = await supabase
                    .from('invoices')
                    .update({
                        file_path: null,
                        public_url: null,
                    })
                    .in('order_id', orderIds);

                if (updateError) throw updateError;
            }

            await this.updateJobStep(jobId, 'ANONYMIZE_INVOICES', true);
        } catch (error) {
            logger.error({ err: error, userId }, '[DeletionJob] Error anonymizing invoices');
            throw error;
        }
    }

    /**
     * Anonymize Contact form submissions based on user's email
     */
    static async anonymizeContactMessages(jobId, userId, profile) {
        logger.info({ jobId, userId }, '[DeletionJob] Anonymizing contact messages');
        await this.updateJobStep(jobId, 'ANONYMIZE_CONTACT_MESSAGES', false);

        try {
            const anonymizedHash = crypto.createHash('sha256').update(userId).digest('hex').substring(0, 16);
            if (profile && profile.email) {
                const { error: updateError } = await supabase
                    .from('contact_messages')
                    .update({
                        name: 'Deleted User',
                        email: `deleted-${anonymizedHash}@anonymous.local`,
                        ip_address: null,
                        user_agent: null,
                    })
                    .eq('email', profile.email);

                if (updateError) throw updateError;
            }

            await this.updateJobStep(jobId, 'ANONYMIZE_CONTACT_MESSAGES', true);
        } catch (error) {
            logger.error({ err: error, userId }, '[DeletionJob] Error anonymizing contact messages');
            throw error;
        }
    }

    /**
     * Disconnect coupon usage history from the user profile
     */
    static async anonymizeCouponUsage(jobId, userId) {
        logger.info({ jobId, userId }, '[DeletionJob] Anonymizing coupon usage');
        await this.updateJobStep(jobId, 'ANONYMIZE_COUPON_USAGE', false);

        try {
            const { error: updateError } = await supabase
                .from('coupon_usage')
                .update({ user_id: null })
                .eq('user_id', userId);

            // Supabase returns an error for tables that don't exist yet in a given environment, suppress specific "relation does not exist" errors
            if (updateError && updateError.code !== '42P01') throw updateError;

            await this.updateJobStep(jobId, 'ANONYMIZE_COUPON_USAGE', true);
        } catch (error) {
            logger.error({ err: error, userId }, '[DeletionJob] Error anonymizing coupon usage');
            throw error;
        }
    }

    /**
     * Remove tracking of user in generic audit logs
     */
    static async anonymizeAuditLogs(jobId, userId) {
        logger.info({ jobId, userId }, '[DeletionJob] Anonymizing audit logs');
        await this.updateJobStep(jobId, 'ANONYMIZE_AUDIT_LOGS', false);

        try {
            const { error: updateError } = await supabase
                .from('audit_logs')
                .update({ actor_id: null })
                .eq('actor_id', userId);

            // Ignore table missing errors just in case
            if (updateError && updateError.code !== '42P01') throw updateError;

            await this.updateJobStep(jobId, 'ANONYMIZE_AUDIT_LOGS', true);
        } catch (error) {
            logger.error({ err: error, userId }, '[DeletionJob] Error anonymizing audit logs');
            throw error;
        }
    }

    static async deleteStorageAssets(jobId, userId) {
        logger.info({ jobId, userId }, '[DeletionJob] Deleting storage assets');
        await this.updateJobStep(jobId, 'DELETE_STORAGE', false);

        try {
            const { data: uploads, error: uploadError } = await supabase
                .from('photos')
                .select('bucket_name, image_path')
                .eq('user_id', userId)
                .in('bucket_name', ['profiles', 'testimonial-user']);

            if (uploadError && uploadError.code !== '42P01') throw uploadError;

            const uploadsByBucket = new Map();
            for (const upload of uploads || []) {
                if (!upload.bucket_name || !upload.image_path) continue;
                if (!uploadsByBucket.has(upload.bucket_name)) {
                    uploadsByBucket.set(upload.bucket_name, []);
                }
                uploadsByBucket.get(upload.bucket_name).push(upload.image_path);
            }

            for (const [bucketName, filePaths] of uploadsByBucket.entries()) {
                const { error: removeError } = await supabase.storage.from(bucketName).remove(filePaths);
                if (removeError) throw removeError;
            }

            if (uploads && uploads.length > 0) {
                const { error: cleanupError } = await supabase
                    .from('photos')
                    .delete()
                    .eq('user_id', userId)
                    .in('bucket_name', ['profiles', 'testimonial-user']);
                if (cleanupError && cleanupError.code !== '42P01') throw cleanupError;
            }

            await this.updateJobStep(jobId, 'DELETE_STORAGE', true);
        } catch (error) {
            logger.error({ err: error, userId }, '[DeletionJob] Error deleting storage');
            throw error;
        }
    }

    /**
     * Delete or anonymize profile
     */
    static async deleteProfile(jobId, userId, profile) {
        logger.info({ jobId, userId }, '[DeletionJob] Deleting profile');
        await this.updateJobStep(jobId, 'DELETE_PROFILE', false);

        try {
            // Option A: Hard delete profile
            // await supabase.from('profiles').delete().eq('id', userId);

            // Option B: Anonymize and mark as DELETED (preserves referential integrity)
            const anonymizedHash = crypto.createHash('sha256').update(userId).digest('hex').substring(0, 16);

            const { error } = await supabase
                .from('profiles')
                .update({
                    email: `deleted-${anonymizedHash}@anonymous.local`,
                    name: 'Deleted User',
                    first_name: 'Deleted',
                    last_name: 'User',
                    phone: null,
                    avatar_url: null,
                    deletion_status: 'DELETED',
                    is_deleted: true,
                    deleted_at: new Date().toISOString()
                })
                .eq('id', userId);

            if (error) throw error;

            await this.updateJobStep(jobId, 'DELETE_PROFILE', true);
        } catch (error) {
            logger.error({ err: error, userId }, '[DeletionJob] Error deleting profile');
            throw error;
        }
    }

    /**
     * Delete user from Supabase Auth (Hard Delete)
     * This allows users (especially Google OAuth) to re-register with the same email/identity
     */
    static async deleteAuthUser(jobId, userId) {
        logger.info({ jobId, userId }, '[DeletionJob] Deleting custom auth artifacts');
        await this.updateJobStep(jobId, 'DELETE_AUTH_USER', false);

        try {
            await CustomAuthService.deleteAuthArtifacts(userId);
            logger.info({ userId }, '[DeletionJob] Custom auth artifacts deleted');
            await this.updateJobStep(jobId, 'DELETE_AUTH_USER', true);
        } catch (error) {
            logger.error({ err: error, userId }, '[DeletionJob] Failed to delete custom auth artifacts');
            throw error;
        }
    }

    /**
     * Write final audit log
     */
    static async writeCompletionAudit(jobId, userId, correlationId) {
        logger.info({ jobId, userId }, '[DeletionJob] Writing audit log');
        await this.updateJobStep(jobId, 'WRITE_AUDIT', false);

        try {
            const userHash = crypto.createHash('sha256').update(userId).digest('hex');

            const { error: auditError } = await supabase
                .from('account_deletion_audit')
                .insert({
                    user_hash: userHash,
                    action: 'ACCOUNT_DELETED',
                    actor: 'SYSTEM',
                    actor_id: null,
                    result: 'SUCCESS',
                    metadata: { jobId, completedAt: new Date().toISOString() },
                    correlation_id: correlationId
                });

            if (auditError) throw auditError;

            await this.updateJobStep(jobId, 'WRITE_AUDIT', true);
        } catch (error) {
            logger.error({ err: error, userId }, '[DeletionJob] Error writing audit');
            throw error;
        }
    }

    static async markJobFailed(jobId, reason, details = {}) {
        const errorLogEntry = {
            reason,
            ...details,
            timestamp: new Date().toISOString()
        };

        const { data: job, error: fetchError } = await supabase
            .from('account_deletion_jobs')
            .select('error_log, retry_count')
            .eq('id', jobId)
            .single();

        if (fetchError) {
            logger.error({ err: fetchError, jobId, reason }, '[DeletionJob] Failed to fetch job for failure update');
            return;
        }

        await supabase
            .from('account_deletion_jobs')
            .update({
                status: 'FAILED',
                error_log: [...(job?.error_log || []), errorLogEntry],
                retry_count: job?.retry_count || 0,
                updated_at: new Date().toISOString()
            })
            .eq('id', jobId);
    }

    /**
     * Process scheduled deletions (called by cron)
     */
    static async processScheduledDeletions() {
        const correlationId = crypto.randomUUID();
        logger.info({ correlationId }, '[DeletionJob] Processing scheduled deletions');

        try {
            // Find pending or blocked jobs that are ready to be reconciled by the background worker.
            const { data: candidateJobs, error } = await supabase
                .from('account_deletion_jobs')
                .select('*, profiles!inner(id, deletion_status)')
                .in('status', ['PENDING', 'BLOCKED']);

            if (error) throw error;

            const nowIso = new Date().toISOString();
            const dueJobs = (candidateJobs || []).filter(job => {
                if (job.mode === 'IMMEDIATE') return true;
                if (job.mode !== 'SCHEDULED') return false;
                return Boolean(job.scheduled_for) && job.scheduled_for <= nowIso;
            });

            logger.info({ count: dueJobs?.length || 0, correlationId }, '[DeletionJob] Found due scheduled jobs');

            for (const job of dueJobs || []) {
                try {
                    const profileStatus = job.profiles?.deletion_status;

                    if (job.mode === 'IMMEDIATE' && profileStatus !== 'DELETION_IN_PROGRESS') {
                        await this.markJobFailed(job.id, 'INCONSISTENT_PROFILE_STATE', {
                            message: `Immediate deletion job requires DELETION_IN_PROGRESS profile state, found ${profileStatus || 'UNKNOWN'}`,
                            profileStatus: profileStatus || null
                        });
                        logger.warn({ jobId: job.id, userId: job.user_id, profileStatus }, '[DeletionJob] Immediate job skipped due to inconsistent profile state');
                        continue;
                    }

                    if (
                        job.mode === 'SCHEDULED' &&
                        !['PENDING_DELETION', 'PENDING_DELETION_BLOCKED', 'DELETION_IN_PROGRESS'].includes(profileStatus)
                    ) {
                        await this.markJobFailed(job.id, 'INCONSISTENT_PROFILE_STATE', {
                            message: `Scheduled deletion job requires pending deletion profile state, found ${profileStatus || 'UNKNOWN'}`,
                            profileStatus: profileStatus || null
                        });
                        logger.warn({ jobId: job.id, userId: job.user_id, profileStatus }, '[DeletionJob] Scheduled job skipped due to inconsistent profile state');
                        continue;
                    }

                    // Re-check eligibility
                    const eligibility = await getAccountDeletionService().checkEligibility(job.user_id);

                    if (!eligibility.eligible) {
                        // Update status to PENDING_DELETION_BLOCKED
                        const { error: profileError } = await supabase
                            .from('profiles')
                            .update({ deletion_status: 'PENDING_DELETION_BLOCKED' })
                            .eq('id', job.user_id);
                        if (profileError) throw profileError;

                        const { error: jobUpdateError } = await supabase
                            .from('account_deletion_jobs')
                            .update({
                                status: 'BLOCKED',
                                error_log: [{ reason: 'ELIGIBILITY_FAILED', blockers: eligibility.blockingReasons }]
                            })
                            .eq('id', job.id);
                        if (jobUpdateError) throw jobUpdateError;

                        logger.info({ jobId: job.id, userId: job.user_id }, '[DeletionJob] Scheduled deletion blocked');
                        continue;
                    }

                    // Restore blocked jobs to a claimable state before processing.
                    if (job.status === 'BLOCKED') {
                        const { error: resetError } = await supabase
                            .from('account_deletion_jobs')
                            .update({
                                status: 'PENDING',
                                updated_at: new Date().toISOString()
                            })
                            .eq('id', job.id);
                        if (resetError) throw resetError;
                    }

                    // Update status and process
                    const { error: processStatusError } = await supabase
                        .from('profiles')
                        .update({ deletion_status: 'DELETION_IN_PROGRESS' })
                        .eq('id', job.user_id);
                    if (processStatusError) throw processStatusError;

                    await this.processJob(job.id);

                } catch (jobError) {
                    logger.error({ err: jobError, jobId: job.id }, '[DeletionJob] Error processing scheduled job');
                }
            }

            return { success: true, processed: dueJobs?.length || 0 };

        } catch (error) {
            logger.error({ err: error, correlationId }, '[DeletionJob] Failed to process scheduled deletions');
            throw error;
        }
    }

    /**
     * Automatically retry failed deletion jobs with basic linear delay backoff.
     */
    static async retryFailedJobs() {
        const correlationId = crypto.randomUUID();
        logger.info({ correlationId }, '[DeletionJob] Retrying failed deletions');
        let processed = 0, successful = 0, failed = 0;

        try {
            // Find failed jobs that haven't exceeded maximum retry attempts (e.g. 5)
            // Assuming we wait at least 2 hours before retrying a newly failed job.
            const timeThreshold = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

            const { data: failedJobs, error } = await supabase
                .from('account_deletion_jobs')
                .select('*')
                .eq('status', 'FAILED')
                .lt('retry_count', 5)
                .lte('updated_at', timeThreshold);

            if (error) throw error;

            if (!failedJobs || failedJobs.length === 0) {
                return { processed: 0, successful: 0, failed: 0 };
            }

            logger.info({ count: failedJobs.length, correlationId }, '[DeletionJob] Found failed jobs for retry');

            for (const job of failedJobs) {
                processed++;
                try {
                    const { error: profileResetError } = await supabase
                        .from('profiles')
                        .update({ deletion_status: 'DELETION_IN_PROGRESS' })
                        .eq('id', job.user_id);

                    if (profileResetError) throw profileResetError;

                    // Reset job status to pending to allow the processor to pick it up again
                    const { error: resetError } = await supabase
                        .from('account_deletion_jobs')
                        .update({
                            status: 'PENDING',
                            current_step: job.current_step // Restart from where it left off, if possible.
                        })
                        .eq('id', job.id);

                    if (resetError) throw resetError;

                    // Trigger process job asynchronously 
                    await this.processJob(job.id);
                    successful++;
                } catch (jobError) {
                    logger.error({ err: jobError, jobId: job.id }, '[DeletionJob] Failed to retry job');
                    failed++;
                }
            }
            return { processed, successful, failed };
        } catch (error) {
            logger.error({ err: error, correlationId }, '[DeletionJob] Failed to run retryFailedJobs');
            throw error;
        }
    }
}

module.exports = { DeletionJobProcessor };
