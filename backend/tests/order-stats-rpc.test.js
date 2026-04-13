const mockRpc = jest.fn();
const mockFrom = jest.fn();
const mockAdminFrom = jest.fn();

jest.mock('../lib/supabase', () => {
    const supabase = {
        rpc: mockRpc,
        from: mockFrom
    };

    return {
        ...supabase,
        supabase,
        supabaseAdmin: {
            from: mockAdminFrom
        }
    };
});

jest.mock('../services/email', () => ({}));
jest.mock('../services/razorpay-invoice.service', () => ({}));
jest.mock('../services/inventory.service', () => ({}));
jest.mock('../services/checkout.service', () => ({}));
jest.mock('../services/invoice-orchestrator.service', () => ({ InvoiceOrchestrator: {} }));
jest.mock('../services/financial-event-logger.service', () => ({ FinancialEventLogger: {} }));
jest.mock('../services/refund.service', () => ({ RefundService: {}, REFUND_TYPES: {} }));
jest.mock('../utils/backend-url', () => ({ getBackendBaseUrl: jest.fn() }));

const { getOrderStats } = require('../services/order.service');

describe('order stats RPC optimization', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('getOrderStats uses consolidated RPC when available', async () => {
        const payload = {
            totalOrders: 10,
            newOrders: 2,
            processingOrders: 3,
            cancelledOrders: 1,
            returnedOrders: 1,
            failedOrders: 2,
            returnRequestedOrders: 1
        };

        mockRpc.mockResolvedValue({ data: payload, error: null });

        const result = await getOrderStats();

        expect(mockRpc).toHaveBeenCalledWith('get_order_stats_v1');
        expect(mockFrom).not.toHaveBeenCalled();
        expect(result).toEqual(payload);
    });
});
