
const { describe, it, expect, beforeAll, afterAll } = require('@jest/globals');
const { DeliveryChargeService } = require('../services/delivery-charge.service');
const { calculateCartTotals } = require('../services/cart.service');
const supabase = require('../config/supabase');
const crypto = require('crypto');
const uuidv4 = () => crypto.randomUUID();

// Mock data
const mockProductId = uuidv4();
const mockVariantId = uuidv4();
const mockGuestId = uuidv4();

describe('Delivery Charge Flow Integration', () => {

    // Setup: Create a temporary product and delivery config
    beforeAll(async () => {
        // 1. Create Mock Product
        const { error: prodError } = await supabase.from('products').insert({
            id: mockProductId,
            title: 'Test Delivery Product',
            price: 100,
            delivery_charge: 0, // Legacy field
            description: 'Test',
            images: [],
            category: 'Test',
            inventory: 100
        });
        if (prodError) throw prodError;

        // 2. Create Delivery Config (Per Item)
        const { error: configError } = await supabase.from('delivery_configs').insert({
            scope: 'PRODUCT',
            product_id: mockProductId,
            calculation_type: 'PER_ITEM',
            base_delivery_charge: 50,
            gst_percentage: 18,
            is_active: true,
            delivery_refund_policy: 'NON_REFUNDABLE'
        });
        if (configError) throw configError;

        // 3. Create Mock Cart
        const { error: cartError } = await supabase.from('carts').insert({
            guest_id: mockGuestId
        });
        if (cartError) throw cartError;
    });

    afterAll(async () => {
        // Cleanup
        await supabase.from('delivery_configs').delete().eq('product_id', mockProductId);
        await supabase.from('cart_items').delete().eq('product_id', mockProductId);
        await supabase.from('carts').delete().eq('guest_id', mockGuestId);
        await supabase.from('products').delete().eq('id', mockProductId);
    });

    it('should calculate correct delivery charge for single item', async () => {
        const result = await DeliveryChargeService.calculateDeliveryCharge(mockProductId, null, 1);
        expect(result.deliveryCharge).toBe(50);
        expect(result.deliveryGST).toBe(9); // 18% of 50 = 9
        expect(result.totalDelivery).toBe(59);
    });

    it('should calculate correct delivery charge for multiple items (PERItem)', async () => {
        const result = await DeliveryChargeService.calculateDeliveryCharge(mockProductId, null, 2);
        expect(result.deliveryCharge).toBe(100); // 50 * 2
        expect(result.deliveryGST).toBe(18); // 18% of 100
        expect(result.totalDelivery).toBe(118);
    });

    it('should reflect delivery charges in cart totals', async () => {
        // Add item to cart
        const { data: cart } = await supabase.from('carts').select('id').eq('guest_id', mockGuestId).single();
        await supabase.from('cart_items').insert({
            cart_id: cart.id,
            product_id: mockProductId,
            quantity: 2
        });

        // Calculate totals
        const totals = await calculateCartTotals(null, mockGuestId);

        expect(totals.totalPrice).toBe(200); // 100 * 2
        expect(totals.deliveryCharge).toBe(100);
        expect(totals.deliveryGST).toBe(18);
        expect(totals.finalAmount).toBe(318); // 200 + 100 + 18

        // Verify breakdown fields
        expect(totals.productDeliveryCharges).toBe(100);
        expect(totals.globalDeliveryCharge).toBe(0);

        // Verify item breakdown has delivery info
        const itemBreakdown = totals.itemBreakdown[0];
        expect(itemBreakdown.delivery_charge).toBe(100);
        expect(itemBreakdown.delivery_gst).toBe(18);

        // Verify delivery_meta
        expect(itemBreakdown.delivery_meta).toBeDefined();
        expect(itemBreakdown.delivery_meta.calculation_type).toBe('PER_ITEM');
        expect(itemBreakdown.delivery_meta.base_charge).toBe(50);
    });
});
