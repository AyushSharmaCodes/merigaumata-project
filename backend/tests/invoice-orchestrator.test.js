jest.mock('../utils/async-context', () => ({
    getTraceContext: jest.fn().mockReturnValue({ correlationId: 'test-correlation-id' })
}));

const { InvoiceOrchestrator, INVOICE_STATUS } = require('../services/invoice-orchestrator.service');
const RazorpayInvoiceService = require('../services/razorpay-invoice.service');
const { FinancialEventLogger } = require('../services/financial-event-logger.service');
const emailService = require('../services/email');

// Mock dependencies
jest.mock('../config/supabase', () => ({
    from: jest.fn()
}));
const supabase = require('../config/supabase');

jest.mock('../services/razorpay-invoice.service');
jest.mock('../services/financial-event-logger.service');
jest.mock('../services/email');
jest.mock('../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    child: jest.fn().mockReturnThis()
}));
jest.mock('../utils/logging-standards', () => ({
    createModuleLogger: () => ({
        operationStart: jest.fn(),
        operationSuccess: jest.fn(),
        operationError: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
        error: jest.fn()
    })
}));

describe('InvoiceOrchestrator', () => {
    let mockSelect, mockEq, mockSingle, mockUpdate;

    beforeEach(() => {
        jest.clearAllMocks();

        // Properly mock emailService.send to return a promise
        emailService.send = jest.fn().mockResolvedValue(true);

        // Setup Supabase mock chain
        mockSingle = jest.fn();

        // Mock eq needs to handle update chain properly
        // For update: .update().eq() -> returns result
        // For select: .select().eq() -> returns result

        const mockChain = {
            eq: jest.fn().mockReturnThis(),
            single: mockSingle,
            select: jest.fn().mockReturnThis(),
            update: jest.fn().mockReturnThis(),
            then: function (resolve) { resolve({ error: null }); } // Allow await on the chain
        };

        // Redefine simpler structure
        // update().eq()
        mockUpdate = jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null })
        });

        // select().eq().single()
        mockSelect = jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
                single: mockSingle
            })
        });

        supabase.from.mockReturnValue({
            select: mockSelect,
            update: mockUpdate
        });
    });

    describe('generateInvoiceForOrder', () => {
        const orderId = 'order-123';
        const mockOrder = {
            id: orderId,
            user_id: 'user-001', // Added user_id
            order_number: 'ORD-001',
            invoice_id: null,
            total_taxable_amount: 1000,
            total_cgst: 90,
            total_sgst: 90,
            total_igst: 0,
            totalAmount: 1180,
            profiles: {
                name: 'Test Customer',
                email: 'test@example.com',
                phone: '1234567890'
            },
            shippingAddress: {
                line1: '123 St',
                city: 'Test City',
                state: 'Test State',
                pincode: '123456'
            },
            order_items: [
                {
                    title: 'Product 1',
                    quantity: 1,
                    taxable_amount: 1000,
                    gst_rate: 18,
                    cgst: 90,
                    sgst: 90,
                    igst: 0
                }
            ]
        };

        test('should successfully generate an invoice for a valid order', async () => {
            // Mock fetching order
            mockSingle.mockResolvedValue({ data: mockOrder, error: null });

            // Mock Razorpay creation
            const mockInvoice = {
                id: 'inv_123',
                invoice_number: 'INV-001',
                short_url: 'https://rzp.io/i/123'
            };
            RazorpayInvoiceService.createInvoice.mockResolvedValue(mockInvoice);

            const result = await InvoiceOrchestrator.generateInvoiceForOrder(orderId);

            if (!result.success) {
                console.error('Test Failed Error:', result.error);
            }

            expect(result.success).toBe(true);
            expect(result.invoiceId).toBe('inv_123');

            // Verify SB updates
            // 1. Pending
            expect(mockUpdate).toHaveBeenCalledWith({ invoice_status: INVOICE_STATUS.PENDING });
            // 2. Generated
            expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
                invoice_id: 'inv_123',
                invoice_status: INVOICE_STATUS.GENERATED
            }));

            // Verify Email
            expect(emailService.send).toHaveBeenCalledWith(
                'GST_INVOICE_GENERATED',
                'test@example.com',
                expect.any(Object),
                expect.any(String),
                orderId
            );
        });

        test('should return existing invoice if already present', async () => {
            const existingOrder = { ...mockOrder, invoice_id: 'inv_existing', invoice_url: 'url' };
            mockSingle.mockResolvedValue({ data: existingOrder, error: null });

            const result = await InvoiceOrchestrator.generateInvoiceForOrder(orderId);

            expect(result.success).toBe(true);
            expect(result.alreadyExists).toBe(true);
            expect(result.invoiceId).toBe('inv_existing');
            expect(RazorpayInvoiceService.createInvoice).not.toHaveBeenCalled();
        });

        test('should fail if order not found', async () => {
            mockSingle.mockResolvedValue({ data: null, error: null });

            const result = await InvoiceOrchestrator.generateInvoiceForOrder(orderId);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Order not found');
        });

        test('should handle Razorpay failure and update status to FAILED', async () => {
            mockSingle.mockResolvedValue({ data: mockOrder, error: null });

            RazorpayInvoiceService.createInvoice.mockRejectedValue(new Error('Razorpay Error'));

            const result = await InvoiceOrchestrator.generateInvoiceForOrder(orderId);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Razorpay Error');

            // Verify status update to FAILED via the update chain
            // Note: In implementation, update is called on specific chains.
            // We need to verify that `update({ invoice_status: FAILED })` was called.

            // The implementation calls update twice in success flow (PENDING, GENERATED)
            // In failure flow (PENDING, then FAILED in catch block)
            expect(mockUpdate).toHaveBeenCalledWith({ invoice_status: INVOICE_STATUS.FAILED });
        });
    });
});
