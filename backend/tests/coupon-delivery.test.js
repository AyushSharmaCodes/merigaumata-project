const CouponService = require('../services/coupon.service');

jest.mock('../services/coupon.service', () => {
    const originalModule = jest.requireActual('../services/coupon.service');
    return {
        ...originalModule,
        validateCoupon: jest.fn()
    };
});

jest.mock('../services/pricing-calculator.service', () => ({
    PricingCalculator: {
        calculateCheckoutTotals: jest.fn()
    }
}));

const {
    calculateCouponDiscount,
    getCouponPriority
} = CouponService;
const { PricingCalculator } = require('../services/pricing-calculator.service');
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
            variant: { selling_price: 180, mrp: 200, delivery_charge: null }
        }
    ];

    beforeEach(() => {
        jest.clearAllMocks();
    });

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

            const result = calculateCouponDiscount(coupon, mockCartItems, 360);
            expect(result.totalDiscount).toBe(9);
        });

        test('should calculate CART level discount correctly', () => {
            const coupon = {
                type: 'cart',
                discount_percentage: 10,
                max_discount_amount: 30
            };

            const result = calculateCouponDiscount(coupon, mockCartItems, 360);
            expect(result.totalDiscount).toBe(30);
        });
    });

    describe('CartService.calculateCartTotals', () => {
        test('should map delivery and tax breakdown from PricingCalculator output', async () => {
            const mockFullCart = {
                applied_coupon_code: null,
                cart_items: [
                    {
                        id: 'ci1',
                        product_id: 'p1',
                        variant_id: 'v1',
                        quantity: 2,
                        products: { title: 'Product 1', delivery_charge: 10, price: 100 },
                        product_variants: { delivery_charge: 5, selling_price: 90, mrp: 100 }
                    },
                    {
                        id: 'ci2',
                        product_id: 'p2',
                        variant_id: 'v2',
                        quantity: 1,
                        products: { title: 'Product 2', delivery_charge: 20, price: 200 },
                        product_variants: { delivery_charge: null, selling_price: 180, mrp: 200 }
                    }
                ]
            };

            PricingCalculator.calculateCheckoutTotals.mockResolvedValue({
                items_count: 3,
                total_mrp: 400,
                total_selling_price: 360,
                mrp_discount: 40,
                coupon: null,
                coupon_code: null,
                coupon_discount: 0,
                delivery_charge: 30,
                delivery_gst: 0,
                global_delivery_charge: 0,
                global_delivery_gst: 0,
                product_delivery_charges: 30,
                product_delivery_gst: 0,
                final_amount: 390,
                delivery_settings: { threshold: 1500, charge: 50, gst: 18 },
                tax: {
                    total_taxable_amount: 360,
                    cgst: 0,
                    sgst: 0,
                    igst: 0,
                    total_tax: 0,
                    tax_type: 'INTRA',
                    is_inter_state: false
                },
                items: [
                    {
                        product_id: 'p1',
                        variant_id: 'v1',
                        quantity: 2,
                        unit_mrp: 100,
                        unit_price: 90,
                        discounted_unit_price: 90,
                        delivery_charge: 10,
                        delivery_gst: 0,
                        delivery_meta: { source: 'variant', calculation_type: 'PER_ITEM' },
                        coupon_discount: 0,
                        tax_breakdown: { taxable_amount: 180, total_tax: 0, gst_rate: 0 }
                    },
                    {
                        product_id: 'p2',
                        variant_id: 'v2',
                        quantity: 1,
                        unit_mrp: 200,
                        unit_price: 180,
                        discounted_unit_price: 180,
                        delivery_charge: 20,
                        delivery_gst: 0,
                        delivery_meta: { source: 'product', calculation_type: 'PER_ITEM' },
                        coupon_discount: 0,
                        tax_breakdown: { taxable_amount: 180, total_tax: 0, gst_rate: 0 }
                    }
                ]
            });

            const totals = await CartService.calculateCartTotals('u1', null, mockFullCart);

            expect(totals.productDeliveryCharges).toBe(30);
            expect(totals.itemBreakdown).toHaveLength(2);
            expect(totals.itemBreakdown[0].delivery_charge).toBe(10);
            expect(totals.itemBreakdown[1].delivery_charge).toBe(20);
            expect(totals.itemBreakdown[0].tax_breakdown).toEqual({
                taxable_amount: 180,
                total_tax: 0,
                gst_rate: 0
            });
        });

        test('should map coupon details and discounted prices correctly', async () => {
            const mockFullCart = {
                applied_coupon_code: 'SAVE10',
                cart_items: [
                    {
                        id: 'ci1',
                        product_id: 'p1',
                        variant_id: 'v1',
                        quantity: 1,
                        products: { delivery_charge: 0, price: 100 },
                        product_variants: { delivery_charge: 0, selling_price: 100, mrp: 100 }
                    }
                ]
            };

            PricingCalculator.calculateCheckoutTotals.mockResolvedValue({
                items_count: 1,
                total_mrp: 100,
                total_selling_price: 100,
                mrp_discount: 0,
                coupon: { id: 'c1', code: 'SAVE10', type: 'cart', discount_percentage: 10 },
                coupon_code: 'SAVE10',
                coupon_discount: 10,
                delivery_charge: 0,
                delivery_gst: 0,
                global_delivery_charge: 0,
                global_delivery_gst: 0,
                product_delivery_charges: 0,
                product_delivery_gst: 0,
                final_amount: 90,
                delivery_settings: { threshold: 1500, charge: 50, gst: 18 },
                tax: {
                    total_taxable_amount: 90,
                    cgst: 0,
                    sgst: 0,
                    igst: 0,
                    total_tax: 0,
                    tax_type: 'INTRA',
                    is_inter_state: false
                },
                items: [
                    {
                        product_id: 'p1',
                        variant_id: 'v1',
                        quantity: 1,
                        unit_mrp: 100,
                        unit_price: 100,
                        discounted_unit_price: 90,
                        delivery_charge: 0,
                        delivery_gst: 0,
                        delivery_meta: null,
                        coupon_discount: 10,
                        tax_breakdown: { taxable_amount: 90, total_tax: 0, gst_rate: 0 }
                    }
                ]
            });

            const totals = await CartService.calculateCartTotals('u1', null, mockFullCart, { skipValidation: true });

            expect(totals.couponDiscount).toBe(10);
            expect(totals.itemBreakdown[0].coupon_discount).toBe(10);
            expect(totals.itemBreakdown[0].coupon_code).toBe('SAVE10');
            expect(totals.itemBreakdown[0].discounted_price).toBe(90);
            expect(PricingCalculator.calculateCheckoutTotals).toHaveBeenCalledWith(
                expect.any(Array),
                null,
                'SAVE10',
                'u1',
                { skipCouponValidation: true }
            );
        });
    });
});
