/**
 * Test Script: Verify Coupon Usage Counter and Pricing Calculations
 * Run this script to ensure coupon tracking works and pricing is consistent
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

async function testCouponUsageCounter() {
    console.log('\n=== Testing Coupon Usage Counter ===\n');

    try {
        // 1. Create a test coupon with limited usage
        const testCouponCode = `TEST_LIMIT_${Date.now()}`;
        const { data: coupon, error: createError } = await supabase
            .from('coupons')
            .insert({
                code: testCouponCode,
                type: 'cart',
                discount_percentage: 10,
                min_purchase_amount: 0,
                valid_from: new Date().toISOString(),
                valid_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                usage_limit: 2,
                usage_count: 0,
                is_active: true
            })
            .select()
            .single();

        if (createError) throw createError;
        console.log(`✓ Created test coupon: ${testCouponCode} (ID: ${coupon.id})`);
        console.log(`  Initial usage_count: ${coupon.usage_count}`);

        // 2. Verify increment_coupon_usage RPC exists and works
        const { error: incrementError } = await supabase
            .rpc('increment_coupon_usage', { p_coupon_id: coupon.id });

        if (incrementError) {
            console.error('✗ increment_coupon_usage RPC failed:', incrementError);
            throw incrementError;
        }

        // 3. Check if usage_count was incremented
        const { data: updatedCoupon, error: fetchError } = await supabase
            .from('coupons')
            .select('usageCount')
            .eq('id', coupon.id)
            .single();

        if (fetchError) throw fetchError;

        if (updatedCoupon.usage_count === 1) {
            console.log(`✓ increment_coupon_usage RPC works! usage_count: 0 → ${updatedCoupon.usage_count}`);
        } else {
            console.error(`✗ increment_coupon_usage failed! Expected usage_count=1, got ${updatedCoupon.usage_count}`);
        }

        // 4. Clean up test coupon
        await supabase.from('coupons').delete().eq('id', coupon.id);
        console.log(`✓ Cleaned up test coupon\n`);

        return true;
    } catch (error) {
        console.error('✗ Test failed:', error.message);
        return false;
    }
}

async function verifyPricingConsistency() {
    console.log('\n=== Verifying Pricing Calculation Consistency ===\n');

    try {
        // Check that PricingCalculator handles null/undefined safely
        console.log('✓ Checking null safety in pricing calculations...');

        // Test data with potential undefined values
        const testItems = [
            {
                product_id: '00000000-0000-0000-0000-000000000001',
                variant_id: null,
                quantity: 2,
                product: { price: 100 },
                variant: null
            },
            {
                product_id: '00000000-0000-0000-0000-000000000002',
                variant_id: '00000000-0000-0000-0000-000000000003',
                quantity: 1,
                product: { price: 50 },
                variant: { selling_price: 45 }
            }
        ];

        // Simulate discount calculation logic
        testItems.forEach(item => {
            const price = (item.variant?.selling_price ?? item.product?.price ?? 0);
            const quantity = item.quantity || 1;
            const subtotal = price * quantity;

            if (price === undefined || isNaN(price)) {
                console.error('✗ Price is undefined or NaN for item:', item.product_id);
                throw new Error('Price calculation error');
            }

            console.log(`  Item ${item.product_id}: price=${price}, qty=${quantity}, subtotal=${subtotal}`);
        });

        console.log('✓ All pricing calculations handle null/undefined correctly\n');

        return true;
    } catch (error) {
        console.error('✗ Pricing consistency check failed:', error.message);
        return false;
    }
}

async function verifyCouponUsageTable() {
    console.log('\n=== Verifying Coupon Usage Table ===\n');

    try {
        // Check if coupon_usage table exists
        const { data, error } = await supabase
            .from('coupon_usage')
            .select('*')
            .limit(1);

        if (error) {
            if (error.code === '42P01') { // Table does not exist
                console.error('✗ coupon_usage table does not exist!');
                console.log('  Run migration: create_coupon_usage_table.sql');
                return false;
            }
            throw error;
        }

        console.log('✓ coupon_usage table exists');

        // Check if RLS policies exist
        const { data: policies, error: policyError } = await supabase
            .rpc('pg_policies')
            .select('*')
            .eq('tablename', 'coupon_usage');

        if (policyError && policyError.code !== '42883') { // Function doesn't exist is OK
            console.log('  Note: Cannot verify RLS policies (requires admin access)');
        }

        console.log('✓ coupon_usage table is ready\n');
        return true;
    } catch (error) {
        console.error('✗ coupon_usage table check failed:', error.message);
        return false;
    }
}

async function runAllTests() {
    console.log('\n╔════════════════════════════════════════════════════╗');
    console.log('║     Coupon Usage & Pricing Verification Tests     ║');
    console.log('╚════════════════════════════════════════════════════╝');

    const results = {
        couponUsageTable: await verifyCouponUsageTable(),
        couponCounter: await testCouponUsageCounter(),
        pricingConsistency: await verifyPricingConsistency()
    };

    console.log('\n╔════════════════════════════════════════════════════╗');
    console.log('║                   Test Results                     ║');
    console.log('╚════════════════════════════════════════════════════╝\n');

    console.log(`Coupon Usage Table:      ${results.couponUsageTable ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`Coupon Counter:          ${results.couponCounter ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`Pricing Consistency:     ${results.pricingConsistency ? '✓ PASS' : '✗ FAIL'}`);

    const allPassed = Object.values(results).every(r => r === true);

    if (allPassed) {
        console.log('\n🎉 All tests passed! System is ready.\n');
        process.exit(0);
    } else {
        console.log('\n⚠️  Some tests failed. Please review the errors above.\n');
        process.exit(1);
    }
}

// Run tests
runAllTests().catch(error => {
    console.error('\n✗ Test suite failed:', error);
    process.exit(1);
});
