require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
    console.log('Fetching a product variant...');
    const { data: variants, error } = await supabase
        .from('product_variants')
        .select('id, description_i18n')
        .limit(1);

    if (error) {
        console.error('Error fetching variant:', error);
        return;
    }

    if (!variants || variants.length === 0) {
        console.log('No variants found.');
        return;
    }

    const variant = variants[0];
    console.log('Original variant:', variant);

    const testData = { ...(variant.description_i18n || {}), "hi": "नमस्ते (Test)" };

    console.log('Updating variant with:', JSON.stringify(testData, null, 2));

    const { data: updated, error: updateError } = await supabase
        .from('product_variants')
        .update({ description_i18n: testData })
        .eq('id', variant.id)
        .select();

    if (updateError) {
        console.error('Error updating variant:', updateError);
        return;
    }

    console.log('Updated variant:', updated[0]);
}

verify();
