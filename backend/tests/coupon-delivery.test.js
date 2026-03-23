const CouponService = require('../services/coupon.service');

jest.mock('../services/coupon.service', () => {
    const originalModule = jest.requireActual('../services/coupon.service');
    return {
        ...originalModule,
        validateCoupon: jest.fn()
    };
});

const {
    calculateCouponDiscount,
    getCouponPriority,
    validateCoupon
} = CouponService;
const CartService = require('../services/cart.service');

describe('Coupon & Delivery Logic', () => {
    const mockCartItems = [
        {
            product_id: 'p1',
            variant_id: 'v1',
            quantity: 2,
            product: { category: 'Dairy', price: 100, delivery_charge: 10 },
            variant: { selling_price: 90, mrp: 100, delivery_charge: 5 }
        },
        {
            product_id: 'p2',
            variant_id: 'v2',
            quantity: 1,
            product: { category: 'Bakery', price: 200, delivery_charge: 20 },
            variant: { selling_price: 180, mrp: 200, delivery_charge: null } // Should fallback to product
        }
    ];

    describe('getCouponPriority', () => {
        test('should return correct priorities', () => {
            expect(getCouponPriority('variant')).toBe(4);
            expect(getCouponPriority('product')).toBe(3);
            expect(getCouponPriority('category')).toBe(2);
            expect(getCouponPriority('cart')).toBe(1);
        });
    });

    describe('calculateCouponDiscount', () => {
        test('should calculate VARIANT level discount correctly', () => {
            const coupon = {
                type: 'variant',
                target_id: 'v1',
                discount_percentage: 10
            };

            // Item 1: price 90, qty 2 = 180. 10% of 180 = 18.
            const result = calculateCouponDiscount(coupon, mockCartItems, 360);
            expect(result.totalDiscount).toBe(18);
            expect(result.itemDiscounts).toHaveLength(1);
            expect(result.itemDiscounts[0].discount).toBe(18);
            expect(result.itemDiscounts[0].variant_id).toBe('v1');
        });

        test('should calculate PRODUCT level discount correctly', () => {
            const coupon = {
                type: 'product',
                target_id: 'p2',
                discount_percentage: 20
            };

            // Item 2: price 180, qty 1 = 180. 20% of 180 = 36.
            const result = calculateCouponDiscount(coupon, mockCartItems, 360);
            expect(result.totalDiscount).toBe(36);
            expect(result.itemDiscounts[0].product_id).toBe('p2');
        });

        test('should calculate CATEGORY level discount correctly', () => {
            const coupon = {
                type: 'category',
                target_id: 'Dairy',
                discount_percentage: 5
            };

            // Item 1 (Dairy): 180 * 0.05 = 9.
            const result = calculateCouponDiscount(coupon, mockCartItems, 360);
            expect(result.totalDiscount).toBe(9);
        });

        test('should calculate CART level discount correctly', () => {
            const coupon = {
                type: 'cart',
                discount_percentage: 10,
                max_discount_amount: 30
            };

            // Total 360. 10% = 36. Capped at 30.
            const result = calculateCouponDiscount(coupon, mockCartItems, 360);
            expect(result.totalDiscount).toBe(30);
            // Should distribute 30 proportionally or just give total
            // Our implementation distributes it proportionally to items.
        });
    });

    describe('CartService.calculateCartTotals (Delivery Charges)', () => {
        test('should calculate delivery charges correctly at variant and product levels', async () => {
            const mockFullCart = {
                applied_coupon_code: null,
                cart_items: [
                    {
                        product_id: 'p1',
                        variant_id: 'v1',
                        quantity: 2,
                        products: { delivery_charge: 10, price: 100 },
                        product_variants: { delivery_charge: 5, selling_price: 90, mrp: 100 }
                    },
                    {
                        product_id: 'p2',
                        variant_id: 'v2',
                        quantity: 1,
                        products: { delivery_charge: 20, price: 200 },
                        product_variants: { delivery_charge: null, selling_price: 180, mrp: 200 }
                    }
                ]
            };

            // Test logic inside calculateCartTotals
            // Item 1: Qty 2, Variant Delivery 5 -> 10.
            // Item 2: Qty 1, Variant Delivery null -> Product Delivery 20 -> 20.
            // Total Product Delivery Charges: 10 + 20 = 30.

            const totals = await CartService.calculateCartTotals('u1', null, mockFullCart);

            expect(totals.productDeliveryCharges).toBe(30);
            expect(totals.itemBreakdown).toHaveLength(2);
            expect(totals.itemBreakdown[0].delivery_charge).toBe(10);
            expect(totals.itemBreakdown[1].delivery_charge).toBe(20);
        });

        test('should apply coupon and show item breakdown correctly', async () => {
            const mockFullCart = {
                applied_coupon_code: 'SAVE10',
                cart_items: [
                    {
                        product_id: 'p1',
                        variant_id: 'v1',
                        quantity: 1,
                        products: { delivery_charge: 0, price: 100 },
                        product_variants: { delivery_charge: 0, selling_price: 100, mrp: 100 }
                    }
                ]
            };

            CouponService.validateCoupon.mockResolvedValue({
                valid: true,
                coupon: {
                    code: 'SAVE10',
                    type: 'cart',
                    discount_percentage: 10
                }
            });

            const totals = await CartService.calculateCartTotals('u1', null, mockFullCart);

            expect(totals.couponDiscount).toBe(10);
            expect(totals.itemBreakdown[0].coupon_discount).toBe(10);
            expect(totals.itemBreakdown[0].coupon_code).toBe('SAVE10');
        });
    });
});


