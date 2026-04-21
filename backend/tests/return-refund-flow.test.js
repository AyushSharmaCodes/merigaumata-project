const mockPaymentsRefund = jest.fn();
const mockRefundInsert = jest.fn().mockResolvedValue({ error: null });
const mockLogStatusHistory = jest.fn().mockResolvedValue(undefined);

jest.mock('../config/supabase', () => {
    const supabaseAdmin = { from: jest.fn() };
    return {
        supabase: {},
        supabaseAdmin
    };
});

jest.mock('../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
}));

jest.mock('razorpay', () => {
    return jest.fn().mockImplementation(() => ({
        payments: {
            refund: mockPaymentsRefund
        }
    }));
});

jest.mock('../utils/razorpay-timeout', () => ({
    wrapRazorpayWithTimeout: jest.fn((client) => client)
}));

jest.mock('../services/pricing-calculator.service', () => ({
    PricingCalculator: {}
}));

jest.mock('../services/refund-calculator.service', () => ({
    RefundCalculator: {
        calculateItemRefund: jest.fn(() => ({
            totalRefund: 200
        }))
    }
}));

jest.mock('../services/financial-event-logger.service', () => ({
    FinancialEventLogger: {}
}));

jest.mock('../services/delivery-charge.service', () => ({
    DeliveryChargeService: {}
}));

jest.mock('../services/inventory.service', () => ({
    restoreInventory: jest.fn()
}));

jest.mock('../services/email', () => ({}));

jest.mock('../utils/logging-standards', () => ({
    createModuleLogger: jest.fn(() => ({
        operationStart: jest.fn(),
        operationError: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }))
}));

jest.mock('../services/order.service', () => ({
    logStatusHistory: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../constants/messages/ReturnMessages', () => ({
    PAYMENT_ID_NOT_FOUND: 'PAYMENT_ID_NOT_FOUND'
}));

jest.mock('../constants/messages', () => ({
    ORDER: {
        REFUND_INITIATED_NOTE: 'Refund initiated'
    }
}));

jest.mock('../services/history.service', () => ({
    logStatusHistory: mockLogStatusHistory
}));

jest.mock('../services/refund.service', () => ({
    REFUND_TYPES: {
        BUSINESS_REFUND: 'BUSINESS_REFUND',
        TECHNICAL_REFUND: 'TECHNICAL_REFUND'
    }
}));

jest.mock('../services/admin-notification.service', () => ({}));
jest.mock('../services/realtime.service', () => ({}));
jest.mock('../services/storage-asset.service', () => ({
    parseStorageUrl: jest.fn(),
    resolveAssetUrl: jest.fn()
}));

const { supabaseAdmin } = require('../config/supabase');
const { handleItemRefund } = require('../services/return.service');

describe('Return refund flow', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockPaymentsRefund.mockResolvedValue({ id: 'rfnd_1', status: 'processed' });

        supabaseAdmin.from.mockImplementation((table) => {
            if (table === 'refunds') {
                return {
                    select: jest.fn(() => ({
                        eq: jest.fn((column) => {
                            if (column === 'return_id') {
                                return {
                                    in: jest.fn(() => ({
                                        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null })
                                    }))
                                };
                            }

                            if (column === 'order_id') {
                                return {
                                    in: jest.fn().mockResolvedValue({ data: [], error: null })
                                };
                            }

                            throw new Error(`Unexpected refunds eq column: ${column}`);
                        })
                    })),
                    insert: mockRefundInsert
                };
            }

            if (table === 'return_items') {
                return {
                    select: jest.fn(() => ({
                        eq: jest.fn(() => ({
                            neq: jest.fn().mockResolvedValue({ data: [], error: null })
                        }))
                    }))
                };
            }

            if (table === 'payments') {
                return {
                    select: jest.fn(() => ({
                        eq: jest.fn(() => ({
                            order: jest.fn(() => ({
                                limit: jest.fn(() => ({
                                    single: jest.fn().mockResolvedValue({
                                        data: {
                                            razorpay_payment_id: 'pay_1',
                                            amount: 500
                                        },
                                        error: null
                                    })
                                }))
                            }))
                        }))
                    }))
                };
            }

            throw new Error(`Unexpected table: ${table}`);
        });
    });

    test('last QC-approved return item auto-initiates refund including delivery refund portion', async () => {
        await handleItemRefund({
            id: 'return-item-1',
            return_id: 'return-1',
            quantity: 1,
            order_item_id: 'order-item-1',
            returns: {
                order_id: 'order-1',
                refund_breakdown: {
                    totalDeliveryRefund: 50
                }
            },
            order_items: {
                quantity: 1,
                price_per_unit: 200
            }
        }, 'admin-1');

        expect(mockPaymentsRefund).toHaveBeenCalledWith('pay_1', expect.objectContaining({
            amount: 25000,
            notes: expect.objectContaining({
                return_id: 'return-1',
                return_item_id: 'return-item-1',
                order_id: 'order-1'
            })
        }));

        expect(mockRefundInsert).toHaveBeenCalledWith(expect.objectContaining({
            return_id: 'return-1',
            order_id: 'order-1',
            amount: 250,
            refund_type: 'BUSINESS_REFUND',
            metadata: {
                return_item_id: 'return-item-1'
            }
        }));
    });
});
