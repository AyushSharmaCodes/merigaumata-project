jest.mock('../config/supabase', () => ({
    from: jest.fn(),
    rpc: jest.fn()
}));

jest.mock('../services/email', () => ({
    sendDonationReceiptEmail: jest.fn().mockResolvedValue({ success: true }),
    sendSubscriptionConfirmationEmail: jest.fn().mockResolvedValue({ success: true })
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

function createQueryMock() {
    const q = {
        _data: null,
        _error: null,
        _count: 0,
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
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
