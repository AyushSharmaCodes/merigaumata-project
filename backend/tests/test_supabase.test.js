const { supabaseAdmin } = require('../lib/supabase');

describe('Order Fetch Test', () => {
    it('Should fetch the order successfully', async () => {
        const id = 'b83d8aaa-db90-403a-a182-d2a5e0674187';
        const { data, error } = await supabaseAdmin
            .from('orders')
            .select(`
                *,
                items:order_items (*, products:product_id(images), product_variants:variant_id(variant_image_url)),
                profiles:profiles!user_id (name, email, phone, preferred_currency),
                shipping_address:addresses!shipping_address_id (*, phone_numbers (*)),
                billing_address:addresses!billing_address_id (*, phone_numbers (*)),
                payments:payments!order_id (*, refunds (*)),
                invoices (*),
                refunds (*),
                order_status_history:order_status_history (*)
            `)
            .eq('id', id)
            .maybeSingle();
            
        console.log('Result Data:', data ? data.id : null);
        console.log('Result Error:', error);
        expect(data).toBeDefined();
    });
});
