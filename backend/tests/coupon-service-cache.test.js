const mockSingle = jest.fn();
const mockIlike = jest.fn(() => ({ single: mockSingle }));
const mockSelect = jest.fn(() => ({ ilike: mockIlike }));
const mockFrom = jest.fn(() => ({ select: mockSelect }));

jest.mock('../lib/supabase', () => ({
    from: mockFrom
}));

const CouponService = require('../services/coupon.service');

describe('coupon.service query reduction', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('validateCoupon forceLive performs a single coupon read', async () => {
        mockSingle.mockResolvedValue({
            data: {
                id: 'coupon-1',
                code: 'SAVE10',
                type: 'cart',
                discount_percentage: 10,
                min_purchase_amount: 0,
                max_discount_amount: null,
                valid_from: '2026-01-01T00:00:00.000Z',
                valid_until: '2026-12-31T23:59:59.000Z',
                usage_limit: 100,
                usage_count: 2,
                is_active: true
            },
            error: null
        });

        const result = await CouponService.validateCoupon(
            'SAVE10',
            'user-1',
            [{ product_id: 'product-1', quantity: 1, product: { category: 'general', price: 100 } }],
            100,
            true
        );

        expect(result.valid).toBe(true);
        expect(mockFrom).toHaveBeenCalledTimes(1);
        expect(mockSelect).toHaveBeenCalledTimes(1);
        expect(mockIlike).toHaveBeenCalledWith('code', 'SAVE10');
        expect(mockSingle).toHaveBeenCalledTimes(1);
    });
});
