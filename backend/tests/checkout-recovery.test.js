jest.mock('../config/supabase', () => ({
    from: jest.fn(),
    rpc: jest.fn(),
    supabaseAdmin: {
        from: jest.fn(),
        rpc: jest.fn()
    }
}));

jest.mock('../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
}));

jest.mock('../utils/logging-standards', () => ({
    createModuleLogger: jest.fn(() => ({
        operationStart: jest.fn(),
        operationSuccess: jest.fn(),
        operationError: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
        info: jest.fn()
    }))
}));

jest.mock('../utils/async-context', () => ({
    getTraceContext: jest.fn(() => ({}))
}));

jest.mock('../services/cart.service', () => ({
    calculateCartTotals: jest.fn(),
    getUserCart: jest.fn(),
    removeFromCart: jest.fn()
}));

jest.mock('../services/address.service', () => ({
    getPrimaryAddress: jest.fn(),
    getLatestAddress: jest.fn(),
    getAddressById: jest.fn(),
    getUserAddresses: jest.fn()
}));

jest.mock('../services/inventory.service', () => ({
    checkStockAvailability: jest.fn(),
    decreaseInventory: jest.fn()
}));

jest.mock('../services/email', () => ({}));
jest.mock('../services/refund.service', () => ({
    RefundService: { asyncProcessRefund: jest.fn() },
    REFUND_TYPES: { TECHNICAL_REFUND: 'TECHNICAL_REFUND' }
}));
jest.mock('../utils/razorpay-helper', () => ({
    capturePayment: jest.fn(),
    voidAuthorization: jest.fn(),
    refundPayment: jest.fn()
}));
jest.mock('../services/pricing-calculator.service', () => ({
    PricingCalculator: {
        formatForRazorpayInvoice: jest.fn((items) => items)
    }
}));
jest.mock('../services/financial-event-logger.service', () => ({
    FinancialEventLogger: {}
}));
jest.mock('../services/history.service', () => ({
    logStatusHistory: jest.fn()
}));
jest.mock('../services/coupon.service', () => ({
    validateCoupon: jest.fn()
}));
jest.mock('../services/razorpay-invoice.service', () => ({
    RazorpayInvoiceService: {}
}));
jest.mock('../services/invoice-orchestrator.service', () => ({
    InvoiceOrchestrator: {}
}));
jest.mock('../services/checkout-summary-cache.service', () => ({
    getCheckoutSummaryCache: jest.fn(() => null),
    setCheckoutSummaryCache: jest.fn()
}));
jest.mock('../services/realtime.service', () => ({
    publish: jest.fn()
}));

const mockPaymentsFetch = jest.fn();
const mockPaymentsCapture = jest.fn();

jest.mock('razorpay', () => {
    return jest.fn().mockImplementation(() => ({
        invoices: {
            create: jest.fn(),
            issue: jest.fn(),
            fetch: jest.fn()
        },
        payments: {
            fetch: mockPaymentsFetch,
            capture: mockPaymentsCapture,
            refund: jest.fn()
        },
        orders: {
            create: jest.fn(),
            fetch: jest.fn()
        }
    }));
});

const supabase = require('../config/supabase');
const { processPaymentAndOrder } = require('../services/checkout.service');
const crypto = require('crypto');

function createQuery(result) {
    const query = {
        select: jest.fn(() => query),
        eq: jest.fn(() => query),
        single: jest.fn().mockResolvedValue(result),
        maybeSingle: jest.fn().mockResolvedValue(result)
    };
    return query;
}

describe('Checkout recovery safety', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('returns the existing order when payment was already linked by a webhook/retry path', async () => {
        mockPaymentsFetch.mockResolvedValueOnce({
            id: 'pay_123',
            status: 'captured',
            amount: 10000,
            order_id: 'order_rzp_123',
            currency: 'INR'
        });

        const paymentQuery = createQuery({
            data: {
                order_id: 'order-db-123',
                status: 'captured',
                invoice_id: 'inv_123',
                metadata: { receipt: 'ODR123' }
            },
            error: null
        });

        const orderQuery = createQuery({
            data: {
                id: 'order-db-123',
                orderItems: [{ id: 'item-1' }]
            },
            error: null
        });

        supabase.from.mockImplementation((table) => {
            if (table === 'payments') return paymentQuery;
            if (table === 'orders') return orderQuery;
            throw new Error(`Unexpected table: ${table}`);
        });

        const result = await processPaymentAndOrder('user-1', {
            razorpay_order_id: 'order_rzp_123',
            razorpay_payment_id: 'pay_123',
            razorpay_signature: crypto
                .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'test-secret')
                .update('order_rzp_123|pay_123')
                .digest('hex'),
            payment_id: 'payment-db-123'
        });

        expect(result).toEqual({
            success: true,
            order: {
                id: 'order-db-123',
                orderItems: [{ id: 'item-1' }]
            }
        });
    });

    test('recovers the existing order using razorpay payment id when client payment_id is missing', async () => {
        mockPaymentsFetch.mockResolvedValueOnce({
            id: 'pay_456',
            status: 'captured',
            amount: 10000,
            order_id: 'order_rzp_456',
            currency: 'INR'
        });

        const paymentQuery = createQuery({
            data: {
                id: 'payment-db-456',
                order_id: 'order-db-456',
                invoice_id: 'inv_456',
                metadata: { receipt: 'ODR456' }
            },
            error: null
        });

        const orderQuery = createQuery({
            data: {
                id: 'order-db-456',
                orderItems: [{ id: 'item-2' }]
            },
            error: null
        });

        supabase.from.mockImplementation((table) => {
            if (table === 'payments') return paymentQuery;
            if (table === 'orders') return orderQuery;
            throw new Error(`Unexpected table: ${table}`);
        });

        const result = await processPaymentAndOrder('user-1', {
            razorpay_order_id: 'order_rzp_456',
            razorpay_payment_id: 'pay_456',
            razorpay_signature: crypto
                .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'test-secret')
                .update('order_rzp_456|pay_456')
                .digest('hex')
        });

        expect(result).toEqual({
            success: true,
            order: {
                id: 'order-db-456',
                orderItems: [{ id: 'item-2' }]
            }
        });
    });
});
