const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const emailService = require('./email');

/**
 * Service to handle email retries for failed notifications
 */
class EmailRetryService {
    /**
     * Process failed emails that are eligible for retry
     * @param {number} batchSize - Number of emails to process
     */
    static async processFailedEmails(batchSize = 20) {
        logger.info('Starting failed email retry process...');

        try {
            // 1. Fetch eligible failed emails
            // Status is FAILED, retry_count < max_retries
            // Optionally check for next_retry_at if implemented, but simple count check is often enough for basic backoff
            const { data: failedEmails, error } = await supabase
                .from('email_notifications')
                .select('*')
                .eq('status', 'FAILED')
                .lt('retry_count', 3) // Hardcoded max retries or fetch from config
                .order('created_at', { ascending: true })
                .limit(batchSize);

            if (error) throw error;

            if (!failedEmails || failedEmails.length === 0) {
                logger.info('No failed emails pending retry.');
                return { processed: 0, successful: 0 };
            }

            logger.info(`Found ${failedEmails.length} failed emails to retry.`);

            let successful = 0;

            for (const emailRecord of failedEmails) {
                try {
                    // Exponential backoff check
                    // Retry 1: immediatley or after 5 mins?
                    // Retry 2: 15 mins
                    // Retry 3: 1 hour
                    // For now, we process all found ones but we could add time check

                    const emailType = emailRecord.email_type;
                    const recipient = emailRecord.recipient_email;
                    const templateData = emailRecord.metadata?.template_data;

                    logger.info({ emailId: emailRecord.id }, `Retrying email: ${emailType} to ${recipient}`);

                    if (!templateData) {
                        logger.warn(`Email record ${emailRecord.id} has no template data. Cannot retry.`);
                        await this._markAsPermanentFail(emailRecord.id, 'Missing template data');
                        continue;
                    }

                    // Attempt send using the unified email service
                    await emailService.send(
                        emailType,
                        recipient,
                        templateData,
                        { userId: emailRecord.user_id }
                    );

                    // If send throws, it's caught below. If it succeeds:
                    await supabase
                        .from('email_notifications')
                        .update({
                            status: 'SENT', // MUST be SENT, FAILED or PERMANENTLY_FAILED per constraint
                            retry_count: emailRecord.retry_count + 1,
                            updated_at: new Date().toISOString(),
                            metadata: {
                                ...emailRecord.metadata,
                                retried_at: new Date().toISOString(),
                                original_status: 'FAILED'
                            }
                        })
                        .eq('id', emailRecord.id);

                    successful++;

                } catch (retryError) {
                    logger.error({ err: retryError, emailId: emailRecord.id }, 'Retry attempt failed');

                    // Increment count, keep status as FAILED so it picks up again (until max)
                    // If max reached, mark PERMANENT_FAIL
                    const newCount = (emailRecord.retry_count || 0) + 1;
                    const newStatus = 'FAILED'; // Stick to allowed statuses

                    await supabase
                        .from('email_notifications')
                        .update({
                            status: newStatus,
                            retry_count: newCount,
                            error_message: retryError.message,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', emailRecord.id);
                }
            }

            logger.info(`Retry process completed. Processed: ${failedEmails.length}, Successful: ${successful}`);
            return { processed: failedEmails.length, successful };

        } catch (error) {
            logger.error({ err: error }, 'Fatal error in EmailRetryService');
            throw error;
        }
    }

    /**
     * Alias for processFailedEmails to match scheduler expectation
     */
    static async processRetryQueue(batchSize = 20) {
        return this.processFailedEmails(batchSize);
    }

    /**
     * Get statistics about email notifications and retry counts
     */
    static async getRetryStats() {
        try {
            const { data, error } = await supabase
                .from('email_notifications')
                .select('status, id', { count: 'exact' });

            if (error) throw error;

            const stats = data.reduce((acc, curr) => {
                acc[curr.status] = (acc[curr.status] || 0) + 1;
                return acc;
            }, {});

            return stats;
        } catch (error) {
            logger.error({ err: error }, 'Error fetching email retry stats');
            return {};
        }
    }

    /**
     * Retry a specific failed email by ID
     * @param {string} id - Email notification ID
     */
    static async retryEmail(id) {
        logger.info({ emailId: id }, 'Manually triggering retry for specific email');

        try {
            const { data: emailRecord, error } = await supabase
                .from('email_notifications')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;
            if (!emailRecord) throw new Error('Email notification not found');

            const emailType = emailRecord.email_type;
            const recipient = emailRecord.recipient_email;
            const templateData = emailRecord.metadata?.template_data;

            if (!templateData) {
                const errorMsg = 'Missing template data for manual retry';
                await this._markAsPermanentFail(id, errorMsg);
                throw new Error(errorMsg);
            }

            // Attempt send
            await emailService.send(
                emailType,
                recipient,
                templateData,
                { userId: emailRecord.user_id }
            );

            // Update status on success
            await supabase
                .from('email_notifications')
                .update({
                    status: 'SENT',
                    retry_count: (emailRecord.retry_count || 0) + 1,
                    updated_at: new Date().toISOString(),
                    metadata: {
                        ...emailRecord.metadata,
                        retried_at: new Date().toISOString(),
                        manual_retry: true,
                        admin_triggered: true
                    }
                })
                .eq('id', id);

            return { success: true };
        } catch (error) {
            logger.error({ err: error, emailId: id }, 'Manual retry failed');
            
            // Increment retry count even on failure
            try {
                const { data: current } = await supabase.from('email_notifications').select('retry_count').eq('id', id).single();
                await supabase.from('email_notifications').update({
                    retry_count: (current?.retry_count || 0) + 1,
                    error_message: error.message,
                    updated_at: new Date().toISOString()
                }).eq('id', id);
            } catch (innerError) {
                logger.error({ err: innerError }, 'Failed to update retry count after failed manual retry');
            }

            throw error;
        }
    }

    static async _markAsPermanentFail(id, reason) {
        await supabase
            .from('email_notifications')
            .update({
                status: 'FAILED',
                retry_count: 3, // Mark as max retries to stop further attempts
                error_message: reason,
                updated_at: new Date().toISOString()
            })
            .eq('id', id);
    }
}

module.exports = EmailRetryService;
