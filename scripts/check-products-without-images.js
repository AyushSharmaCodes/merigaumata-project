const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });
const { supabaseAdmin } = require(path.join(__dirname, '../backend/config/supabase'));

async function checkProductsWithoutImages() {
    try {
        // 1. Fetch all products
        const { data: products, error: pError } = await supabaseAdmin
            .from('products')
            .select('id, title, images')
            .order('created_at', { ascending: false });

        if (pError) throw pError;

        // 2. Fetch all variants
        const { data: variants, error: vError } = await supabaseAdmin
            .from('product_variants')
            .select('id, product_id, size_label, size_value, unit, variant_image_url')
            .order('created_at', { ascending: false });

        if (vError) throw vError;

        console.log(`Total products: ${products.length}`);
        console.log(`Total variants: ${variants.length}\n`);

        const productsWithoutImages = products.filter(p => !p.images || (Array.isArray(p.images) && p.images.length === 0));
        console.log(`Products without main images: ${productsWithoutImages.length}`);
        productsWithoutImages.forEach((p, i) => {
            console.log(`${i + 1}. [${p.id}] ${p.title}`);
        });

        console.log('\n--- Variants ---\n');

        const variantsWithoutImages = variants.filter(v => !v.variant_image_url || v.variant_image_url === '');
        console.log(`Variants without images: ${variantsWithoutImages.length}`);
        variantsWithoutImages.forEach((v, i) => {
            const parent = products.find(p => p.id === v.product_id);
            console.log(`${i + 1}. [${v.id}] ${parent ? parent.title : 'Unknown'} (${v.size_value} ${v.unit || ''})`);
        });

        return { productsWithoutImages, variantsWithoutImages };
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

checkProductsWithoutImages().then(() => process.exit(0));
