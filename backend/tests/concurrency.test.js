const { supabaseAdmin } = require('../config/supabase');
const { updateOrderStatus } = require('../services/order.service');

describe('Concurrency & Architectural Hardening Tests', () => {
    // Increase timeout for stress tests
    jest.setTimeout(30000);

    const TEST_VARIANT_ID = '77777777-7777-7777-7777-777777777777';
    const TEST_ORDER_ID = '99999999-9999-9999-9999-999999999999';

    beforeAll(async () => {
        // Setup initial states
        await supabaseAdmin.from('product_variants').upsert({ 
            id: TEST_VARIANT_ID, 
            stock_quantity: 5, 
            sku: 'TEST_STRESS_JEST' 
        });
    });

    test('Atomic Inventory: 50 concurrent buyers should only result in 5 successful orders', async () => {
        const checkoutPromises = [];
        for (let i = 0; i < 50; i++) {
            checkoutPromises.push(
                supabaseAdmin.rpc('create_order_transactional', {
                    p_user_id: '00000000-0000-4000-8000-000000000001',
                    p_order_data: { total_amount: 100 },
                    p_order_items: [{ variant_id: TEST_VARIANT_ID, quantity: 1, title: 'Stress Test' }],
                    p_payment_id: null,
                    p_cart_id: null,
                    p_coupon_code: null,
                    p_order_number: `STRESS_JEST_${i}`
                })
            );
        }

        const results = await Promise.all(checkoutPromises);
        
        const successes = results.filter(r => r.data?.success === true);
        const failures = results.filter(r => r.error?.message?.includes('INSUFFICIENT_STOCK'));

        expect(successes.length).toBe(5);
        expect(failures.length).toBe(45);
        
        const { data: finalVariant } = await supabaseAdmin
            .from('product_variants')
            .select('stock_quantity')
            .eq('id', TEST_VARIANT_ID)
            .single();
            
        expect(finalVariant.stock_quantity).toBe(0);
    });

    test('Refund Idempotency: Dual cancellation should only create one refund', async () => {
        // Reset order
        await supabaseAdmin.from('orders').upsert({ 
            id: TEST_ORDER_ID, 
            status: 'confirmed', 
            payment_status: 'paid', 
            total_amount: 500,
            version: 0
        });

        // Simulating simultaneous cancellation by User and Admin
        const cancelPromises = [
            updateOrderStatus(TEST_ORDER_ID, 'cancelled_by_customer', 'user123', 'Customer cancelled', 'customer'),
            updateOrderStatus(TEST_ORDER_ID, 'cancelled_by_admin', 'admin123', 'Admin cancelled', 'admin')
        ];

        await Promise.allSettled(cancelPromises);

        const { data: updatedOrder } = await supabaseAdmin.from('orders').select('status, version').eq('id', TEST_ORDER_ID).single();
        const { data: refunds } = await supabaseAdmin.from('refunds').select('id').eq('order_id', TEST_ORDER_ID);

        // One should have won, status should be either of the cancellations
        expect(['cancelled_by_customer', 'cancelled_by_admin']).toContain(updatedOrder.status);
        expect(updatedOrder.version).toBe(1);
        expect(refunds.length).toBe(1);
    });
});
