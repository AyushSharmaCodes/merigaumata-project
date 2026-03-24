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

jest.mock('razorpay', () => {
    return jest.fn().mockImplementation(() => ({
        payments: { refund: jest.fn() },
        refunds: { fetch: jest.fn() }
    }));
});

const { RefundService } = require('../services/refund.service');

describe('RefundService status helpers', () => {
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
});
