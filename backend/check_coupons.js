const supabase = require('./config/supabase');

async function checkCoupons() {
    try {
        const currentTime = new Date().toISOString();
        console.log('Current Time:', currentTime);

        const { data: coupons, error } = await supabase
            .from('coupons')
            .select('*');

        if (error) {
            console.error('Error fetching coupons:', error);
            return;
        }

        console.log('Total coupons:', coupons.length);

        const activeCoupons = coupons.filter(c =>
            c.is_active &&
            new Date(c.valid_from) <= new Date() &&
            new Date(c.valid_until) >= new Date()
        );

        console.log('Active coupons:', activeCoupons.length);
        activeCoupons.forEach(c => {
            console.log(`- Code: ${c.code}, Type: ${c.type}, Valid Until: ${c.valid_until}, Usage: ${c.usage_count}/${c.usage_limit}`);
        });

        if (activeCoupons.length === 0) {
            console.log('\nNo active coupons found. Here are all coupons for debugging:');
            coupons.forEach(c => {
                console.log(`- Code: ${c.code}, Active: ${c.is_active}, From: ${c.valid_from}, Until: ${c.valid_until}, Usage: ${c.usage_count}/${c.usage_limit}`);
            });
        }
    } catch (err) {
        console.error('Unexpected error:', err);
    } finally {
        process.exit();
    }
}

checkCoupons();
