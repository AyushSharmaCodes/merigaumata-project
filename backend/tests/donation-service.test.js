jest.mock('../config/supabase', () => ({
    from: jest.fn(),
    rpc: jest.fn()
}));

jest.mock('../services/email', () => ({
    sendDonationReceiptEmail: jest.fn().mockResolvedValue({ success: true }),
    sendSubscriptionConfirmationEmail: jest.fn().mockResolvedValue({ success: true }),
    sendSubscriptionCancellationEmail: jest.fn().mockResolvedValue({ success: true })
}));

jest.mock('../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
}));

jest.mock('../utils/razorpay-helper', () => ({
    capturePayment: jest.fn(),
    voidAuthorization: jest.fn()
}));

jest.mock('razorpay', () => {
    return jest.fn().mockImplementation(() => ({
        orders: { create: jest.fn() },
        plans: { all: jest.fn(), create: jest.fn() },
        subscriptions: { create: jest.fn(), cancel: jest.fn() },
        qrCode: { create: jest.fn() }
    }));
});

const supabase = require('../config/supabase');
const DonationService = require('../services/donation.service');
const Razorpay = require('razorpay');

function createQueryMock() {
    const q = {
        _data: null,
        _error: null,
        _count: 0,
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockImplementation(function () {
            return Promise.resolve({ data: this._data, error: this._error });
        }),
        single: jest.fn().mockImplementation(function () {
            return Promise.resolve({ data: this._data, error: this._error });
        }),
        then: function (onFulfilled, onRejected) {
            return Promise.resolve({ data: this._data, error: this._error, count: this._count }).then(onFulfilled, onRejected);
        }
    };

    return q;
}

describe('DonationService webhook hardening', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('subscription.charged is idempotent when donation already exists for razorpay payment id', async () => {
        process.env.RAZORPAY_WEBHOOK_SECRET = 'test-secret';

        const donationsExistingQuery = createQueryMock();
        donationsExistingQuery._data = {
            id: 'don-1',
            donation_reference_id: 'DON-EXISTING',
            payment_status: 'success'
        };

        supabase.from.mockImplementation((table) => {
            if (table === 'donations') {
                return donationsExistingQuery;
            }

            throw new Error(`Unexpected table access: ${table}`);
        });

        const body = {
            event: 'subscription.charged',
            payload: {
                subscription: {
                    entity: {
                        id: 'sub_123',
                        charge_at: 1710000000
                    }
                },
                payment: {
                    entity: {
                        id: 'pay_existing_123',
                        amount: 25000
                    }
                }
            }
        };

        const signature = require('crypto')
            .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
            .update(JSON.stringify(body))
            .digest('hex');

        await expect(DonationService.processWebhook(signature, body)).resolves.toBeUndefined();
        expect(donationsExistingQuery.insert).not.toHaveBeenCalled();
    });

    test('throws when donation webhook secret is missing', async () => {
        delete process.env.RAZORPAY_WEBHOOK_SECRET;

        const body = {
            event: 'payment.captured',
            payload: {
                payment: {
                    entity: {
                        id: 'pay_123',
                        order_id: 'order_123',
                        status: 'captured',
                        notes: {
                            payment_purpose: 'DONATION',
                            donation_type: 'ONE_TIME'
                        }
                    }
                }
            }
        };

        await expect(DonationService.processWebhook('sig', body)).rejects.toThrow();
        expect(supabase.from).not.toHaveBeenCalled();
    });
});

describe('DonationService third-party order failures', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('createOneTimeOrder propagates Razorpay order creation failures', async () => {
        jest.resetModules();

        const failingOrderError = new Error('Razorpay orders.create timed out');

        const FreshRazorpay = require('razorpay');
        FreshRazorpay.mockImplementation(() => ({
            orders: { create: jest.fn().mockRejectedValueOnce(failingOrderError) },
            plans: { all: jest.fn(), create: jest.fn() },
            subscriptions: { create: jest.fn(), cancel: jest.fn() },
            qrCode: { create: jest.fn() }
        }));

        const freshSupabase = require('../config/supabase');
        const FreshDonationService = require('../services/donation.service');
        const pendingDonationQuery = createQueryMock();
        pendingDonationQuery._data = null;

        freshSupabase.from.mockReturnValue(pendingDonationQuery);

        await expect(
            FreshDonationService.createOneTimeOrder('user-1', {
                amount: 500,
                donorName: 'Test Donor',
                donorEmail: 'donor@example.com',
                donorPhone: '9999999999',
                isAnonymous: false
            })
        ).rejects.toThrow('Razorpay orders.create timed out');

        expect(freshSupabase.from).toHaveBeenCalledWith('donations');
    });

    test('createSubscription requires authentication for recurring donations', async () => {
        await expect(
            DonationService.createSubscription(null, {
                amount: 500,
                donorName: 'Guest Donor',
                donorEmail: 'guest@example.com',
                donorPhone: '9999999999',
                isAnonymous: false
            })
        ).rejects.toMatchObject({
            message: 'errors.auth.loginRequired',
            status: 401
        });
    });
});
