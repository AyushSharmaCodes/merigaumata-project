const mockFrom = jest.fn();
const mockAdminFrom = jest.fn();

jest.mock('../config/supabase', () => ({
    supabase: {
        from: (...args) => mockFrom(...args)
    },
    supabaseAdmin: {
        from: (...args) => mockAdminFrom(...args)
    }
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
        mockFrom.mockReset();
        mockAdminFrom.mockReset();
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

describe('webhook.service one-time donation handling', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockFrom.mockReset();
    });

    test('captures one-time donation on payment.captured webhook', async () => {
        const fetchDonationQuery = createMaybeSingleQuery({
            data: { id: 'don_123', payment_status: 'authorized' },
            error: null
        });
        const successUpdateQuery = {
            update: jest.fn(() => successUpdateQuery),
            eq: jest.fn(() => successUpdateQuery),
            select: jest.fn(() => successUpdateQuery),
            single: jest.fn().mockResolvedValue({
                data: { id: 'don_123', amount: 500, type: 'one_time', donor_name: 'Test Donor' },
                error: null
            })
        };

        mockFrom.mockImplementation((table) => {
            if (table === 'donations') {
                return { ...fetchDonationQuery, ...successUpdateQuery };
            }
        });

        await webhookService.handleEvent({
            event: 'payment.captured',
            payload: {
                payment: {
                    entity: {
                        id: 'pay_cap_123',
                        order_id: 'order_123',
                        amount: 50000,
                        notes: { payment_purpose: 'DONATION', donation_type: 'ONE_TIME' }
                    }
                }
            }
        });

        expect(successUpdateQuery.update).toHaveBeenCalledWith(expect.objectContaining({
            payment_status: 'success',
            razorpay_payment_id: 'pay_cap_123'
        }));
    });

    test('marks one-time donation failed on payment.failed webhook', async () => {
        const failureUpdateQuery = createUpdateQuery({ error: null });

        mockFrom.mockImplementation((table) => {
            if (table === 'donations') return failureUpdateQuery;
        });

        await webhookService.handleEvent({
            event: 'payment.failed',
            payload: {
                payment: {
                    entity: {
                        id: 'pay_fail_123',
                        order_id: 'order_123',
                        amount: 50000,
                        notes: { payment_purpose: 'DONATION', donation_type: 'ONE_TIME' }
                    }
                }
            }
        });

        expect(failureUpdateQuery.update).toHaveBeenCalledWith(expect.objectContaining({
            payment_status: 'failed',
            razorpay_payment_id: 'pay_fail_123'
        }));
    });
});

describe('webhook.service event registration handling', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockFrom.mockReset();
    });

    test('marks registration success and confirmed on payment.captured webhook', async () => {
        const fetchRegQuery = createMaybeSingleQuery({
            data: { id: 'reg_123', payment_status: 'authorized', status: 'pending' },
            error: null
        });
        const successUpdateQuery = {
            update: jest.fn(() => successUpdateQuery),
            eq: jest.fn(() => successUpdateQuery),
            neq: jest.fn(() => successUpdateQuery),
            select: jest.fn(() => successUpdateQuery),
            single: jest.fn().mockResolvedValue({
                data: { id: 'reg_123', event_id: 'evt_1', status: 'confirmed', email: 'test@example.com' },
                error: null
            })
        };
        const fetchEventQuery = createMaybeSingleQuery({
            data: { title: 'Test Event', date: '2026-05-01' },
            error: null
        });

        const mockedQueries = [fetchRegQuery, successUpdateQuery, fetchEventQuery];

        mockFrom.mockImplementation((table) => {
            if (table === 'event_registrations' && mockedQueries.length > 2) return mockedQueries.shift();
            if (table === 'event_registrations' && mockedQueries.length > 1) return mockedQueries.shift();
            if (table === 'events') return mockedQueries.shift();
        });

        await webhookService.handleEvent({
            event: 'payment.captured',
            payload: {
                payment: {
                    entity: {
                        id: 'pay_evt_1',
                        order_id: 'order_evt_1',
                        status: 'captured',
                        notes: { eventId: 'evt_1' }
                    }
                }
            }
        });

        expect(successUpdateQuery.update).toHaveBeenCalledWith(expect.objectContaining({
            payment_status: 'success',
            status: 'confirmed',
            razorpay_payment_id: 'pay_evt_1'
        }));
        expect(realtimeService.publish).toHaveBeenCalled();
        expect(emailService.sendEventRegistrationEmail).toHaveBeenCalled();
    });

    test('marks registration failed on payment.failed webhook', async () => {
        const fetchRegQuery = createMaybeSingleQuery({
            data: { id: 'reg_123', payment_status: 'authorized' },
            error: null
        });
        const failureUpdateQuery = {
            update: jest.fn(() => failureUpdateQuery),
            eq: jest.fn(() => failureUpdateQuery),
            not: jest.fn(() => failureUpdateQuery)
        };

        let callCount = 0;
        mockFrom.mockImplementation((table) => {
            if (table === 'event_registrations') {
                if (callCount === 0) {
                    callCount++;
                    return fetchRegQuery;
                }
                return failureUpdateQuery;
            }
        });

        await webhookService.handleEvent({
            event: 'payment.failed',
            payload: {
                payment: {
                    entity: {
                        id: 'pay_evt_fail',
                        order_id: 'order_evt_2',
                        notes: { eventId: 'evt_2' }
                    }
                }
            }
        });

        expect(failureUpdateQuery.update).toHaveBeenCalledWith(expect.objectContaining({
            payment_status: 'failed',
            status: 'failed',
            razorpay_payment_id: 'pay_evt_fail'
        }));
    });
});

describe('webhook.service order handling', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockFrom.mockReset();
        mockAdminFrom.mockReset();
        require('../services/checkout.service').updatePaymentRecord.mockClear();
        require('../services/order.service').logStatusHistory = jest.fn();
    });

    test('marks order payment true on payment.captured', async () => {
        const fetchPaymentQuery = createMaybeSingleQuery({
            data: { id: 'pmt_123', status: 'authorized', order_id: 'ord_123' },
            error: null
        });

        mockFrom.mockImplementation((table) => {
            if (table === 'payments') return fetchPaymentQuery;
        });

        const updateOrderQuery = {
            update: jest.fn(() => updateOrderQuery),
            eq: jest.fn(() => updateOrderQuery),
            select: jest.fn(() => updateOrderQuery),
            single: jest.fn().mockResolvedValue({
                data: { id: 'ord_123', customer_email: 'ord@example.com', orderItems: [] },
                error: null
            })
        };

        const updateInvoiceQuery = createUpdateQuery();

        mockAdminFrom.mockImplementation((table) => {
            if (table === 'orders') return updateOrderQuery;
            if (table === 'invoices') return updateInvoiceQuery;
        });

        await webhookService.handleEvent({
            event: 'payment.captured',
            payload: {
                payment: {
                    entity: {
                        id: 'pay_ord_1',
                        order_id: 'rzp_order_1',
                        method: 'upi',
                        notes: {} // No eventId, no donation
                    }
                }
            }
        });

        expect(require('../services/checkout.service').updatePaymentRecord).toHaveBeenCalledWith(
            'pmt_123',
            expect.objectContaining({ status: 'success', razorpay_payment_id: 'pay_ord_1' })
        );
        expect(updateOrderQuery.update).toHaveBeenCalledWith(expect.objectContaining({
            payment_status: 'paid',
            status: 'pending'
        }));
        expect(emailService.sendOrderPlacedEmail).toHaveBeenCalled();
    });

    test('marks order payment failed on payment.failed', async () => {
        const fetchPaymentQuery = createMaybeSingleQuery({
            data: { id: 'pmt_fail_123', status: 'authorized', order_id: 'ord_123' },
            error: null
        });

        mockFrom.mockImplementation((table) => {
            if (table === 'payments') return fetchPaymentQuery;
        });

        await webhookService.handleEvent({
            event: 'payment.failed',
            payload: {
                payment: {
                    entity: {
                        id: 'pay_ord_fail',
                        order_id: 'rzp_order_2',
                        error_description: 'Insf funds',
                        notes: {}
                    }
                }
            }
        });

        expect(require('../services/checkout.service').updatePaymentRecord).toHaveBeenCalledWith(
            'pmt_fail_123',
            expect.objectContaining({ status: 'failed', error_description: 'Insf funds' })
        );
        expect(require('../services/order.service').logStatusHistory).toHaveBeenCalled();
    });

    test('processes full refund successfully on refund.processed', async () => {
        const fetchPaymentQuery = createMaybeSingleQuery({
            data: { id: 'pmt_ref_123', status: 'success', amount: 500, order_id: 'ord_123', refunds: [] },
            error: null
        });
        
        const updateRefundQuery = {
            update: jest.fn(() => updateRefundQuery),
            eq: jest.fn(() => updateRefundQuery),
            select: jest.fn(() => updateRefundQuery),
            single: jest.fn().mockResolvedValue({
                data: { id: 'ref_1', order_id: 'ord_123' },
                error: null
            })
        };

        const fetchAllRefundsQuery = {
            select: jest.fn(() => fetchAllRefundsQuery),
            eq: jest.fn(() => fetchAllRefundsQuery),
            in: jest.fn().mockResolvedValue({
                data: [{ amount: 500 }],
                error: null
            })
        };

        const updatePaymentQuery = createUpdateQuery();

        let callCount = 0;
        mockFrom.mockImplementation((table) => {
            if (table === 'payments' && callCount === 0) { callCount++; return fetchPaymentQuery; }
            if (table === 'refunds' && callCount === 1) { callCount++; return updateRefundQuery; }
            if (table === 'refunds' && callCount === 2) { callCount++; return fetchAllRefundsQuery; }
            if (table === 'payments' && callCount === 3) { callCount++; return updatePaymentQuery; }
        });

        const fetchOrderQuery = createMaybeSingleQuery({
            data: { id: 'ord_123', status: 'pending' },
            error: null
        });

        const updateOrderQuery = createUpdateQuery();
        const updateInvoiceQuery = createUpdateQuery();

        let adminCallCount = 0;
        mockAdminFrom.mockImplementation((table) => {
            if (table === 'orders' && adminCallCount === 0) { adminCallCount++; return fetchOrderQuery; }
            if (table === 'orders' && adminCallCount === 1) { adminCallCount++; return updateOrderQuery; }
            if (table === 'invoices' && adminCallCount === 2) { adminCallCount++; return updateInvoiceQuery; }
        });

        require('../services/refund.service').RefundService.syncOrderRefunds = jest.fn();

        await webhookService.handleEvent({
            event: 'refund.processed',
            payload: {
                refund: {
                    entity: {
                        id: 'rfnd_123',
                        payment_id: 'pay_ref_123',
                        amount: 50000
                    }
                }
            }
        });

        expect(updateRefundQuery.update).toHaveBeenCalledWith(expect.objectContaining({ razorpay_refund_status: 'PROCESSED' }));
        expect(updatePaymentQuery.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'refunded', total_refunded_amount: 500 }));
        expect(updateOrderQuery.update).toHaveBeenCalledWith(expect.objectContaining({ payment_status: 'refunded', status: 'refunded' }));
    });
});
