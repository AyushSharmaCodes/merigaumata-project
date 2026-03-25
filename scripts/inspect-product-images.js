const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });
const { supabaseAdmin } = require(path.join(__dirname, '../backend/config/supabase'));

async function inspectProductImages() {
    try {
        const { data: products, error } = await supabaseAdmin
            .from('products')
            .select('id, title, images')
            .limit(10);

        if (error) throw error;

        console.log('Sample Product Images (first 10):');
        products.forEach(p => {
            console.log(`${p.title}: ${JSON.stringify(p.images)}`);
        });

    } catch (error) {
        console.error('Error:', error.message);
    }
}

inspectProductImages().then(() => process.exit(0));
