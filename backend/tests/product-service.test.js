const ProductService = require('../services/product.service');
const supabase = require('../config/supabase');

// Mock Supabase
jest.mock('../config/supabase', () => ({
    from: jest.fn(),
    rpc: jest.fn(),
    startTransaction: jest.fn()
}));

function buildMaybeSingleChain(result) {
    return {
        maybeSingle: jest.fn().mockResolvedValue(result)
    };
}

function buildEqChain(result) {
    return {
        eq: jest.fn().mockReturnValue(buildMaybeSingleChain(result))
    };
}

describe('ProductService Tax Metadata', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    test('createProduct should persist the current product schema and active delivery config', async () => {
        const categoryId = '11111111-1111-1111-1111-111111111111';
        const createdProduct = {
            id: 'prod-1',
            title: 'Test Product'
        };

        const productSingle = jest.fn().mockResolvedValue({ data: createdProduct, error: null });
        const productSelect = jest.fn().mockReturnValue({ single: productSingle });
        const productInsert = jest.fn().mockReturnValue({ select: productSelect });
        const configInsert = jest.fn().mockResolvedValue({ data: null, error: null });

        supabase.from.mockImplementation((table) => {
            if (table === 'products') return { insert: productInsert };
            if (table === 'delivery_configs') return { insert: configInsert };
            return {};
        });

        await ProductService.createProduct({
            title: 'Test Product',
            description: 'Fresh milk',
            title_i18n: { hi: 'परीक्षण उत्पाद' },
            description_i18n: {},
            price: 100,
            mrp: 120,
            images: ['https://example.com/product.jpg'],
            category: 'Dairy',
            category_id: categoryId,
            tags: ['organic'],
            benefits: ['protein'],
            inventory: 12,
            variant_mode: 'UNIT',
            isReturnable: true,
            returnDays: 5,
            isNew: true,
            createdAt: '2026-04-18T00:00:00.000Z',
            default_hsn_code: '1234',
            default_gst_rate: 12,
            default_tax_applicable: true,
            default_price_includes_tax: true,
            delivery_config: {
                is_active: true,
                calculation_type: 'FLAT_PER_ORDER',
                base_delivery_charge: 45,
                gst_percentage: 18,
                is_taxable: true,
                delivery_refund_policy: 'NON_REFUNDABLE'
            }
        });

        expect(supabase.from).toHaveBeenCalledWith('products');
        expect(productInsert).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Test Product',
            description: 'Fresh milk',
            title_i18n: expect.objectContaining({ en: 'Test Product', hi: 'परीक्षण उत्पाद' }),
            description_i18n: expect.objectContaining({ en: 'Fresh milk' }),
            images: ['https://example.com/product.jpg'],
            category: 'Dairy',
            category_id: categoryId,
            tags: ['organic'],
            benefits: ['protein'],
            inventory: 12,
            variant_mode: 'UNIT',
            is_returnable: true,
            return_days: 5,
            is_new: true,
            created_at: '2026-04-18T00:00:00.000Z',
            default_hsn_code: '1234',
            default_gst_rate: 12,
            default_tax_applicable: true,
            default_price_includes_tax: true
        }));
        expect(configInsert).toHaveBeenCalledWith(expect.objectContaining({
            scope: 'PRODUCT',
            product_id: 'prod-1',
            calculation_type: 'FLAT_PER_ORDER',
            base_delivery_charge: 45,
            delivery_refund_policy: 'NON_REFUNDABLE',
            is_active: true
        }));
    });

    test('updateProduct should normalize camelCase fields and remove product delivery config when disabled', async () => {
        const productId = '22222222-2222-2222-2222-222222222222';

        const productSingle = jest.fn().mockResolvedValue({ data: { id: productId }, error: null });
        const productSelect = jest.fn().mockReturnValue({ single: productSingle });
        const productEq = jest.fn().mockReturnValue({ select: productSelect });
        const productUpdate = jest.fn().mockReturnValue({ eq: productEq });

        const configDeleteByProduct = jest.fn().mockResolvedValue({ error: null });
        const configDeleteByScope = jest.fn().mockReturnValue({ eq: configDeleteByProduct });
        const configDelete = jest.fn().mockReturnValue({ eq: configDeleteByScope });
        const configInsert = jest.fn();

        supabase.from.mockImplementation((table) => {
            if (table === 'products') return { update: productUpdate };
            if (table === 'delivery_configs') {
                return {
                    delete: configDelete,
                    insert: configInsert
                };
            }
            return {};
        });

        await ProductService.updateProduct(productId, {
            title: 'Updated Product',
            isReturnable: false,
            returnDays: 0,
            delivery_config: {
                is_active: false,
                calculation_type: 'FLAT_PER_ORDER'
            }
        });

        expect(productUpdate).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Updated Product',
            is_returnable: false,
            return_days: 0
        }));
        expect(productEq).toHaveBeenCalledWith('id', productId);
        expect(configDeleteByScope).toHaveBeenCalledWith('scope', 'PRODUCT');
        expect(configDeleteByProduct).toHaveBeenCalledWith('product_id', productId);
        expect(configInsert).not.toHaveBeenCalled();
    });

    describe('getProductById', () => {
        test('should successfully fetch product with variants and delivery configs', async () => {
            const productId = '5fe9f977-d4d1-4413-aa15-189f40ecbf6f';
            const mockProduct = {
                id: productId,
                title: 'Test Product',
                category_data: null,
                variant_mode: 'UNIT',
                is_returnable: true,
                return_days: 3
            };
            const mockVariants = [{ id: 'v1', product_id: productId, size_label: '1 KG', size_value: 1, unit: 'kg', selling_price: 120, is_default: true }];
            const mockProductConfigs = [{ scope: 'PRODUCT', product_id: productId, calculation_type: 'FLAT_PER_ORDER', is_active: true }];
            const mockVariantConfigs = [{ scope: 'VARIANT', variant_id: 'v1', calculation_type: 'PER_ITEM', is_active: true }];

            supabase.from.mockImplementation((table) => {
                if (table === 'products') {
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn().mockReturnValue({
                                maybeSingle: jest.fn().mockResolvedValue({ data: mockProduct, error: null })
                            })
                        })
                    };
                }

                if (table === 'product_variants') {
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn().mockResolvedValue({ data: mockVariants, error: null })
                        })
                    };
                }

                if (table === 'delivery_configs') {
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn().mockImplementation((field, value) => {
                                if (field === 'scope' && value === 'PRODUCT') {
                                    return {
                                        eq: jest.fn().mockResolvedValue({ data: mockProductConfigs, error: null })
                                    };
                                }

                                if (field === 'scope' && value === 'VARIANT') {
                                    return {
                                        in: jest.fn().mockResolvedValue({ data: mockVariantConfigs, error: null })
                                    };
                                }

                                return {};
                            })
                        })
                    };
                }

                return {};
            });

            const result = await ProductService.getProductById(productId);

            expect(result.id).toBe(productId);
            expect(result.delivery_config).toBeDefined();
            expect(result.variants.length).toBe(1);
            expect(result.variants[0].delivery_config).toBeDefined();
            expect(supabase.from).toHaveBeenCalledWith('products');
            expect(supabase.from).toHaveBeenCalledWith('product_variants');
            expect(supabase.from).toHaveBeenCalledWith('delivery_configs');
        });
    });
});
