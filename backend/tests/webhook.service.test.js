const mockFrom = jest.fn();

jest.mock('../config/supabase', () => ({
    supabase: {
        from: (...args) => mockFrom(...args)
    },
    supabaseAdmin: {}
}));

jest.mock('../utils/logger', () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
}));

jest.mock('./../services/email', () => ({
    sendDonationReceiptEmail: jest.fn().mockResolvedValue({ success: true })
}));

jest.mock('../services/checkout.service', () => ({
    updatePaymentRecord: jest.fn()
}));

jest.mock('../services/order.service', () => ({}));
jest.mock('../services/invoice-orchestrator.service', () => ({
    InvoiceOrchestrator: {}
}));
jest.mock('../services/refund.service', () => ({
    RefundService: {},
    REFUND_JOB_STATUS: {}
}));
jest.mock('../services/realtime.service', () => ({
    publish: jest.fn()
}));

jest.mock('../utils/razorpay-helper', () => ({
    capturePayment: jest.fn().mockResolvedValue({ id: 'pay_captured', status: 'captured' }),
    fetchPayment: jest.fn()
}));

const webhookService = require('../services/webhook.service');
const emailService = require('../services/email');
const realtimeService = require('../services/realtime.service');
const { capturePayment, fetchPayment } = require('../utils/razorpay-helper');

function createMaybeSingleQuery(result) {
    const query = {
        select: jest.fn(() => query),
        eq: jest.fn(() => query),
        order: jest.fn(() => query),
        limit: jest.fn(() => query),
        maybeSingle: jest.fn().mockResolvedValue(result)
    };
    return query;
}

function createInsertQuery(result) {
    const query = {
        insert: jest.fn(() => query),
        select: jest.fn(() => query),
        single: jest.fn().mockResolvedValue(result)
    };
    return query;
}

function createUpdateQuery(result = { error: null }) {
    const query = {
        update: jest.fn(() => query),
        eq: jest.fn().mockResolvedValue(result)
    };
    return query;
}

describe('webhook.service donation subscription handling', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        fetchPayment.mockResolvedValue({ id: 'pay_fetched', status: 'authorized' });
    });

    test('processes subscription.charged donation events on the central webhook path', async () => {
        const existingDonationQuery = createMaybeSingleQuery({ data: null, error: null });
        const subscriptionContextQuery = createMaybeSingleQuery({
            data: {
                user_id: 'user-1',
                donor_name: 'Test Donor',
                donor_email: 'donor@example.com',
                donor_phone: '9999999999',
                is_anonymous: false
            },
            error: null
        });
        const insertDonationQuery = createInsertQuery({
            data: {
                id: 'don-2',
                donation_reference_id: 'DON-SUB-20260328-AAAA',
                amount: 500,
                type: 'monthly',
                donor_name: 'Test Donor',
                donor_email: 'donor@example.com',
                is_anonymous: false,
                user_id: 'user-1'
            },
            error: null
        });
        const subscriptionUpdateQuery = createUpdateQuery({ error: null });

        const donationQueries = [existingDonationQuery, insertDonationQuery];
        const subscriptionQueries = [subscriptionContextQuery, subscriptionUpdateQuery];
        mockFrom.mockImplementation((table) => {
            if (table === 'donations') {
                return donationQueries.shift();
            }
            if (table === 'donation_subscriptions') {
                return subscriptionQueries.shift();
            }
            throw new Error(`Unexpected table ${table}`);
        });

        await webhookService.handleEvent({
            event: 'subscription.charged',
            payload: {
                payment: {
                    entity: {
                        id: 'pay_123',
                        amount: 50000,
                        notes: {
                            payment_purpose: 'DONATION'
                        }
                    }
                },
                subscription: {
                    entity: {
                        id: 'sub_123',
                        current_start: 1710000000,
                        current_end: 1712592000,
                        charge_at: 1712592000
                    }
                }
            }
        });

        expect(insertDonationQuery.insert).toHaveBeenCalled();
        expect(subscriptionUpdateQuery.update).toHaveBeenCalled();
        expect(realtimeService.publish).toHaveBeenCalled();
        expect(emailService.sendDonationReceiptEmail).toHaveBeenCalled();
    });

    test('captures one-time donation on payment.authorized webhook so client verify failures can recover', async () => {
        fetchPayment
            .mockResolvedValueOnce({ id: 'pay_auth_123', status: 'authorized' })
            .mockResolvedValueOnce({ id: 'pay_auth_123', status: 'captured' });

        const authorizationUpdateQuery = createUpdateQuery({ error: null });
        const successUpdateQuery = {
            update: jest.fn(() => successUpdateQuery),
            eq: jest.fn(() => successUpdateQuery),
            select: jest.fn(() => successUpdateQuery),
            single: jest.fn().mockResolvedValue({
                data: {
                    id: 'don_123',
                    amount: 500,
                    type: 'one_time',
                    donor_name: 'Test Donor',
                    donor_email: 'donor@example.com',
                    is_anonymous: false,
                    user_id: 'user-1'
                },
                error: null
            })
        };
        const fetchDonationQuery = createMaybeSingleQuery({
            data: {
                id: 'don_123',
                payment_status: 'authorized',
                razorpay_payment_id: null
            },
            error: null
        });
        const donationQueries = [authorizationUpdateQuery, fetchDonationQuery, successUpdateQuery];

        mockFrom.mockImplementation((table) => {
            if (table === 'donations') {
                return donationQueries.shift();
            }
            throw new Error(`Unexpected table ${table}`);
        });

        await webhookService.handleEvent({
            event: 'payment.authorized',
            payload: {
                payment: {
                    entity: {
                        id: 'pay_auth_123',
                        order_id: 'order_123',
                        amount: 50000,
                        notes: {
                            payment_purpose: 'DONATION',
                            donation_type: 'ONE_TIME'
                        }
                    }
                }
            }
        });

        expect(authorizationUpdateQuery.update).toHaveBeenCalledWith(expect.objectContaining({
            payment_status: 'authorized',
            razorpay_payment_id: 'pay_auth_123'
        }));
        expect(capturePayment).toHaveBeenCalledWith('pay_auth_123', 500);
        expect(successUpdateQuery.update).toHaveBeenCalledWith(expect.objectContaining({
            payment_status: 'success',
            razorpay_payment_id: 'pay_auth_123'
        }));
        expect(realtimeService.publish).toHaveBeenCalled();
        expect(emailService.sendDonationReceiptEmail).toHaveBeenCalled();
    });

    test('processes subscription lifecycle events without a payment entity', async () => {
        const subscriptionUpdateQuery = createUpdateQuery({ error: null });
        mockFrom.mockImplementation((table) => {
            if (table === 'donation_subscriptions') {
                return subscriptionUpdateQuery;
            }
            throw new Error(`Unexpected table ${table}`);
        });

        await webhookService.handleEvent({
            event: 'subscription.cancelled',
            payload: {
                subscription: {
                    entity: {
                        id: 'sub_456',
                        current_start: 1710000000,
                        current_end: 1712592000
                    }
                }
            }
        });

        expect(subscriptionUpdateQuery.update).toHaveBeenCalledWith(
            expect.objectContaining({
                status: 'cancelled'
            })
        );
        expect(subscriptionUpdateQuery.eq).toHaveBeenCalledWith('razorpay_subscription_id', 'sub_456');
    });
});
