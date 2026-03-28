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

const webhookService = require('../services/webhook.service');
const emailService = require('../services/email');
const realtimeService = require('../services/realtime.service');

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
    });

    test('processes subscription.charged donation events on the central webhook path', async () => {
        const existingDonationQuery = createMaybeSingleQuery({ data: null, error: null });
        const originalDonationQuery = createMaybeSingleQuery({
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

        const donationQueries = [existingDonationQuery, originalDonationQuery, insertDonationQuery];
        mockFrom.mockImplementation((table) => {
            if (table === 'donations') {
                return donationQueries.shift();
            }
            if (table === 'donation_subscriptions') {
                return subscriptionUpdateQuery;
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
