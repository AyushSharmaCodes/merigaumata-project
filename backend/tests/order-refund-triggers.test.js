const mockAsyncProcessRefund = jest.fn();
const mockLogStatusHistory = jest.fn().mockResolvedValue(undefined);

jest.mock('../config/supabase', () => {
    const supabaseAdmin = { from: jest.fn() };
    return {
        supabase: { from: jest.fn(), rpc: jest.fn() },
        supabaseAdmin
    };
});

jest.mock('../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
}));

jest.mock('../services/email', () => ({}));
jest.mock('../lib/store/memory.store', () => {
    return jest.fn().mockImplementation(() => ({
        get: jest.fn(),
        set: jest.fn()
    }));
});
jest.mock('../services/razorpay-invoice.service', () => ({}));
jest.mock('../services/address.service', () => ({ formatAddress: jest.fn() }));
jest.mock('../services/inventory.service', () => ({}));
jest.mock('../services/checkout.service', () => ({}));
jest.mock('../services/invoice-orchestrator.service', () => ({
    InvoiceOrchestrator: { generateInternalInvoice: jest.fn() }
}));
jest.mock('../services/financial-event-logger.service', () => ({
    FinancialEventLogger: {}
}));
jest.mock('../services/refund.service', () => ({
    RefundService: {
        asyncProcessRefund: mockAsyncProcessRefund
    },
    REFUND_TYPES: {
        BUSINESS_REFUND: 'BUSINESS_REFUND',
        TECHNICAL_REFUND: 'TECHNICAL_REFUND'
    }
}));
jest.mock('../services/history.service', () => {
    const ORDER_STATUS = {
        PENDING: 'pending',
        CONFIRMED: 'confirmed',
        PROCESSING: 'processing',
        PACKED: 'packed',
        SHIPPED: 'shipped',
        DELIVERY_UNSUCCESSFUL: 'delivery_unsuccessful',
        RETURNED_TO_ORIGIN: 'returned_to_origin',
        RTO_IN_TRANSIT: 'rto_in_transit',
        RETURN_REQUESTED: 'return_requested',
        RETURNED: 'returned',
        DELIVERED: 'delivered',
        CANCELLED: 'cancelled',
        CANCELLED_BY_ADMIN: 'cancelled_by_admin',
        CANCELLED_BY_CUSTOMER: 'cancelled_by_customer'
    };

    return {
        ORDER_STATUS,
        STATUS_MESSAGES: {
            returned_to_origin: 'Order returned to origin.'
        },
        ALLOWED_TRANSITIONS: {},
        isValidTransition: jest.fn(() => true),
        logStatusHistory: mockLogStatusHistory
    };
});
jest.mock('../domain/orderStateMachine', () => ({}));
jest.mock('../utils/concurrency', () => ({
    withOptimisticRetry: async (fn) => fn()
}));
jest.mock('../constants/messages', () => ({
    ORDER: {
        ORDER_NOT_FOUND: 'ORDER_NOT_FOUND',
        INVALID_TRANSITION: 'INVALID_TRANSITION',
        DEFAULT_STATUS_UPDATE: 'Status updated'
    },
    PAYMENT: {},
    LOGS: {
        ORDER_REFUND_FAIL: 'ORDER_REFUND_FAIL'
    },
    COMMON: {},
    INVENTORY: {}
}));
jest.mock('../utils/i18n.util', () => ({
    translate: jest.fn((value) => value)
}));
jest.mock('../utils/backend-url', () => ({
    getBackendBaseUrl: jest.fn(() => 'http://localhost:3000')
}));
jest.mock('../services/email/types', () => ({
    ALLOWED_ORDER_EMAIL_STATES: {}
}));
jest.mock('razorpay', () => {
    return jest.fn().mockImplementation(() => ({}));
});
jest.mock('../utils/razorpay-timeout', () => ({
    wrapRazorpayWithTimeout: jest.fn((client) => client)
}));

const { supabaseAdmin } = require('../config/supabase');
const { updateOrderStatus } = require('../services/order.service');

function createOrdersFetchBuilder(order) {
    return {
        eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({ data: order, error: null })
        }))
    };
}

function createOrdersUpdateBuilder(updatedOrder) {
    return {
        eq: jest.fn(() => ({
            eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                    select: jest.fn().mockResolvedValue({ data: [updatedOrder], error: null })
                }))
            }))
        }))
    };
}

function wireOrderQueries(order) {
    const updatedOrder = {
        ...order,
        status: order.nextStatus,
        version: (order.version || 0) + 1
    };

    supabaseAdmin.from.mockImplementation((table) => {
        if (table !== 'orders') {
            throw new Error(`Unexpected table: ${table}`);
        }

        return {
            select: jest.fn(() => createOrdersFetchBuilder(order)),
            update: jest.fn(() => createOrdersUpdateBuilder(updatedOrder))
        };
    });
}

async function flushBackgroundWork() {
    await new Promise((resolve) => setImmediate(resolve));
}

describe('Order refund triggers', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('customer pre-shipment cancellation triggers business refund automatically', async () => {
        wireOrderQueries({
            id: 'order-1',
            status: 'confirmed',
            payment_status: 'paid',
            total_amount: 499,
            version: 0,
            items: [],
            nextStatus: 'cancelled_by_customer'
        });

        const result = await updateOrderStatus('order-1', 'cancelled_by_customer', 'user-1', 'Customer cancelled', 'customer');
        await flushBackgroundWork();

        expect(result.success).toBe(true);
        expect(result.refundInitiated).toBe(true);
        expect(mockAsyncProcessRefund).toHaveBeenCalledWith(
            'order-1',
            'BUSINESS_REFUND',
            'USER',
            'Customer cancelled'
        );
    });

    test('admin pre-shipment cancellation triggers technical refund automatically', async () => {
        wireOrderQueries({
            id: 'order-2',
            status: 'processing',
            payment_status: 'paid',
            total_amount: 799,
            version: 3,
            items: [],
            nextStatus: 'cancelled_by_admin'
        });

        const result = await updateOrderStatus('order-2', 'cancelled_by_admin', 'admin-1', 'Admin cancelled', 'admin');
        await flushBackgroundWork();

        expect(result.success).toBe(true);
        expect(result.refundInitiated).toBe(true);
        expect(mockAsyncProcessRefund).toHaveBeenCalledWith(
            'order-2',
            'TECHNICAL_REFUND',
            'ADMIN',
            'Admin cancelled'
        );
    });

    test('delivery unsuccessful alone does not initiate a refund', async () => {
        wireOrderQueries({
            id: 'order-3',
            status: 'shipped',
            payment_status: 'paid',
            total_amount: 999,
            version: 1,
            items: [],
            nextStatus: 'delivery_unsuccessful'
        });

        const result = await updateOrderStatus('order-3', 'delivery_unsuccessful', 'admin-1', 'Customer unreachable', 'admin');
        await flushBackgroundWork();

        expect(result.success).toBe(true);
        expect(result.refundInitiated).toBe(false);
        expect(mockAsyncProcessRefund).not.toHaveBeenCalled();
    });

    test('returned to origin initiates a business refund for customer-driven delivery failure reasons', async () => {
        wireOrderQueries({
            id: 'order-4',
            status: 'rto_in_transit',
            payment_status: 'paid',
            total_amount: 1299,
            version: 2,
            items: [],
            delivery_unsuccessful_reason: '[CUSTOMER_UNAVAILABLE] Customer unavailable at delivery address',
            nextStatus: 'returned_to_origin'
        });

        const result = await updateOrderStatus('order-4', 'returned_to_origin', 'admin-1', 'RTO completed', 'admin');
        await flushBackgroundWork();

        expect(result.success).toBe(true);
        expect(result.refundInitiated).toBe(true);
        expect(mockAsyncProcessRefund).toHaveBeenCalledWith(
            'order-4',
            'BUSINESS_REFUND',
            'ADMIN',
            'RTO completed'
        );
    });

    test('returned to origin initiates a technical refund for operational delivery failure reasons', async () => {
        wireOrderQueries({
            id: 'order-5',
            status: 'rto_in_transit',
            payment_status: 'paid',
            total_amount: 1599,
            version: 4,
            items: [],
            delivery_unsuccessful_reason: '[PACKAGE_LOST] Package lost in transit',
            nextStatus: 'returned_to_origin'
        });

        const result = await updateOrderStatus('order-5', 'returned_to_origin', 'admin-1', 'RTO completed', 'admin');
        await flushBackgroundWork();

        expect(result.success).toBe(true);
        expect(result.refundInitiated).toBe(true);
        expect(mockAsyncProcessRefund).toHaveBeenCalledWith(
            'order-5',
            'TECHNICAL_REFUND',
            'ADMIN',
            'RTO completed'
        );
    });
});
