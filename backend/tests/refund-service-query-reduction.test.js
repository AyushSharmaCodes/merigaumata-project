const mockMaybeSingle = jest.fn();
const mockEq = jest.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockSelect = jest.fn(() => ({ eq: mockEq }));
const mockInsertSingle = jest.fn();
const mockInsertSelect = jest.fn(() => ({ single: mockInsertSingle }));
const mockInsert = jest.fn(() => ({ select: mockInsertSelect }));
const mockUpdateMatch = jest.fn(() => ({ select: jest.fn(() => ({ single: jest.fn() })) }));
const mockUpdateEq = jest.fn(() => ({ eq: mockUpdateMatch, select: jest.fn(() => ({ single: jest.fn() })) }));
const mockUpdate = jest.fn(() => ({ eq: mockUpdateEq, select: jest.fn(() => ({ single: jest.fn() })) }));

jest.mock('../lib/supabase', () => ({
    supabaseAdmin: {
        from: jest.fn((table) => {
            if (table === 'orders') {
                return { select: mockSelect, update: mockUpdate };
            }
            if (table === 'refunds') {
                return { insert: mockInsert, update: mockUpdate };
            }
            if (table === 'payments') {
                return { update: mockUpdate };
            }
            throw new Error(`Unexpected table: ${table}`);
        })
    }
}));

jest.mock('../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
}));

jest.mock('../services/history.service', () => ({
    logStatusHistory: jest.fn()
}));

jest.mock('../utils/razorpay-timeout', () => ({
    wrapRazorpayWithTimeout: (instance) => instance
}));

jest.mock('razorpay', () => {
    return jest.fn().mockImplementation(() => ({
        payments: { refund: jest.fn().mockResolvedValue({ id: 'rfnd_1', status: 'processed' }) },
        refunds: { fetch: jest.fn() }
    }));
});

const { RefundService } = require('../services/refund.service');

describe('RefundService query reduction', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('asyncProcessRefund reads order and linked payments in one orders query', async () => {
        mockMaybeSingle.mockResolvedValue({
            data: {
                id: 'order-1',
                total_amount: 1000,
                delivery_charge: 0,
                delivery_gst: 0,
                is_delivery_refundable: true,
                order_items: [],
                payments: [
                    {
                        id: 'payment-1',
                        razorpay_payment_id: 'pay_123',
                        amount: 1000,
                        status: 'captured'
                    }
                ]
            },
            error: null
        });

        mockInsertSingle.mockResolvedValue({
            data: {
                id: 'refund-job-1',
                status: 'PENDING',
                amount: 1000
            },
            error: null
        });

        await RefundService.asyncProcessRefund('order-1', 'BUSINESS_REFUND');

        expect(mockSelect).toHaveBeenCalledWith('*, order_items(*), payments(*)');
        expect(mockEq).toHaveBeenCalledWith('id', 'order-1');
        expect(mockMaybeSingle).toHaveBeenCalledTimes(1);
    });
});
