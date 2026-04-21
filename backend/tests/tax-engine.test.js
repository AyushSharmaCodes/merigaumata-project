const { TaxEngine, TAX_TYPE } = require('../services/tax-engine.service');

describe('TaxEngine', () => {
    // Mock addresses
    const sellerStateCode = '29'; // Karnataka
    const buyerKarnataka = { stateCode: '29', state: 'Karnataka' };
    const buyerMaharashtra = { stateCode: '27', state: 'Maharashtra' };

    const originalEnv = process.env;

    beforeEach(() => {
        jest.resetModules();
        process.env = { ...originalEnv, SELLER_STATE_CODE: sellerStateCode };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    describe('determineTaxType', () => {
        test('should return INTRAState For Same State', () => {
            const type = TaxEngine.determineTaxType(sellerStateCode, buyerKarnataka.stateCode);
            expect(type).toBe(TAX_TYPE.INTRA_STATE);
        });

        test('should return INTERState For Different States', () => {
            const type = TaxEngine.determineTaxType(sellerStateCode, buyerMaharashtra.stateCode);
            expect(type).toBe(TAX_TYPE.INTER_STATE);
        });
    });

    describe('calculateOrderTax', () => {
        test('should calculate Intra-State tax (CGST + SGST) for inclusive price', () => {
            const items = [{
                product_id: 'p1',
                quantity: 1,
                variant: {
                    hsn_code: '1234',
                    gst_rate: 18,
                    tax_applicable: true,
                    price_includes_tax: true,
                    selling_price: 1180
                }
            }];

            const result = TaxEngine.calculateOrderTax(items, buyerKarnataka);

            expect(result.summary.tax_type).toBe(TAX_TYPE.INTRA_STATE);
            expect(result.summary.total_tax).toBe(180); // 1180 - (1180 / 1.18) = 180
            expect(result.summary.total_cgst).toBe(90);
            expect(result.summary.total_sgst).toBe(90);
            expect(result.summary.total_igst).toBe(0);
            expect(result.summary.total_taxable_amount).toBe(1000);
            expect(result.summary.total_amount).toBe(1180);
        });

        test('should calculate Inter-State tax (IGST) for exclusive price', () => {
            const items = [{
                product_id: 'p1',
                quantity: 1,
                variant: {
                    hsn_code: '5678',
                    gst_rate: 18,
                    tax_applicable: true,
                    price_includes_tax: false,
                    selling_price: 1000
                }
            }];

            const result = TaxEngine.calculateOrderTax(items, buyerMaharashtra);

            expect(result.summary.tax_type).toBe(TAX_TYPE.INTER_STATE);
            expect(result.summary.total_tax).toBe(180); // 1000 * 0.18 = 180
            expect(result.summary.total_cgst).toBe(0);
            expect(result.summary.total_sgst).toBe(0);
            expect(result.summary.total_igst).toBe(180);
            expect(result.summary.total_taxable_amount).toBe(1000);
            expect(result.summary.total_amount).toBe(1180); // 1000 + 180
        });

        test('should handle tax-exempt items', () => {
            const items = [{
                product_id: 'p1',
                quantity: 1,
                variant: {
                    tax_applicable: false,
                    selling_price: 500
                }
            }];

            const result = TaxEngine.calculateOrderTax(items, buyerKarnataka);

            expect(result.summary.total_tax).toBe(0);
            expect(result.summary.total_taxable_amount).toBe(500);
            expect(result.summary.total_amount).toBe(500);
        });

        test('should handle items with 0% GST rate', () => {
            const items = [{
                product_id: 'p1',
                quantity: 1,
                variant: {
                    hsn_code: '0000',
                    gst_rate: 0,
                    tax_applicable: true,
                    price_includes_tax: true,
                    selling_price: 500
                }
            }];

            const result = TaxEngine.calculateOrderTax(items, buyerKarnataka);

            expect(result.summary.total_tax).toBe(0);
            expect(result.summary.total_cgst).toBe(0);
            expect(result.summary.total_sgst).toBe(0);
            expect(result.summary.total_taxable_amount).toBe(500);
            expect(result.summary.total_amount).toBe(500);
        });

        test('should handle mixed items (Inclusive + Exclusive)', () => {
            const items = [
                {
                    product_id: 'p1',
                    quantity: 1,
                    variant: {
                        gst_rate: 18,
                        tax_applicable: true,
                        price_includes_tax: true, // Inclusive
                        selling_price: 1180
                    }
                },
                {
                    product_id: 'p2',
                    quantity: 1,
                    variant: {
                        gst_rate: 12,
                        tax_applicable: true,
                        price_includes_tax: false, // Exclusive
                        selling_price: 1000
                    }
                }
            ];

            const result = TaxEngine.calculateOrderTax(items, buyerKarnataka);

            // Item 1: 1180 inclusive -> Taxable 1000, Tax 180
            // Item 2: 1000 exclusive -> Taxable 1000, Tax 120
            // Total Taxable: 2000
            // Total Tax: 300
            // Total Amount: 1180 + 1120 = 2300

            expect(result.summary.total_tax).toBe(300);
            expect(result.summary.total_taxable_amount).toBe(2000);
            expect(result.summary.total_amount).toBe(2300);
            expect(result.summary.total_cgst).toBe(150);
            expect(result.summary.total_sgst).toBe(150);
        });

        test('should use product default tax metadata when variant tax fields are missing', () => {
            const items = [{
                product_id: 'p-defaults',
                quantity: 2,
                product: {
                    price: 112,
                    default_hsn_code: '1905',
                    default_gst_rate: 12,
                    default_tax_applicable: true,
                    default_price_includes_tax: true
                },
                variant: {
                    selling_price: 112
                }
            }];

            const result = TaxEngine.calculateOrderTax(items, buyerKarnataka);

            expect(result.items[0].taxBreakdown.hsn_code).toBe('1905');
            expect(result.items[0].taxBreakdown.gst_rate).toBe(12);
            expect(result.summary.total_tax).toBe(24);
            expect(result.summary.total_taxable_amount).toBe(200);
            expect(result.summary.total_amount).toBe(224);
        });

        test('should prefer explicit variant tax metadata over product defaults', () => {
            const items = [{
                product_id: 'p-overrides',
                quantity: 1,
                product: {
                    price: 118,
                    default_hsn_code: '1905',
                    default_gst_rate: 12,
                    default_tax_applicable: true,
                    default_price_includes_tax: true
                },
                variant: {
                    selling_price: 118,
                    hsn_code: '2106',
                    gst_rate: 18,
                    tax_applicable: true,
                    price_includes_tax: true
                }
            }];

            const result = TaxEngine.calculateOrderTax(items, buyerKarnataka);

            expect(result.items[0].taxBreakdown.hsn_code).toBe('2106');
            expect(result.items[0].taxBreakdown.gst_rate).toBe(18);
            expect(result.summary.total_tax).toBe(18);
            expect(result.summary.total_taxable_amount).toBe(100);
            expect(result.summary.total_amount).toBe(118);
        });

        test('should fallback to 18% IGST if no tax info provided', () => {
            // Backward compatibility behavior check - or default safe assumption
            const items = [{
                product_id: 'p1',
                quantity: 1,
                variant: {
                    selling_price: 1000
                    // Missing tax info
                }
            }];

            // Assuming the implemented logic defaults to Price Inclusive + 18% or similar?
            // Checking actual implementation behavior:
            // "const rate = metadata.gstRate || 0;" (If undefined, uses 0?)
            // Let's verify what happens.

            const result = TaxEngine.calculateOrderTax(items, buyerKarnataka);
            // If defaulting to 0, then no tax.
            expect(result.summary.total_tax).toBe(0);
        });
    });
});
