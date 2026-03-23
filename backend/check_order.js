require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function testFixedQuery() {
    const orderId = '90d8b8d7-d34e-44ea-b59f-d89d30358e24';
    console.log('Testing FIXED query for order:', orderId);

    const { data, error } = await supabase
        .from('orders')
        .select(`
            *,
            order_status_history (*)
        `)
        .eq('id', orderId)
        .maybeSingle();

    if (error) {
        console.error('Query Error:', JSON.stringify(error, null, 2));
    } else {
        console.log('Query Result:', data ? 'Found' : 'Not Found');
        if (data) {
            console.log('Order Number:', data.order_number);
            console.log('Status History Count:', data.order_status_history ? data.order_status_history.length : 0);
        }
    }
}

testFixedQuery();
