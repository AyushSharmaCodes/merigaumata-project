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
        debug: jest.fn()
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
    RefundService: {},
    REFUND_TYPES: {}
}));
jest.mock('../utils/razorpay-helper', () => ({
    capturePayment: jest.fn(),
    voidAuthorization: jest.fn(),
    refundPayment: jest.fn()
}));
jest.mock('../services/pricing-calculator.service', () => ({
    PricingCalculator: {
        formatForRazorpayInvoice: jest.fn((items) => items.map((item) => ({
            name: item.name,
            amount: item.amount,
            currency: item.currency || 'INR',
            quantity: item.quantity || 1
        })))
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

const mockInvoicesCreate = jest.fn();
const mockInvoicesIssue = jest.fn();

jest.mock('razorpay', () => {
    return jest.fn().mockImplementation(() => ({
        invoices: {
            create: mockInvoicesCreate,
            issue: mockInvoicesIssue,
            fetch: jest.fn()
        },
        payments: {
            fetch: jest.fn(),
            capture: jest.fn(),
            refund: jest.fn()
        },
        orders: {
            create: jest.fn(),
            fetch: jest.fn()
        }
    }));
});

const { createRazorpayInvoice } = require('../services/checkout.service');

describe('CheckoutService third-party failure handling', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('maps Razorpay invoice creation timeout to a friendly gateway error', async () => {
        const timeoutError = new Error('Razorpay.invoices.create timed out after 30000ms');
        timeoutError.code = 'ETIMEDOUT';
        mockInvoicesCreate.mockRejectedValueOnce(timeoutError);

        await expect(
            createRazorpayInvoice(
                500,
                'ODR123',
                { name: 'Test User', email: 'test@example.com', phone: '9999999999' },
                [{ name: 'Gaushala Donation', amount: 50000, currency: 'INR', quantity: 1 }],
                {
                    items: [{ name: 'Gaushala Donation', amount: 50000, currency: 'INR', quantity: 1 }],
                    coupon_discount: 0
                }
            )
        ).rejects.toMatchObject({
            message: 'errors.payment.gatewayError',
            code: 'RAZORPAY_ERROR',
            statusCode: 502
        });
    });
});
