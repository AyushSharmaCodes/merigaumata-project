const supabase = require('../lib/supabase');
const logger = require('../utils/logger');
const emailService = require('./email');
const { EmailEventTypes } = require('./email/types');
const { getBackendBaseUrl } = require('../utils/backend-url');

/**
 * Service to handle email retries for failed notifications
 */
class EmailRetryService {
    static MAX_RETRIES = 3;

    static _getBackendBaseUrl() {
        return getBackendBaseUrl();
    }

    static _computeNextRetryAt(retryCount) {
        const delayMinutes = [5, 15, 60][Math.min(Math.max(retryCount, 0), 2)];
        return new Date(Date.now() + delayMinutes * 60 * 1000).toISOString();
    }

    static _inferOrderStatusEventType(emailRecord, order) {
        const metadata = emailRecord.metadata || {};
        const subject = String(metadata.subject || '').toLowerCase();
        const htmlPreview = String(metadata.html_preview || '').toLowerCase();
        const haystack = `${subject} ${htmlPreview}`;

        if (metadata.internal_type && EmailEventTypes[metadata.internal_type]) {
            return metadata.internal_type;
        }

        if (haystack.includes('confirmed')) return EmailEventTypes.ORDER_CONFIRMED;
        if (haystack.includes('shipped')) return EmailEventTypes.ORDER_SHIPPED;
        if (haystack.includes('delivered')) return EmailEventTypes.ORDER_DELIVERED;
        if (haystack.includes('cancel')) return EmailEventTypes.ORDER_CANCELLED;
        if (haystack.includes('return')) return EmailEventTypes.ORDER_RETURNED;

        switch (order?.status) {
            case 'confirmed':
                return EmailEventTypes.ORDER_CONFIRMED;
            case 'shipped':
                return EmailEventTypes.ORDER_SHIPPED;
            case 'delivered':
                return EmailEventTypes.ORDER_DELIVERED;
            case 'cancelled':
                return EmailEventTypes.ORDER_CANCELLED;
            case 'returned':
                return EmailEventTypes.ORDER_RETURNED;
            default:
                return null;
        }
    }

    static async _loadOrderRetryContext(referenceId) {
        const { data: order, error } = await supabase
            .from('orders')
            .select(`
                *,
                items:order_items (
                    *,
                    product:products(title),
                    products:product_id(title),
                    product_variants:variant_id(size_label, selling_price, variant_image_url)
                ),
                profiles:profiles!user_id (name, email, preferred_language),
                shipping_address:addresses!shipping_address_id (*),
                billing_address:addresses!billing_address_id (*),
                refunds(amount, status, created_at),
                invoices(id, type, created_at)
            `)
            .eq('id', referenceId)
            .maybeSingle();

        if (error || !order) {
            throw new Error('Unable to reconstruct order email payload');
        }

        return order;
    }

    static async _rebuildTemplateData(emailRecord, eventType) {
        if (
            ![
                EmailEventTypes.ORDER_PLACED,
                EmailEventTypes.ORDER_CONFIRMED,
                EmailEventTypes.ORDER_SHIPPED,
                EmailEventTypes.ORDER_DELIVERED,
                EmailEventTypes.ORDER_CANCELLED,
                EmailEventTypes.ORDER_RETURNED
            ].includes(eventType)
        ) {
            return null;
        }

        if (!emailRecord.reference_id) {
            throw new Error('Missing reference_id for order email retry');
        }

        const order = await this._loadOrderRetryContext(emailRecord.reference_id);
        const customerName = order.customer_name || order.profiles?.name || emailRecord.recipient_email;
        const lang = order.profiles?.preferred_language || 'en';
        const latestRefund = Array.isArray(order.refunds)
            ? [...order.refunds].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]
            : null;

        let invoiceUrl = order.invoice_url || order.invoiceUrl || null;
        if (eventType === EmailEventTypes.ORDER_DELIVERED && !invoiceUrl && Array.isArray(order.invoices)) {
            const preferredInvoice = [...order.invoices]
                .filter(inv => ['TAX_INVOICE', 'BILL_OF_SUPPLY'].includes(inv.type))
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];

            if (preferredInvoice) {
                invoiceUrl = `${this._getBackendBaseUrl()}/api/invoices/${preferredInvoice.id}/download`;
            }
        }

        return {
            order,
            customerName,
            receiptUrl: eventType === EmailEventTypes.ORDER_PLACED ? invoiceUrl : undefined,
            paymentId: eventType === EmailEventTypes.ORDER_PLACED ? (order.payment_id || order.razorpay_payment_id) : undefined,
            invoiceUrl: eventType === EmailEventTypes.ORDER_DELIVERED ? invoiceUrl : undefined,
            refundAmount: eventType === EmailEventTypes.ORDER_CANCELLED
                ? (latestRefund?.amount ?? order.total_amount)
                : undefined,
            lang
        };
    }

    static async _resolveRetryPayload(emailRecord) {
        const metadata = emailRecord.metadata || {};
        const templateData = metadata.template_data;

        if (templateData) {
            let eventType = metadata.internal_type || emailRecord.email_type;

            // Map persisted DB enum aliases back to the actual internal template types.
            if (eventType === 'ORDER_CONFIRMATION') {
                eventType = EmailEventTypes.ORDER_PLACED;
            }

            return {
                eventType,
                templateData,
                lang: templateData.lang
            };
        }

        let eventType = metadata.internal_type || null;

        if (!eventType) {
            if (emailRecord.email_type === 'ORDER_CONFIRMATION') {
                eventType = EmailEventTypes.ORDER_PLACED;
            } else if (emailRecord.email_type === 'ORDER_STATUS_UPDATE') {
                const order = await this._loadOrderRetryContext(emailRecord.reference_id);
                eventType = this._inferOrderStatusEventType(emailRecord, order);
            } else {
                eventType = emailRecord.email_type;
            }
        }

        if (!eventType) {
            throw new Error('Unable to determine email event type for retry');
        }

        const rebuiltTemplateData = await this._rebuildTemplateData(emailRecord, eventType);
        if (!rebuiltTemplateData) {
            throw new Error('Missing template data for retry');
        }

        return {
            eventType,
            templateData: rebuiltTemplateData,
            lang: rebuiltTemplateData.lang
        };
    }

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
                .lt('retry_count', this.MAX_RETRIES)
                .or(`next_retry_at.is.null,next_retry_at.lte.${new Date().toISOString()}`)
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

                    const recipient = emailRecord.recipient_email;
                    const { eventType, templateData, lang } = await this._resolveRetryPayload(emailRecord);

                    logger.info({ emailId: emailRecord.id, eventType }, `Retrying email to ${recipient}`);

                    // Attempt send using the unified email service
                    const result = await emailService.send(
                        eventType,
                        recipient,
                        templateData,
                        {
                            userId: emailRecord.user_id,
                            lang,
                            referenceId: emailRecord.reference_id,
                            existingLogId: emailRecord.id
                        }
                    );

                    if (!result?.success) {
                        throw new Error(result?.error || 'Email retry failed');
                    }

                    await supabase
                        .from('email_notifications')
                        .update({
                            status: 'SENT',
                            retry_count: (emailRecord.retry_count || 0) + 1,
                            next_retry_at: null,
                            updated_at: new Date().toISOString(),
                            metadata: {
                                ...(emailRecord.metadata || {}),
                                retried_at: new Date().toISOString(),
                                original_status: 'FAILED'
                            }
                        })
                        .eq('id', emailRecord.id);

                    successful++;

                } catch (retryError) {
                    logger.error({ err: retryError, emailId: emailRecord.id }, 'Retry attempt failed');

                    const newCount = (emailRecord.retry_count || 0) + 1;
                    const permanentlyFailed = newCount >= (emailRecord.max_retries || this.MAX_RETRIES);
                    const newStatus = permanentlyFailed ? 'PERMANENTLY_FAILED' : 'FAILED';

                    await supabase
                        .from('email_notifications')
                        .update({
                            status: newStatus,
                            retry_count: newCount,
                            next_retry_at: permanentlyFailed ? null : this._computeNextRetryAt(newCount - 1),
                            error_message: retryError.message,
                            metadata: {
                                ...(emailRecord.metadata || {}),
                                last_retry_error: retryError.message
                            },
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

        let emailRecord = null;

        try {
            const { data, error } = await supabase
                .from('email_notifications')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;
            if (!data) throw new Error('Email notification not found');
            emailRecord = data;

            const recipient = emailRecord.recipient_email;
            const { eventType, templateData, lang } = await this._resolveRetryPayload(emailRecord);

            // Attempt send
            const result = await emailService.send(
                eventType,
                recipient,
                templateData,
                {
                    userId: emailRecord.user_id,
                    lang,
                    referenceId: emailRecord.reference_id,
                    existingLogId: emailRecord.id
                }
            );

            if (!result?.success) {
                throw new Error(result?.error || 'Email retry failed');
            }

            await supabase
                .from('email_notifications')
                .update({
                    status: 'SENT',
                    retry_count: (emailRecord.retry_count || 0) + 1,
                    next_retry_at: null,
                    updated_at: new Date().toISOString(),
                    metadata: {
                        ...(emailRecord.metadata || {}),
                        retried_at: new Date().toISOString(),
                        manual_retry: true,
                        admin_triggered: true,
                        original_status: 'FAILED'
                    }
                })
                .eq('id', id);

            return { success: true };
        } catch (error) {
            logger.error({ err: error, emailId: id }, 'Manual retry failed');
            
            // Increment retry count even on failure
            try {
                const { data: current } = await supabase.from('email_notifications').select('retry_count, metadata').eq('id', id).single();
                await supabase.from('email_notifications').update({
                    retry_count: (current?.retry_count || 0) + 1,
                    error_message: error.message,
                    metadata: {
                        ...(current?.metadata || {}),
                        last_retry_error: error.message
                    },
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
                status: 'PERMANENTLY_FAILED',
                retry_count: this.MAX_RETRIES,
                next_retry_at: null,
                error_message: reason,
                updated_at: new Date().toISOString()
            })
            .eq('id', id);
    }
}

module.exports = EmailRetryService;
