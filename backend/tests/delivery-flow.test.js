jest.mock('../services/pricing-calculator.service', () => ({
    PricingCalculator: {
        calculateCheckoutTotals: jest.fn()
    }
}));

const { DeliveryChargeService } = require('../services/delivery-charge.service');
const { PricingCalculator } = require('../services/pricing-calculator.service');
const CartService = require('../services/cart.service');

describe('Delivery Charge Flow', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        DeliveryChargeService.invalidateCaches();
    });

    test('should calculate correct delivery charge for a single PER_ITEM config', async () => {
        const config = {
            id: 'cfg-1',
            source: 'product',
            calculation_type: 'PER_ITEM',
            base_delivery_charge: 50,
            gst_percentage: 18,
            is_taxable: true,
            gst_mode: 'inclusive',
            delivery_refund_policy: 'NON_REFUNDABLE'
        };

        const result = await DeliveryChargeService.calculateDeliveryCharge(
            'product-1',
            null,
            1,
            false,
            config,
            true
        );

        expect(result.deliveryCharge).toBe(42.37);
        expect(result.deliveryGST).toBe(7.63);
        expect(result.totalDelivery).toBe(50);
        expect(result.snapshot.calculation_type).toBe('PER_ITEM');
        expect(result.snapshot.delivery_refund_policy).toBe('NON_REFUNDABLE');
    });

    test('should calculate correct delivery charge for multiple PER_ITEM quantities', async () => {
        const config = {
            id: 'cfg-1',
            source: 'product',
            calculation_type: 'PER_ITEM',
            base_delivery_charge: 50,
            gst_percentage: 18,
            is_taxable: true,
            gst_mode: 'inclusive',
            delivery_refund_policy: 'NON_REFUNDABLE'
        };

        const result = await DeliveryChargeService.calculateDeliveryCharge(
            'product-1',
            null,
            2,
            false,
            config,
            true
        );

        expect(result.deliveryCharge).toBe(84.75);
        expect(result.deliveryGST).toBe(15.25);
        expect(result.totalDelivery).toBe(100);
    });

    test('should reflect delivery charges in cart totals', async () => {
        const mockFullCart = {
            id: 'cart-1',
            applied_coupon_code: null,
            cart_items: [
                {
                    id: 'ci1',
                    product_id: 'product-1',
                    variant_id: null,
                    quantity: 2,
                    products: {
                        id: 'product-1',
                        title: 'Test Delivery Product',
                        price: 100,
                        mrp: 100,
                        delivery_charge: 0
                    },
                    product_variants: null
                }
            ]
        };

        PricingCalculator.calculateCheckoutTotals.mockResolvedValue({
            items_count: 2,
            total_mrp: 200,
            total_selling_price: 200,
            mrp_discount: 0,
            coupon: null,
            coupon_code: null,
            coupon_discount: 0,
            delivery_charge: 296.61,
            delivery_gst: 53.39,
            global_delivery_charge: 211.86,
            global_delivery_gst: 38.14,
            product_delivery_charges: 84.75,
            product_delivery_gst: 15.25,
            final_amount: 550,
            delivery_settings: {
                threshold: 1500,
                charge: 250,
                gst: 18
            },
            tax: {
                total_taxable_amount: 200,
                cgst: 0,
                sgst: 0,
                igst: 0,
                total_tax: 0,
                tax_type: 'INTRA',
                is_inter_state: false
            },
            items: [
                {
                    product_id: 'product-1',
                    variant_id: null,
                    quantity: 2,
                    unit_mrp: 100,
                    unit_price: 100,
                    discounted_unit_price: 100,
                    delivery_charge: 84.75,
                    delivery_gst: 15.25,
                    delivery_meta: {
                        calculation_type: 'PER_ITEM',
                        base_charge: 50
                    },
                    coupon_discount: 0,
                    tax_breakdown: {
                        taxable_amount: 200,
                        total_tax: 0,
                        gst_rate: 0
                    }
                }
            ]
        });

        const totals = await CartService.calculateCartTotals(null, 'guest-1', mockFullCart);

        expect(totals.totalPrice).toBe(200);
        expect(totals.deliveryCharge).toBe(296.61);
        expect(totals.deliveryGST).toBe(53.39);
        expect(totals.finalAmount).toBe(550);
        expect(totals.productDeliveryCharges).toBe(84.75);
        expect(totals.globalDeliveryCharge).toBe(211.86);

        const itemBreakdown = totals.itemBreakdown[0];
        expect(itemBreakdown.delivery_charge).toBe(84.75);
        expect(itemBreakdown.delivery_gst).toBe(15.25);
        expect(itemBreakdown.delivery_meta).toBeDefined();
        expect(itemBreakdown.delivery_meta.calculation_type).toBe('PER_ITEM');
        expect(itemBreakdown.delivery_meta.base_charge).toBe(50);
    });
});
