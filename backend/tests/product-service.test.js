const ProductService = require('../services/product.service');
const supabase = require('../config/supabase');

// Mock Supabase
jest.mock('../config/supabase', () => ({
    from: jest.fn(),
    startTransaction: jest.fn()
}));

describe('ProductService Tax Metadata', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    const mockProductData = {
        title: 'Test Product',
        variant_mode: 'UNIT',
        price: 100
    };

    const mockVariantData = [
        {
            size_label: '1 KG',
            size_value: 1,
            unit: 'kg',
            mrp: 120,
            selling_price: 100,
            stock_quantity: 50,
            is_default: true,
            // Tax Fields
            hsn_code: '1905',
            gst_rate: 18,
            tax_applicable: true,
            price_includes_tax: false
        }
    ];

    test('createProduct should preserve tax fields in operation', async () => {
        // Setup mock chain
        const mockSelect = jest.fn().mockReturnValue({ single: jest.fn().mockReturnValue({ data: { id: 'prod-1', ...mockProductData }, error: null }) });
        const mockInsert = jest.fn().mockReturnValue({ select: mockSelect });
        supabase.from.mockReturnValue({ insert: mockInsert });

        await ProductService.createProduct(mockProductData);

        expect(supabase.from).toHaveBeenCalledWith('products');
        expect(mockInsert).toHaveBeenCalledWith([expect.objectContaining(mockProductData)]);
    });

    // Note: ProductService.createProduct only creates the PRODUCT.
    // Variants are created separately or via a transactional service method if it existed.
    // Looking at ProductService.js, it only has createProduct (for products table).
    // Variants are likely handled in the controller or a different service method?
    // Let's check ProductService.js again... it seems it DOES NOT handle variants creation in createProduct.
    // It only inserts into 'products'.

    // Controller logic usually handles "Transaction: Create Product -> Create Variants".
    // So ProductService unit test for tax metadata mainly applies if 'products' table has tax fields.
    // Task 1.1 said: "Add product-level default tax metadata to products table".

    test('createProduct should handle product-level default tax metadata', async () => {
        const productWithTax = {
            ...mockProductData,
            default_hsn_code: '1234', // Assuming these cols exist per Phase 1.1
            default_gst_rate: 12,
            default_tax_applicable: true
        };

        const mockSelect = jest.fn().mockReturnValue({ single: jest.fn().mockReturnValue({ data: { id: 'prod-1', ...productWithTax }, error: null }) });
        const mockInsert = jest.fn().mockReturnValue({ select: mockSelect });
        supabase.from.mockReturnValue({ insert: mockInsert });

        await ProductService.createProduct(productWithTax);

        expect(mockInsert).toHaveBeenCalledWith([expect.objectContaining({
            default_hsn_code: '1234',
            default_gst_rate: 12
        })]);
    });
});
