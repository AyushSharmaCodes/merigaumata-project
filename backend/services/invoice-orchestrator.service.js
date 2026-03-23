/**
 * Invoice Orchestrator Service
 * Manages Dual-Invoice Lifecycle:
 * 1. Razorpay Payment Receipt (at Checkout)
 * 2. Internal GST Tax Invoice (at Delivery)
 */

const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const { createModuleLogger } = require('../utils/logging-standards');
const RazorpayInvoiceService = require('./razorpay-invoice.service');
const InternalInvoiceService = require('./internal-invoice.service');
const { FinancialEventLogger } = require('./financial-event-logger.service');
const emailService = require('./email');
const { INVOICE_STATUS, ORDER_INVOICE_STATUS } = require('../config/constants');

const log = createModuleLogger('InvoiceOrchestrator');

class InvoiceOrchestrator {

    // ========================================================================
    // 1. RAZORPAY PAYMENT RECEIPT (Checkout Flow)
    // ========================================================================

    /**
     * Generate Razorpay Invoice as Payment Proof
     * Called during/after Checkout
     */
    static async generateRazorpayInvoice(order) {
        log.operationStart('GENERATERazorpayInvoice', { orderId: order.id });
        try {
            // Prepare data
            const invoiceData = this._prepareRazorpayData(order);

            // Create via Razorpay
            const invoice = await RazorpayInvoiceService.createInvoice(invoiceData);

            if (invoice.success) {
                // Persist in new Invoices table
                await supabase.from('invoices').insert({
                    order_id: order.id,
                    type: 'RAZORPAY',
                    invoice_number: invoice.invoiceNumber,
                    provider_id: invoice.invoiceId,
                    public_url: invoice.invoiceUrl,
                    status: INVOICE_STATUS.GENERATED
                });

                // NOTE: We do NOT set invoice_url here anymore.
                // invoice_url is reserved for the Internal GST Invoice (generated at delivery).
                // Razorpay receipts are accessed via the invoices array (type='RAZORPAY').
                await supabase.from('orders').update({
                    invoice_status: ORDER_INVOICE_STATUS.RECEIPT_GENERATED
                }).eq('id', order.id);

                log.operationSuccess('GENERATE_RAZORPAY_INVOICE', { invoiceId: invoice.invoiceId });
                return invoice;
            }

            throw new Error(invoice.error || 'Razorpay creation failed');

        } catch (error) {
            log.operationError('GENERATE_RAZORPAY_INVOICE', error);
            await supabase.from('orders').update({ invoice_status: ORDER_INVOICE_STATUS.FAILED }).eq('id', order.id); // Track failure on order broadly
            return { success: false, error: error.message };
        }
    }

    // ========================================================================
    // 2. INTERNAL GST INVOICE (Post-Delivery Flow)
    // ========================================================================

    /**
     * Generate Internal GST Invoice
     * Called when Order Status -> DELIVERED
     */
    static async generateInternalInvoice(orderId) {
        log.operationStart('GENERATEInternalInvoice', { orderId });

        try {
            // Fetch full order details
            const { data: order, error } = await supabase
                .from('orders')
                .select(`*, items:order_items(*)`)
                .eq('id', orderId)
                .single();

            if (error || !order) throw new Error('Order not found');

            // IDEMPOTENCY: Check if a valid internal invoice already exists
            // (This prevents duplicate legal documents during recon/retry)
            const { data: existingInvoice } = await supabase
                .from('invoices')
                .select('id, invoice_number, public_url, file_path')
                .eq('order_id', orderId)
                .in('type', ['TAX_INVOICE', 'BILL_OF_SUPPLY'])
                .eq('status', INVOICE_STATUS.GENERATED)
                .maybeSingle();

            if (existingInvoice) {
                log.info('Internal invoice already exists, ensuring order metadata is synced', { orderId, invoiceId: existingInvoice.id });
                
                // Construct invoice URL based on strategy (same logic as below for consistency)
                const strategy = (process.env.INVOICE_STORAGE_STRATEGY || 'BOTH').toUpperCase();
                const invoiceUrl = (['SUPABASE', 'BOTH'].includes(strategy) && existingInvoice.public_url)
                    ? existingInvoice.public_url
                    : `/api/invoices/${existingInvoice.id}/download`;

                // Self-healing: Update order if metadata is missing/stale
                await supabase.from('orders').update({
                    invoice_id: existingInvoice.id,
                    invoice_number: existingInvoice.invoice_number,
                    invoice_status: ORDER_INVOICE_STATUS.GENERATED,
                    invoice_generated_at: new Date().toISOString(),
                    invoice_url: invoiceUrl
                }).eq('id', orderId);

                return {
                    success: true,
                    invoiceId: existingInvoice.id,
                    filePath: existingInvoice.file_path,
                    invoiceNumber: existingInvoice.invoice_number,
                    publicUrl: existingInvoice.public_url,
                    alreadyExists: true
                };
            }

            // Generate Internal Invoice
            const result = await InternalInvoiceService.generateInvoice(order);

            if (result.success) {
                // Update Order Metadata to point to THIS as the official invoice
                // Construct invoice URL based on storage strategy
                const strategy = (process.env.INVOICE_STORAGE_STRATEGY || 'BOTH').toUpperCase();
                const invoiceUrl = (['SUPABASE', 'BOTH'].includes(strategy) && result.publicUrl)
                    ? result.publicUrl
                    : `/api/invoices/${result.invoiceId}/download`;

                await supabase.from('orders').update({
                    invoice_id: result.invoiceId,
                    invoice_number: result.invoiceNumber,
                    invoice_status: ORDER_INVOICE_STATUS.GENERATED,
                    invoice_generated_at: new Date().toISOString(),
                    invoice_url: invoiceUrl
                }).eq('id', orderId);

                // Send Email
                this._sendInvoiceEmail(order, result);
            }

            return result;

        } catch (error) {
            log.operationError('GENERATE_INTERNAL_INVOICE', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Retry failed invoice generation for orders
     * Typically called by background job
     */
    static async retryFailedInvoices(limit = 10) {
        log.operationStart('RETRYFailedInvoices', { limit });
        try {
            // Find orders where invoice status is 'failed'
            const { data: failedOrders, error } = await supabase
                .from('orders')
                .select('id, order_number, invoice_status')
                .eq('invoice_status', ORDER_INVOICE_STATUS.FAILED)
                .limit(limit);

            if (error) throw error;

            if (!failedOrders || failedOrders.length === 0) {
                return { processed: 0, successful: 0 };
            }

            log.info(`Found ${failedOrders.length} failed invoices to retry`);

            let successful = 0;
            for (const order of failedOrders) {
                // Determine which type was the one that failed or if we should just retry both
                // For now, retry Internal GST Invoice as it's the most common failure point after delivery
                const result = await this.generateInternalInvoice(order.id);
                if (result.success) successful++;
            }

            return { processed: failedOrders.length, successful };
        } catch (error) {
            log.operationError('RETRY_FAILED_INVOICES', error);
            throw error;
        }
    }

    /**
     * Get statistics about invoice generation
     */
    static async getInvoiceStats() {
        try {
            // Count by invoice_status in orders table (Legacy/Overall tracking)
            const { data: orderStats, error: orderErr } = await supabase
                .from('orders')
                .select('invoice_status');

            if (orderErr) throw orderErr;

            const stats = {
                orders: (orderStats || []).reduce((acc, curr) => {
                    const status = curr.invoice_status || ORDER_INVOICE_STATUS.PENDING;
                    acc[status] = (acc[status] || 0) + 1;
                    return acc;
                }, {}),
                detailed: {
                    RAZORPAY: { GENERATED: 0, FAILED: 0 },
                    INTERNAL: { GENERATED: 0, FAILED: 0 }
                }
            };

            // Count by type/status in invoices table (Detailed tracking)
            const { data: invData, error: invErr } = await supabase
                .from('invoices')
                .select('type, status');

            if (invErr) throw invErr;

            (invData || []).forEach(inv => {
                if (stats.detailed[inv.type]) {
                    stats.detailed[inv.type][inv.status] = (stats.detailed[inv.type][inv.status] || 0) + 1;
                }
            });

            return stats;
        } catch (error) {
            logger.error({ err: error }, 'Error fetching invoice stats');
            return {};
        }
    }

    // --- Helpers ---

    static _prepareRazorpayData(order) {
        // Prepare product line items
        // Note: order.items contains snapshots with product metadata
        const lineItems = (order.items || []).map(item => {
            const product = item.product || item.products || {};
            const variant = item.variant_snapshot || item.product_variants || {};

            return {
                name: (product.title || 'Product') + (variant.size_label ? ` (${variant.size_label})` : ''),
                amount: Math.round((product.price || item.price_per_unit || 0) * 100),
                currency: 'INR',
                quantity: item.quantity || 1
            };
        });

        // Identify and Add All Delivery Charges as Line Items (Transparency)
        const deliveryAggregator = {};

        (order.items || []).forEach(item => {
            const totalItemDelivery = (item.delivery_charge || 0) + (item.delivery_gst || 0);
            const snapshot = item.delivery_calculation_snapshot || {};

            if (totalItemDelivery > 0) {
                const isGlobal = (snapshot.source === 'global');
                const isRefundable = (snapshot.delivery_refund_policy === 'REFUNDABLE');

                // Labels matching Frontend (CartSummary.tsx)
                let label = isGlobal ? 'Standard Delivery (Non-Ref)' :
                    (isRefundable ? 'Refundable Surcharge' : 'Addt. Processing (Non-Ref)');

                deliveryAggregator[label] = (deliveryAggregator[label] || 0) + totalItemDelivery;
            }
        });

        // Add aggregated delivery charges to line items
        Object.entries(deliveryAggregator).forEach(([name, amount]) => {
            lineItems.push({
                name: name,
                amount: Math.round(amount * 100),
                currency: 'INR',
                quantity: 1
            });
            log.debug({ name, amount }, "Added delivery line item to Razorpay invoice");
        });

        const data = {
            type: 'invoice',
            customer: {
                name: order.customer_name,
                email: order.customer_email,
                contact: order.customer_phone
            },
            line_items: lineItems,
            receipt: order.order_number,
            description: `Payment Receipt for Order ${order.order_number}`
        };

        // Add Coupon Discount via top-level discount_amount (in paise)
        const couponDiscount = order.coupon_discount || 0;
        if (couponDiscount > 0) {
            data.discount_amount = Math.round(couponDiscount * 100);
            log.info({ orderId: order.id, discount: couponDiscount }, 'Adding discount_amount to Razorpay invoice');
        }

        return data;
    }

    static async _sendInvoiceEmail(order, invoiceResult) {
        // NO EMAIL: GST invoice email is deprecated per email policy
        // Invoice is available for download on order details page
        log.info('INVOICE_GENERATED', 'GST invoice generated - email notification disabled per policy', {
            orderId: order.id,
            invoiceId: invoiceResult.invoiceId,
            customerEmail: order.customer_email
        });

        // Invoice download link is available at: ${process.env.FRONTEND_URL}/orders/${order.id}
        // Customer can access it from their order details page
    }

    /**
     * Periodically clean up expired invoice files (30-day retention)
     */
    static async cleanupExpiredInvoices() {
        try {
            const now = new Date().toISOString();

            // Find invoices expired before now and have a file path
            const { data: expiredInvoices, error } = await supabase
                .from('invoices')
                .select('id, file_path')
                .lt('expires_at', now)
                .not('filePath', 'is', null);

            if (error) throw error;

            if (!expiredInvoices || expiredInvoices.length === 0) {
                return { success: true, processed: 0 };
            }

            logger.info(`Found ${expiredInvoices.length} expired invoices to cleanup`);

            let successful = 0;
            let failed = 0;

            for (const invoice of expiredInvoices) {
                try {
                    // 1. Delete File if exists
                    if (invoice.file_path && fs.existsSync(invoice.file_path)) {
                        fs.unlinkSync(invoice.file_path);
                    } else if (invoice.file_path) {
                        logger.warn({ invoiceId: invoice.id, path: invoice.file_path }, 'Expired invoice file not found on disk');
                    }

                    // 2. Update DB record
                    const { error: updateError } = await supabase
                        .from('invoices')
                        .update({
                            file_path: null,
                            status: INVOICE_STATUS.EXPIRED,
                            // Keep public_url? Probably invalid now if it pointed to this file
                            // But usually public_url handled by route.
                            // If we delete the file, the route will fail anyway.
                        })
                        .eq('id', invoice.id);

                    if (updateError) throw updateError;

                    successful++;
                } catch (err) {
                    logger.error({ err, invoiceId: invoice.id }, 'Failed to cleanup expired invoice');
                    failed++;
                }
            }

            return { success: true, processed: expiredInvoices.length, successful, failed };

        } catch (error) {
            logger.error({ err: error }, 'Error in cleanupExpiredInvoices');
            return { success: false, error: error.message };
        }
    }
}

module.exports = { InvoiceOrchestrator, INVOICE_STATUS };
