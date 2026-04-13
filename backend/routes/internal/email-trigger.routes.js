const express = require('express');
const router = express.Router();
const emailService = require('../../services/email');
const logger = require('../../utils/logger');
const supabase = require('../../lib/supabase');
const { getOrderById } = require('../../services/order.service');

// Security Middleware: Simple shared secret for internal triggers
const validateInternalSecret = (req, res, next) => {
    const secret = req.headers['x-internal-secret'];
    const expectedSecret = process.env.INTERNAL_API_SECRET;

    if (!expectedSecret || secret !== expectedSecret) {
        logger.warn({ ip: req.ip }, 'Unauthorized attempt to access internal email trigger');
        return res.status(403).json({ error: 'Forbidden' });
    }
    next();
};

/**
 * POST /api/internal/email-trigger
 * Receives Supabase Database Webhook events
 */
router.post('/email-trigger', validateInternalSecret, async (req, res) => {
    const { type, table, record, old_record } = req.body;

    logger.info({ table, type, id: record?.id }, 'Received internal email trigger request');

    try {
        // Only trigger on SUCCESSFUL payment status changes
        if (type === 'UPDATE' || type === 'INSERT') {
            
            // CASE 1: E-Commerce Orders
            if (table === 'orders' && record.payment_status === 'paid' && old_record?.payment_status !== 'paid') {
                const fullOrder = await getOrderById(record.id, { role: 'admin', id: 'system' });
                
                if (fullOrder && fullOrder.customer_email) {
                    await emailService.sendOrderConfirmedEmail(
                        fullOrder.customer_email, 
                        { order: fullOrder, customerName: fullOrder.customer_name }, 
                        fullOrder.user_id
                    );
                    logger.info({ orderId: record.id }, 'Order confirmation email triggered via DB Webhook');
                }
            }

            // CASE 2: Donations
            if (table === 'donations' && record.payment_status === 'success' && old_record?.payment_status !== 'success') {
                const { data: donation } = await supabase
                    .from('donations')
                    .select('*, profiles(name, email)')
                    .eq('id', record.id)
                    .single();

                if (donation) {
                    const recipientEmail = donation.profiles?.email || donation.email; // Fallback to record email if any
                    if (recipientEmail) {
                        await emailService.sendDonationReceiptEmail(
                            recipientEmail,
                            { 
                                donation, 
                                donorName: donation.profiles?.name || 'Valued Donor' 
                            },
                            { userId: donation.user_id }
                        );
                        logger.info({ donationId: record.id }, 'Donation receipt email triggered via DB Webhook');
                    }
                }
            }

            // CASE 3: Event Registrations
            if (table === 'event_registrations' && record.payment_status === 'paid' && old_record?.payment_status !== 'paid') {
                const { data: registration } = await supabase
                    .from('event_registrations')
                    .select('*, events(title, date, location)')
                    .eq('id', record.id)
                    .single();

                if (registration && registration.email) {
                    await emailService.sendEventRegistrationEmail(
                        registration.email,
                        {
                            event: registration.events,
                            registration,
                            attendeeName: registration.name,
                            isPaid: true
                        },
                        registration.user_id
                    );
                    logger.info({ registrationId: record.id }, 'Event registration email triggered via DB Webhook');
                }
            }
        }

        res.json({ success: true });
    } catch (error) {
        logger.error({ err: error, table, id: record?.id }, 'Failed to process internal email trigger');
        res.status(500).json({ error: 'Internal processing failed' });
    }
});

module.exports = router;
