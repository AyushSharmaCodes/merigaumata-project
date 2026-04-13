const { supabase, supabaseAdmin } = require('./lib/supabase');
const logger = require('./utils/logger');

async function verify() {
    console.log('--- STARTING SECURITY & PERFORMANCE VERIFICATION ---');

    // 1. Verify Profiles RLS (Public Access)
    console.log('\n[1] Checking Profiles RLS (Public Select)...');
    const { data: publicProfiles, error: publicError } = await supabase
        .from('profiles')
        .select('id, email, name')
        .limit(1);
    
    if (publicProfiles && publicProfiles.length > 0) {
        console.error('❌ FAILURE: Public user can still read profiles!');
        console.log('Data sample:', publicProfiles[0]);
    } else {
        console.log('✅ SUCCESS: Public user cannot read profiles.');
    }

    // 2. Verify Product Stats RPC
    console.log('\n[2] Checking Product Stats RPC...');
    const { data: stats, error: statsError } = await supabase.rpc('get_product_inventory_stats_v1');
    if (statsError) {
        console.error('❌ FAILURE: Product Stats RPC failed!', statsError);
    } else {
        console.log('✅ SUCCESS: Product Stats RPC returned:', stats[0]);
    }

    // 3. Verify Product Batching (Simulate)
    console.log('\n[3] Checking Product Batching (Internal Logic)...');
    const ProductService = require('./services/product.service');
    // We can't easily test the exported string size without a full DB, 
    // but we can verify the method doesn't throw.
    try {
        const csv = await ProductService.exportAllProducts();
        console.log(`✅ SUCCESS: Export generated ${csv.length} bytes.`);
    } catch (err) {
        console.error('❌ FAILURE: Export failed!', err);
    }

    console.log('\n--- VERIFICATION COMPLETE ---');
}

verify();
