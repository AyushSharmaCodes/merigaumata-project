jest.mock('../config/supabase', () => ({
    supabaseAdmin: { from: jest.fn() }
}));

jest.mock('../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
}));

jest.mock('../services/history.service', () => ({
    logStatusHistory: jest.fn()
}));

const mockPaymentsRefund = jest.fn();

jest.mock('razorpay', () => {
    return jest.fn().mockImplementation(() => ({
        payments: { refund: mockPaymentsRefund },
        refunds: { fetch: jest.fn() }
    }));
});

const { RefundService } = require('../services/refund.service');
const { supabaseAdmin } = require('../config/supabase');

describe('RefundService status helpers', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('normalizes refund job statuses consistently', () => {
        expect(RefundService.normalizeRefundStatus('processed')).toBe('PROCESSED');
        expect(RefundService.normalizeRefundStatus(' Pending ')).toBe('PENDING');
        expect(RefundService.normalizeRefundStatus(null)).toBe('');
    });

    test('allows retry only for safe refund job states', () => {
        expect(RefundService.isRetryableStatus('failed')).toBe(true);
        expect(RefundService.isRetryableStatus('PENDING')).toBe(true);
        expect(RefundService.isRetryableStatus('processing')).toBe(false);
        expect(RefundService.isRetryableStatus('processed')).toBe(false);
    });

    test('treats only processed and failed as terminal refund states', () => {
        expect(RefundService.isTerminalStatus('processed')).toBe(true);
        expect(RefundService.isTerminalStatus('FAILED')).toBe(true);
        expect(RefundService.isTerminalStatus('pending')).toBe(false);
        expect(RefundService.isTerminalStatus('processing')).toBe(false);
    });

    test('supports technical refunds using an internal payment id for orphaned payments', async () => {
        const refundResult = { id: 'rfnd_orphan_1', status: 'processed' };
        mockPaymentsRefund.mockResolvedValue(refundResult);

        const refundsInsertSingle = jest.fn().mockResolvedValue({
            data: { id: 'refund-db-1' },
            error: null
        });
        const refundsUpdateEq = jest.fn().mockResolvedValue({ error: null });

        supabaseAdmin.from.mockImplementation((table) => {
            if (table === 'payments') {
                return {
                    select: jest.fn(() => ({
                        eq: jest.fn(() => ({
                            single: jest.fn().mockResolvedValue({
                                data: {
                                    id: 'payment-db-1',
                                    order_id: null,
                                    amount: 499,
                                    razorpay_payment_id: 'pay_orphan_1'
                                },
                                error: null
                            })
                        }))
                    }))
                };
            }

            if (table === 'refunds') {
                return {
                    insert: jest.fn(() => ({
                        select: jest.fn(() => ({
                            single: refundsInsertSingle
                        }))
                    })),
                    update: jest.fn(() => ({
                        eq: refundsUpdateEq
                    }))
                };
            }

            if (table === 'returns') {
                return {
                    update: jest.fn(() => ({
                        eq: jest.fn().mockResolvedValue({ error: null })
                    }))
                };
            }

            throw new Error(`Unexpected table: ${table}`);
        });

        const result = await RefundService.asyncProcessRefund(
            'payment-db-1',
            'TECHNICAL_REFUND',
            'SYSTEM',
            'Order creation failed after capture',
            true
        );

        expect(result).toEqual({ success: true, refundId: 'rfnd_orphan_1', amount: 499 });
        expect(mockPaymentsRefund).toHaveBeenCalledWith('pay_orphan_1', expect.objectContaining({
            amount: 49900,
            notes: expect.objectContaining({
                payment_id: 'payment-db-1',
                refund_type: 'TECHNICAL_REFUND'
            })
        }));
    });
});
