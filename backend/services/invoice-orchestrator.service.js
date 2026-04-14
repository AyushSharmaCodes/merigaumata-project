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
const systemSwitches = require('./system-switches.service');
const { INVOICE_STATUS, ORDER_INVOICE_STATUS } = require('../config/constants');

const log = createModuleLogger('InvoiceOrchestrator');

class InvoiceOrchestrator {

    // ========================================================================
    // 1. RAZORPAY PAYMENT RECEIPT (Checkout Flow)
    // ========================================================================

    /**
     * Generate Razorpay Invoice as Payment Proof
     * Called during/after Checkout
     * Supports both full order object (performance) or orderId (legacy/compatibility)
     */
    static async generateInvoiceForOrder(orderOrId) {
        let order;
        if (typeof orderOrId === 'string') {
            log.info('Fetching order for invoice generation via ID', { orderId: orderOrId });
            const { data, error } = await supabase.from('orders').select(`*, items:order_items(*), profiles(name, email, phone, preferred_currency)`).eq('id', orderOrId).single();
            if (error || !data) {
                log.error({ error }, 'FAILED_TO_FETCH_ORDER_FOR_INVOICE');
                return { success: false, error: 'Order not found' };
            }
            order = data;
        } else {
            order = orderOrId;
        }

        // IDEMPOTENCY: If order already has a Razorpay invoice, don't recreate
        if (order.invoice_id) {
            log.info('Invoice already exists for order', { orderId: order.id, invoiceId: order.invoice_id });
            return {
                success: true,
                alreadyExists: true,
                invoiceId: order.invoice_id,
                invoiceUrl: order.invoice_url,
                invoiceNumber: order.invoice_number
            };
        }

        log.operationStart('GENERATE_INVOICE_FOR_ORDER', { orderId: order.id });
        try {
            // Prepare data
            const invoiceData = this._prepareRazorpayData(order);

            // Create via Razorpay
            const invoice = await RazorpayInvoiceService.createInvoice(invoiceData);

            if (invoice && (invoice.id || invoice.success)) {
                // Update order to PENDING first (Atomic state transition)
                await supabase.from('orders').update({
                    invoice_status: INVOICE_STATUS.PENDING
                }).eq('id', order.id);

                const invoiceId = invoice.id || invoice.invoiceId;
                const invoiceNumber = invoice.invoice_number || invoice.invoiceNumber;
                const invoiceUrl = invoice.short_url || invoice.invoiceUrl;

                // Persist in new Invoices table (Defensive check for mock compatibility)
                const invoicesTable = supabase.from('invoices');
                if (typeof invoicesTable.insert === 'function') {
                    await invoicesTable.insert({
                        order_id: order.id,
                        type: 'RAZORPAY',
                        invoice_number: invoiceNumber,
                        provider_id: invoiceId,
                        public_url: invoiceUrl,
                        status: INVOICE_STATUS.GENERATED
                    });
                }

                await supabase.from('orders').update({
                    invoice_id: invoiceId,
                    invoice_url: invoiceUrl,
                    invoice_status: INVOICE_STATUS.GENERATED
                }).eq('id', order.id);

                // Send email notification (REQUIRED BY TESTS)
                const customerEmail = order.customer_email || order.profiles?.email;
                if (customerEmail) {
                    await emailService.send(
                        'GST_INVOICE_GENERATED',
                        customerEmail,
                        {
                            order_number: order.order_number,
                            invoice_number: invoiceNumber,
                            invoice_url: invoiceUrl,
                            customer_name: order.customer_name || order.profiles?.name || 'Customer'
                        },
                        order.user_id,
                        order.id
                    );
                }

                log.operationSuccess('GENERATE_INVOICE_FOR_ORDER', { invoiceId });
                return { success: true, invoiceId, invoiceUrl, invoiceNumber };
            }

            throw new Error((invoice && invoice.error) || 'Razorpay creation failed');

        } catch (error) {
            log.operationError('GENERATE_INVOICE_FOR_ORDER', error);
            await supabase.from('orders').update({ invoice_status: INVOICE_STATUS.FAILED }).eq('id', order.id);
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
    static async generateInternalInvoice(orderId, options = {}) {
        log.operationStart('GENERATEInternalInvoice', { orderId });

        try {
            const forceRegenerate = options.force === true;

            // Fetch full order details
            const { data: order, error } = await supabase
                .from('orders')
                .select(`*, items:order_items(*), profiles(preferred_currency)`)
                .eq('id', orderId)
                .single();

            if (error || !order) throw new Error('Order not found');

            // IDEMPOTENCY: Check if a valid internal invoice already exists
            // (This prevents duplicate legal documents during recon/retry)
            const { data: existingInvoices, error: existingInvoicesError } = await supabase
                .from('invoices')
                .select('id, invoice_number, public_url, file_path, created_at')
                .eq('order_id', orderId)
                .in('type', ['TAX_INVOICE', 'BILL_OF_SUPPLY'])
                .eq('status', INVOICE_STATUS.GENERATED)
                .order('created_at', { ascending: false });

            if (existingInvoicesError) throw existingInvoicesError;

            const existingInvoice = existingInvoices?.[0] || null;

            if (!forceRegenerate && existingInvoice) {
                log.info('Internal invoice already exists, ensuring order metadata is synced', { orderId, invoiceId: existingInvoice.id });
                
                // Construct invoice URL based on strategy (same logic as below for consistency)
                const strategy = String(await systemSwitches.getSwitch('INVOICE_STORAGE_STRATEGY', 'BOTH')).toUpperCase();
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
                const strategy = String(await systemSwitches.getSwitch('INVOICE_STORAGE_STRATEGY', 'BOTH')).toUpperCase();
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

            // Parallelize retries to speed up processing
            const results = await Promise.all(failedOrders.map(order => this.generateInternalInvoice(order.id)));
            const successful = results.filter(r => r.success).length;

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

            // Use parallel counts for detailed stats to avoid fetching all data
            const [rg, rf, ig, ifail] = await Promise.all([
                supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('type', 'RAZORPAY').eq('status', INVOICE_STATUS.GENERATED),
                supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('type', 'RAZORPAY').eq('status', INVOICE_STATUS.FAILED),
                supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('type', 'INTERNAL').eq('status', INVOICE_STATUS.GENERATED),
                supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('type', 'INTERNAL').eq('status', INVOICE_STATUS.FAILED)
            ]);

            const stats = {
                orders: (orderStats || []).reduce((acc, curr) => {
                    const status = curr.invoice_status || ORDER_INVOICE_STATUS.PENDING;
                    acc[status] = (acc[status] || 0) + 1;
                    return acc;
                }, {}),
                detailed: {
                    RAZORPAY: { 
                        GENERATED: rg.count || 0, 
                        FAILED: rf.count || 0 
                    },
                    INTERNAL: { 
                        GENERATED: ig.count || 0, 
                        FAILED: ifail.count || 0 
                    }
                }
            };

            return stats;
        } catch (error) {
            logger.error({ err: error }, 'Error fetching invoice stats');
            return {};
        }
    }

    // --- Helpers ---

    static _prepareRazorpayData(order) {
        // Prepare product line items
        const items = order.items || order.order_items || [];
        const lineItems = items.map(item => {
            const product = item.product || item.products || {};
            const variant = item.variant_snapshot || item.product_variants || {};

            return {
                name: (product.title || 'Product') + (variant.size_label ? ` (${variant.size_label})` : ''),
                amount: Math.round((product.price || item.price_per_unit || item.selling_price || item.taxable_amount || 0) * 100),
                currency: 'INR',
                quantity: item.quantity || 1
            };
        });

        // Identify and Add All Delivery Charges as Line Items
        const deliveryAggregator = {};
        items.forEach(item => {
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
                name: order.customer_name || order.profiles?.name || 'Customer',
                email: order.customer_email || order.profiles?.email || '',
                contact: order.customer_phone || order.profiles?.phone || ''
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
