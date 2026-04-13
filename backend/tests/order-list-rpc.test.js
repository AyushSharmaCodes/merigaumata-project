const mockRpc = jest.fn();
const mockFrom = jest.fn();
const mockAdminFrom = jest.fn();
const mockAdminRpc = jest.fn();

jest.mock('../lib/supabase', () => {
    const supabase = {
        rpc: mockRpc,
        from: mockFrom
    };

    return {
        ...supabase,
        supabase,
        supabaseAdmin: {
            from: mockAdminFrom,
            rpc: mockAdminRpc
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

const { getAllOrders } = require('../services/order.service');

describe('order list RPC optimization', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('getAllOrders uses consolidated RPC for special flow filters when available', async () => {
        mockAdminRpc.mockResolvedValueOnce({
            data: {
                data: [
                    {
                        id: 'order-1',
                        order_number: 'ODR-1',
                        total_amount: 500,
                        status: 'cancelled',
                        payment_status: 'paid',
                        created_at: '2026-04-12T10:00:00.000Z',
                        user_id: 'user-1',
                        customer_name: 'Fallback Name',
                        profiles: {
                            id: 'user-1',
                            name: 'Actual User',
                            email: 'user@example.com'
                        }
                    }
                ],
                meta: {
                    page: 1,
                    limit: 10,
                    total: 1,
                    pages: 1,
                    totalPages: 1
                }
            },
            error: null
        });

        const result = await getAllOrders(
            { id: 'admin-1', role: 'admin' },
            { status: 'cancelled_flow', all: 'true', page: 1, limit: 10, shallow: 'true' }
        );

        expect(mockAdminRpc).toHaveBeenCalledWith('get_filtered_orders_v1', {
            p_requesting_user_id: 'admin-1',
            p_is_admin: true,
            p_all: true,
            p_order_number: null,
            p_page: 1,
            p_limit: 10,
            p_status: 'cancelled_flow',
            p_payment_status: null,
            p_start_date: null,
            p_end_date: null,
            p_shallow: true
        });
        expect(mockAdminFrom).not.toHaveBeenCalled();
        expect(result).toEqual({
            data: [
                expect.objectContaining({
                    id: 'order-1',
                    customer_name: 'Actual User',
                    user: {
                        id: 'user-1',
                        name: 'Actual User',
                        email: 'user@example.com'
                    }
                })
            ],
            meta: {
                page: 1,
                limit: 10,
                total: 1,
                pages: 1,
                totalPages: 1
            }
        });
    });
});
