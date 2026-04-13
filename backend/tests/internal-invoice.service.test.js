jest.mock('../utils/async-context', () => ({
    getTraceContext: jest.fn().mockReturnValue({ correlationId: 'test-correlation-id' })
}));

jest.mock('fs', () => ({
    existsSync: jest.fn().mockReturnValue(true),
    mkdirSync: jest.fn(),
    writeFileSync: jest.fn()
}));

jest.mock('puppeteer', () => ({
    launch: jest.fn()
}));

jest.mock('../lib/supabase', () => ({
    from: jest.fn()
}));

jest.mock('../services/currency-exchange.service', () => ({
    CurrencyExchangeService: {
        getCurrencyContext: jest.fn()
    }
}));

jest.mock('../services/tax-engine.service', () => ({
    TAX_TYPE: {
        INTER_STATE: 'INTER_STATE',
        INTRA_STATE: 'INTRA_STATE'
    },
    TaxEngine: {
        getSellerStateCode: jest.fn().mockReturnValue('07'),
        extractStateCodeFromAddress: jest.fn().mockReturnValue('09'),
        determineTaxType: jest.fn().mockReturnValue('INTER_STATE')
    }
}));

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

const supabase = require('../lib/supabase');
const InternalInvoiceService = require('../services/internal-invoice.service');
const { CurrencyExchangeService } = require('../services/currency-exchange.service');

describe('InternalInvoiceService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        InternalInvoiceService._contactCache = null;
        InternalInvoiceService._contactCacheTime = 0;

        CurrencyExchangeService.getCurrencyContext.mockResolvedValue({ rate: 0.05 });

        supabase.from.mockImplementation((table) => {
            if (table === 'contact_info') {
                return {
                    select: jest.fn().mockReturnValue({
                        limit: jest.fn().mockReturnValue({
                            single: jest.fn().mockResolvedValue({
                                data: {
                                    address_line1: 'Seller Address',
                                    city: 'Delhi',
                                    state: 'Delhi',
                                    pincode: '110001'
                                }
                            })
                        })
                    })
                };
            }

            if (table === 'contact_emails') {
                return {
                    select: jest.fn().mockReturnValue({
                        eq: jest.fn().mockReturnValue({
                            limit: jest.fn().mockReturnValue({
                                single: jest.fn().mockResolvedValue({
                                    data: { email: 'seller@example.com' }
                                })
                            })
                        })
                    })
                };
            }

            throw new Error(`Unexpected table: ${table}`);
        });
    });

    test('keeps invoice summary totals aligned with converted line-item amounts', async () => {
        const order = {
            id: 'order-1',
            created_at: '2026-04-01T10:00:00.000Z',
            order_number: 'MGM2026N01QMUK4',
            customer_name: 'Ayush Sharma',
            customer_phone: '+917678967890',
            display_currency: 'USD',
            shipping_address: {
                address_line1: 'Plot No 11, Gali No 7, Anand Parbat Indl Area',
                city: 'Central Delhi',
                state: 'Delhi',
                pincode: '110005'
            },
            billing_address: {
                address_line1: 'Plot No 11, Gali No 7, Anand Parbat Indl Area',
                city: 'Central Delhi',
                state: 'Delhi',
                pincode: '110005'
            },
            items: [
                {
                    title: 'Pure Panchgavya Herbal Soap',
                    quantity: 1,
                    total_amount: 85.6,
                    taxable_amount: 72.54,
                    igst: 13.06,
                    gst_rate: 18,
                    hsn_code: '3401',
                    delivery_charge: 36.4,
                    delivery_gst: 6.55,
                    delivery_calculation_snapshot: {
                        gst_rate: 18
                    }
                }
            ]
        };

        const result = await InternalInvoiceService._prepareTemplateData(
            order,
            'INV-2026-000001',
            'TAX INVOICE',
            true
        );

        expect(result.productInvoice.items[0].totalAmount).toBe('4.28');
        expect(result.productInvoice.summary.taxableAmount).toBe('3.63');
        expect(result.productInvoice.summary.totalIgst).toBe('0.65');
        expect(result.productInvoice.summary.grandTotal).toBe('4.28');

        expect(result.deliveryInvoice.items[0].totalAmount).toBe('2.15');
        expect(result.deliveryInvoice.summary.taxableAmount).toBe('1.82');
        expect(result.deliveryInvoice.summary.totalIgst).toBe('0.33');
        expect(result.deliveryInvoice.summary.grandTotal).toBe('2.15');
    });
});
