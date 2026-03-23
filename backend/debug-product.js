
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const productId = '42b92a74-79e2-4fc9-8544-7249dc1f41f5';

async function run() {
    console.log(`Fetching product ${productId}...`);

    // Try with single() first to reproduce
    try {
        const { data, error } = await supabase
            .from('products')
            .select('*, variants:product_variants(*), category_data:categories(*)')
            .eq('id', productId)
            .single();

        if (error) {
            console.error('Error with single():', error);
        } else {
            console.log('Success with single():', data);
        }
    } catch (e) {
        console.error('Exception with single():', e);
    }

    // Try without single() to see what returns
    try {
        const { data, error } = await supabase
            .from('products')
            .select('*, variants:product_variants(*), category_data:categories(*)')
            .eq('id', productId);

        if (error) {
            console.error('Error without single():', error);
        } else {
            console.log(`Success without single(). Count: ${data.length}`);
            if (data.length > 0) {
                console.log('First Item:', JSON.stringify(data[0], null, 2));
                if (data.length > 1) {
                    console.log('Second Item:', JSON.stringify(data[1], null, 2));
                }
            } else {
                console.log('No data returned');
            }
        }
    } catch (e) {
        console.error('Exception without single():', e);
    }

    // Check if it is a variant ID
    try {
        const { data, error } = await supabase
            .from('product_variants')
            .select('*')
            .eq('id', productId)
            .single();

        if (error) {
            console.error('Error checking variant:', error);
        } else {
            console.log('Found ID in product_variants:', data);
        }
    } catch (e) {
        console.error('Exception checking variant:', e);
    }
}

run();
