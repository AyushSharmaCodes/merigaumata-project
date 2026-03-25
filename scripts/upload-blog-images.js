const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });
const { supabaseAdmin } = require(path.join(__dirname, '../backend/config/supabase'));

const MAPPING = [
    { id: 'd2b8aa36-c234-43e6-98d3-a560562ca94d', title: 'National Dairy Month', localPath: '/Users/ayush/.gemini/antigravity/brain/5f35a642-2aa2-444f-9c08-efd8b2086e8e/blog_farmers_market_tour_1771209455223.png' },
    { id: 'b1f3cc76-3114-4b80-b31d-9beec251d570', title: 'Art of the Cow', localPath: '/Users/ayush/.gemini/antigravity/brain/5f35a642-2aa2-444f-9c08-efd8b2086e8e/blog_cow_art_gallery_1771209470771.png' },
    { id: '826f67ff-2b5c-417a-84a1-abe3c9c492be', title: 'Bovine Nutrition Webinar', localPath: '/Users/ayush/.gemini/antigravity/brain/5f35a642-2aa2-444f-9c08-efd8b2086e8e/blog_bovine_nutrition_webinar_1771209485963.png' },
    { id: '8b7229ee-a2fc-4796-a766-107a24e0d381', title: 'Regenerative Grazing Summit', localPath: '/Users/ayush/.gemini/antigravity/brain/5f35a642-2aa2-444f-9c08-efd8b2086e8e/blog_regenerative_grazing_summit_1771209500064.png' },
    { id: 'cfd55364-e2dc-4f64-bbda-cb0a59dbcff2', title: 'Gau-Navratri', localPath: '/Users/ayush/.gemini/antigravity/brain/5f35a642-2aa2-444f-9c08-efd8b2086e8e/blog_gau_navratri_celebration_1771209517995.png' },
    { id: '3bd0e7c0-2bd0-42df-b08e-12286d49c2c8', title: 'Ahimsa Leather Fair', localPath: '/Users/ayush/.gemini/antigravity/brain/5f35a642-2aa2-444f-9c08-efd8b2086e8e/blog_ahimsa_leather_fair_image_1771209536107.png' },
    { id: '39604a51-dbf6-4b3c-97b0-18ebdf4e975b', title: 'World Milk Day', localPath: '/Users/ayush/.gemini/antigravity/brain/5f35a642-2aa2-444f-9c08-efd8b2086e8e/blog_world_milk_day_2026_image_1771209550760.png' },
    { id: 'c5040b0f-5c7d-4f36-99a1-bcadf45508d9', title: 'Organic Soil Workshop', localPath: '/Users/ayush/.gemini/antigravity/brain/5f35a642-2aa2-444f-9c08-efd8b2086e8e/blog_organic_soil_workshop_image_1771209567112.png' },
    { id: '9c6a00dd-c103-48ab-a740-4148f0bb77c5', title: 'Adopt-a-Cow Gala', localPath: '/Users/ayush/.gemini/antigravity/brain/5f35a642-2aa2-444f-9c08-efd8b2086e8e/blog_adopt_a_cow_gala_image_retry_1771209718083.png' },
    { id: '8b076f17-972a-4b09-ae23-b94a2e1f29e8', title: 'Global Etho-Dairy Expo', localPath: '/Users/ayush/.gemini/antigravity/brain/5f35a642-2aa2-444f-9c08-efd8b2086e8e/blog_global_etho_dairy_expo_image_1771209584524.png' },
    { id: '3baf8503-ff2a-469e-a4af-f2323452b262', title: 'Decoding Welfare Labels', localPath: '/Users/ayush/.gemini/antigravity/brain/5f35a642-2aa2-444f-9c08-efd8b2086e8e/blog_welfare_labels_decoding_image_1771209602185.png' },
    { id: 'bdc22b6c-3816-4149-9083-b788dd7955e7', title: 'Conscious Gifting', localPath: '/Users/ayush/.gemini/antigravity/brain/5f35a642-2aa2-444f-9c08-efd8b2086e8e/blog_conscious_gifting_guide_image_1771209619427.png' },
    { id: 'b5777fa4-edff-4c7f-a241-e8fc2e85f90d', title: 'Transitioning to Regenerative', localPath: '/Users/ayush/.gemini/antigravity/brain/5f35a642-2aa2-444f-9c08-efd8b2086e8e/blog_transitioning_to_regenerative_image_1771209634152.png' },
    { id: '8bf14a97-c52d-4b53-99cc-6d3443395621', title: 'World Veterinary Congress', localPath: '/Users/ayush/.gemini/antigravity/brain/5f35a642-2aa2-444f-9c08-efd8b2086e8e/blog_world_veterinary_congress_image_1771209648439.png' },
    { id: 'edfccc45-3ec9-4c4e-a5bc-16da087a183b', title: 'DIY Panchagavya', localPath: '/Users/ayush/.gemini/antigravity/brain/5f35a642-2aa2-444f-9c08-efd8b2086e8e/blog_diy_panchagavya_home_image_1771209666649.png' },
    { id: '783d5304-dac8-442b-9015-adb584d1ed8b', title: 'Animal Welfare Fortnight', localPath: '/Users/ayush/.gemini/antigravity/brain/5f35a642-2aa2-444f-9c08-efd8b2086e8e/blog_animal_welfare_fortnight_image_v2_1771209682208.png' },
    { id: '64262cb1-2be1-49ae-ad34-09ae4343261f', title: 'Cow Comfort', localPath: '/Users/ayush/.gemini/antigravity/brain/5f35a642-2aa2-444f-9c08-efd8b2086e8e/blog_cow_comfort_metric_image_retry_1771209732840.png' },
    { id: 'ce756684-7cf4-4d56-918b-49a22becca94', title: 'Beyond Milk', localPath: '/Users/ayush/.gemini/antigravity/brain/5f35a642-2aa2-444f-9c08-efd8b2086e8e/blog_cow_dung_eco_products_image_retry_1771209748890.png' },
    { id: 'c9f0e6b8-e362-48f6-be74-dc86021a9963', title: 'Dairy Cattle Welfare Symposium', localPath: '/Users/ayush/.gemini/antigravity/brain/5f35a642-2aa2-444f-9c08-efd8b2086e8e/blog_dairy_cattle_welfare_symposium_image_retry_1771209763960.png' }
];

async function uploadImages() {
    console.log('Starting image upload and blog update process...');
    const bucketName = 'blogs';

    for (const item of MAPPING) {
        try {
            console.log(`Processing: ${item.title} (${item.id})`);

            if (!fs.existsSync(item.localPath)) {
                console.error(`File NOT found: ${item.localPath}`);
                continue;
            }

            const fileBuffer = fs.readFileSync(item.localPath);
            const fileName = path.basename(item.localPath);
            const timestamp = Date.now();
            const filePath = `${timestamp}-${fileName}`;

            // 1. Upload to Supabase Storage
            const { data: storageData, error: storageError } = await supabaseAdmin.storage
                .from(bucketName)
                .upload(filePath, fileBuffer, {
                    contentType: 'image/png',
                    upsert: false
                });

            if (storageError) throw storageError;

            // 2. Get Public URL
            const { data: { publicUrl } } = supabaseAdmin.storage
                .from(bucketName)
                .getPublicUrl(filePath);

            console.log(`Uploaded to storage. URL: ${publicUrl}`);

            // 3. Save metadata to photos table
            const { data: photoData, error: dbError } = await supabaseAdmin
                .from('photos')
                .insert([
                    {
                        image_path: filePath,
                        bucket_name: bucketName,
                        title: item.title,
                        size: fileBuffer.length,
                        mime_type: 'image/png'
                    }
                ])
                .select()
                .single();

            if (dbError) throw dbError;

            // 4. Update blog record
            const { error: blogUpdateError } = await supabaseAdmin
                .from('blogs')
                .update({ image: publicUrl })
                .eq('id', item.id);

            if (blogUpdateError) throw blogUpdateError;

            console.log(`Successfully updated blog ${item.id} with image ${publicUrl}\n`);

        } catch (error) {
            console.error(`Error processing blog ${item.id}:`, error.message);
        }
    }
    console.log('All processed.');
}

uploadImages().then(() => process.exit(0));
