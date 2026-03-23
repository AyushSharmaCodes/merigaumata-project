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

                    logger.info({ emailId: emailRecord.id }, `Retrying email: ${emailRecord.event_type} to ${emailRecord.recipient}`);

                    // Attempt send
                    // We need to use Send function but "send" logs a NEW entry usually.
                    // We want to update the EXISTING entry if it succeeds, or just log a new one?
                    // The emailService.send() creates a NEW record.
                    // Ideally, we should reuse the core provider sending logic without creating a new DB record,
                    // OR we let it create a new record and mark this one as 'RETRIED_AND_SUPERSEDED'?

                    // Simpler approach for now: Use emailService.send() which is robust, and if it succeeds, mark old one as 'RETRIED' (custom status)
                    // But wait, emailService.send() expects (eventType, recipient, data, userId).
                    // We need to parse 'data' from the record which might be flattened or stored as JSON.

                    if (!emailRecord.template_data) {
                        logger.warn(`Email record ${emailRecord.id} has no template data. Cannot retry.`);
                        await this._markAsPermanentFail(emailRecord.id, 'Missing template data');
                        continue;
                    }

                    // Send creates a new log entry. That's fine, it preserves history of attempts.
                    // We just need to mark the OLD one as processed/retried so we don't pick it up again.
                    // Actually, if we mark it as FAILED, we pick it up again.
                    // We should increment retry_count on the OLD record.

                    // But if emailService.send() creates a NEW record, we have duplicate logs for same logical event.
                    // A better 'Retry' implies trying to send the SAME record.
                    // But our emailService structure is tightly coupled to logging on send.

                    // Strategy: Call provider directly? No, abstraction is better.
                    // Strategy: mark current record as 'RETRIED_LEGACY' and let new one be the active one?
                    // Or finding the new record and linking?

                    // 1. Increment retry_count
                    // 2. Try sending using provider
                    // 3. Update status ('SENT' or 'FAILED')

                    await emailService.send(
                        emailRecord.event_type,
                        emailRecord.recipient,
                        emailRecord.template_data, // JSONB
                        emailRecord.user_id
                    );

                    // If send throws, it's caught below. If it succeeds:
                    await supabase
                        .from('email_notifications')
                        .update({
                            status: 'RETRIED_SUCCESS', // Custom status to ignore in future
                            retry_count: emailRecord.retry_count + 1,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', emailRecord.id);

                    successful++;

                } catch (retryError) {
                    logger.error({ err: retryError, emailId: emailRecord.id }, 'Retry attempt failed');

                    // Increment count, keep status as FAILED so it picks up again (until max)
                    // If max reached, mark PERMANENT_FAIL
                    const newCount = emailRecord.retry_count + 1;
                    const newStatus = newCount >= 3 ? 'PERMANENT_FAIL' : 'FAILED';

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

    static async _markAsPermanentFail(id, reason) {
        await supabase
            .from('email_notifications')
            .update({
                status: 'PERMANENT_FAIL',
                error_message: reason,
                updated_at: new Date().toISOString()
            })
            .eq('id', id);
    }
}

module.exports = EmailRetryService;
