const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });
const { supabaseAdmin } = require(path.join(__dirname, '../backend/config/supabase'));

const MAPPING = {
    "Anti-Radiation Chip": "/Users/ayush/.gemini/antigravity/brain/5f35a642-2aa2-444f-9c08-efd8b2086e8e/prod_anti_radiation_chip_image_1771210204051.png",
    "Brahmi Ghee": "/Users/ayush/.gemini/antigravity/brain/5f35a642-2aa2-444f-9c08-efd8b2086e8e/prod_brahmi_ghee_image_1771210187970.png",
    "Dried Cow Dung Cakes": "/Users/ayush/.gemini/antigravity/brain/5f35a642-2aa2-444f-9c08-efd8b2086e8e/prod_cow_dung_cakes_image_v2_1771210218865.png",
    "Pure Desi Gir Cow Ghee": "/Users/ayush/.gemini/antigravity/brain/5f35a642-2aa2-444f-9c08-efd8b2086e8e/prod_desi_gir_ghee_image_1771210169778.png",
    "Distilled Gomutra Ark": "/Users/ayush/.gemini/antigravity/brain/5f35a642-2aa2-444f-9c08-efd8b2086e8e/prod_distilled_gomutra_ark_image_1771210282788.png",
    "Exfoliating Body Scrub": "/Users/ayush/.gemini/antigravity/brain/5f35a642-2aa2-444f-9c08-efd8b2086e8e/prod_exfoliating_scrub_retry_image_v3_1771210444728.png",
    "Fresh A2 Cow Milk": "/Users/ayush/.gemini/antigravity/brain/5f35a642-2aa2-444f-9c08-efd8b2086e8e/prod_fresh_a2_milk_image_v2_1771209500065_png_1771210265718.png",
    "Divine Gift Hamper": "/Users/ayush/.gemini/antigravity/brain/5f35a642-2aa2-444f-9c08-efd8b2086e8e/prod_gift_hamper_image_v2_1771210313228.png",
    "Glow Face Pack": "/Users/ayush/.gemini/antigravity/brain/5f35a642-2aa2-444f-9c08-efd8b2086e8e/prod_glow_face_pack_retry_image_v2_1771210380893.png",
    "Gonyle Floor Cleaner": "/Users/ayush/.gemini/antigravity/brain/5f35a642-2aa2-444f-9c08-efd8b2086e8e/prod_gonyle_floor_cleaner_image_1771210330091.png",
    "Herbal Tooth Powder": "/Users/ayush/.gemini/antigravity/brain/5f35a642-2aa2-444f-9c08-efd8b2086e8e/prod_herbal_tooth_powder_retry_image_v2_1771210395461.png",
    "Kesh Vardhak Oil": "/Users/ayush/.gemini/antigravity/brain/5f35a642-2aa2-444f-9c08-efd8b2086e8e/prod_kesh_vardhak_oil_image_1771210235832.png",
    "Herbal Mosquito Coil": "/Users/ayush/.gemini/antigravity/brain/5f35a642-2aa2-444f-9c08-efd8b2086e8e/prod_mosquito_coil_image_v2_1771210251128.png",
    "Native Seed Balls": "/Users/ayush/.gemini/antigravity/brain/5f35a642-2aa2-444f-9c08-efd8b2086e8e/prod_native_seed_balls_retry_image_v2_1771210427527.png",
    "Natural Dhoop Sticks": "/Users/ayush/.gemini/antigravity/brain/5f35a642-2aa2-444f-9c08-efd8b2086e8e/prod_natural_dhoop_sticks_image_1771210530343.png",
    "Organic Vermicompost": "/Users/ayush/.gemini/antigravity/brain/5f35a642-2aa2-444f-9c08-efd8b2086e8e/prod_organic_vermicompost_retry_image_v3_1771210460131.png",
    "Panchgavya Nasya": "/Users/ayush/.gemini/antigravity/brain/5f35a642-2aa2-444f-9c08-efd8b2086e8e/prod_panchgavya_nasya_image_1771210545052.png",
    "Panchgavya Herbal Soap": "/Users/ayush/.gemini/antigravity/brain/5f35a642-2aa2-444f-9c08-efd8b2086e8e/prod_panchgavya_soap_retry_image_v3_1771210364141.png",
    "Pure Vedic Gomutra Ark (Distilled Cow Urine) – Traditional Ayurvedic Health Tonic : 1 Litre": "/Users/ayush/.gemini/antigravity/brain/5f35a642-2aa2-444f-9c08-efd8b2086e8e/prod_pure_vedic_ark_image_v2_1771210562048.png",
    "VedicGlow: Panchagavya & Saffron Luxury Soap (Handcrafted)": "/Users/ayush/.gemini/antigravity/brain/5f35a642-2aa2-444f-9c08-efd8b2086e8e/prod_vedic_glow_soap_image_v2_1771210577704.png",
    "Sacred Vibhuti": "/Users/ayush/.gemini/antigravity/brain/5f35a642-2aa2-444f-9c08-efd8b2086e8e/prod_sacred_vibhuti_image_1771210299513.png",
    "Triphala Gritham": "/Users/ayush/.gemini/antigravity/brain/5f35a642-2aa2-444f-9c08-efd8b2086e8e/prod_triphala_gritham_retry_image_v2_1771210410226.png"
};

async function uploadProductImages() {
    console.log('Fetching products and variants from Supabase...');

    const { data: products, error: pError } = await supabaseAdmin
        .from('products')
        .select('id, title');

    if (pError) throw pError;

    const { data: variants, error: vError } = await supabaseAdmin
        .from('product_variants')
        .select('id, product_id');

    if (vError) throw vError;

    const bucketName = 'images';

    console.log(`Starting upload for ${products.length} products...\n`);

    for (const product of products) {
        try {
            const localPath = MAPPING[product.title];
            if (!localPath || !fs.existsSync(localPath)) {
                console.warn(`No image found for: ${product.title}`);
                continue;
            }

            console.log(`Processing: ${product.title}`);
            const fileBuffer = fs.readFileSync(localPath);
            const fileName = path.basename(localPath);
            const timestamp = Date.now();
            const storagePath = `products/${timestamp}-${fileName}`;

            // 1. Upload to Storage
            const { data: storageData, error: storageError } = await supabaseAdmin.storage
                .from(bucketName)
                .upload(storagePath, fileBuffer, {
                    contentType: 'image/png',
                    upsert: false
                });

            if (storageError) throw storageError;

            const { data: { publicUrl } } = supabaseAdmin.storage
                .from(bucketName)
                .getPublicUrl(storagePath);

            // 2. Save metadata to photos table
            await supabaseAdmin.from('photos').insert([{
                image_path: storagePath,
                bucket_name: bucketName,
                title: product.title,
                size: fileBuffer.length,
                mime_type: 'image/png'
            }]);

            // 3. Update product
            const { error: pUpdateError } = await supabaseAdmin
                .from('products')
                .update({ images: [publicUrl] })
                .eq('id', product.id);

            if (pUpdateError) throw pUpdateError;

            // 4. Update variants
            const productVariants = variants.filter(v => v.product_id === product.id);
            for (const variant of productVariants) {
                const { error: vUpdateError } = await supabaseAdmin
                    .from('product_variants')
                    .update({ variant_image_url: publicUrl })
                    .eq('id', variant.id);

                if (vUpdateError) console.error(`Error updating variant ${variant.id}:`, vUpdateError.message);
            }

            console.log(`Success: ${product.title} updated with ${publicUrl}\n`);

        } catch (error) {
            console.error(`Error processing ${product.title}:`, error.message);
        }
    }
    console.log('All products processed.');
}

uploadProductImages().then(() => process.exit(0));
