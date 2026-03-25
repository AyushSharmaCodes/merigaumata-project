const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });
const { supabaseAdmin } = require(path.join(__dirname, '../backend/config/supabase'));

async function getProductDetails() {
    try {
        const { data: products, error } = await supabaseAdmin
            .from('products')
            .select('id, title, description, images');

        if (error) throw error;

        const { data: variants, error: vError } = await supabaseAdmin
            .from('product_variants')
            .select('id, product_id, size_label, size_value, unit, variant_image_url');

        if (vError) throw vError;

        console.log(JSON.stringify({ products, variants }, null, 2));
    } catch (error) {
        console.error('Error:', error.message);
    }
}

getProductDetails().then(() => process.exit(0));
