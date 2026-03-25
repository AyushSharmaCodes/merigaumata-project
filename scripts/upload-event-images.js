const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });
const { supabaseAdmin } = require(path.join(__dirname, '../backend/config/supabase'));

const MAPPING = {
    "Organic Expo India – 5th Edition": "/Users/ayush/.gemini/antigravity/brain/5f35a642-2aa2-444f-9c08-efd8b2086e8e/event_organic_expo_india_image_1771211406208.png",
    "GauTech Expo 2026": "/Users/ayush/.gemini/antigravity/brain/5f35a642-2aa2-444f-9c08-efd8b2086e8e/event_gautech_expo_image_1771211425799.png",
    "Dairy Livestock and Poultry Expo Asia (DLPE)": "/Users/ayush/.gemini/antigravity/brain/5f35a642-2aa2-444f-9c08-efd8b2086e8e/event_dlpe_expo_image_1771211447671.png",
    "Sri Krishna Janmashtami Gau Seva 2026": "/Users/ayush/.gemini/antigravity/brain/5f35a642-2aa2-444f-9c08-efd8b2086e8e/event_janmashtami_gau_seva_image_1771211463108.png",
    "Organic Farming Workshop - AMA": "/Users/ayush/.gemini/antigravity/brain/5f35a642-2aa2-444f-9c08-efd8b2086e8e/event_organic_farming_workshop_image_1771211480177.png",
    "Feed Tech Expo 2026": "/Users/ayush/.gemini/antigravity/brain/5f35a642-2aa2-444f-9c08-efd8b2086e8e/event_feed_tech_expo_image_v2_1771211507794.png",
    "Sankranti @Goshala 2026": "/Users/ayush/.gemini/antigravity/brain/5f35a642-2aa2-444f-9c08-efd8b2086e8e/event_sankranti_goshala_image_v2_1771211525430.png",
    "Gopashtami Rituals & Devotional Worship": "/Users/ayush/.gemini/antigravity/brain/5f35a642-2aa2-444f-9c08-efd8b2086e8e/event_gopashtami_rituals_image_v3_1771211540420.png",
    "India International Organic Farming Expo": "/Users/ayush/.gemini/antigravity/brain/5f35a642-2aa2-444f-9c08-efd8b2086e8e/event_india_intl_organic_expo_image_v2_1771211558719.png",
    "Sacred Day of Compassion Drive (Gokuldham)": "/Users/ayush/.gemini/antigravity/brain/5f35a642-2aa2-444f-9c08-efd8b2086e8e/event_compassion_drive_gokuldham_image_v2_1771211574015.png",
    "National Panchagavya Chikitsa Seminar": "/Users/ayush/.gemini/antigravity/brain/5f35a642-2aa2-444f-9c08-efd8b2086e8e/event_panchagavya_chikitsa_seminar_image_1771211589384.png",
    "Goshala Management & Economics Workshop": "/Users/ayush/.gemini/antigravity/brain/5f35a642-2aa2-444f-9c08-efd8b2086e8e/event_goshala_management_workshop_image_1771211604889.png",
    "Vedic Agriculture & Seed Swap Meet": "/Users/ayush/.gemini/antigravity/brain/5f35a642-2aa2-444f-9c08-efd8b2086e8e/event_vedic_agriculture_meet_image_1771211623370.png",
    "Indigenous Breed Fashion & Talent Show": "/Users/ayush/.gemini/antigravity/brain/5f35a642-2aa2-444f-9c08-efd8b2086e8e/event_indigenous_breed_show_image_1771211639723.png",
    "Gau-Seva Youth Leadership Camp": "/Users/ayush/.gemini/antigravity/brain/5f35a642-2aa2-444f-9c08-efd8b2086e8e/event_youth_leadership_camp_image_1771211657967.png",
    "Global Cow-Tech E-Commerce Summit": "/Users/ayush/.gemini/antigravity/brain/5f35a642-2aa2-444f-9c08-efd8b2086e8e/event_cow_tech_ecommerce_summit_image_1771211673317.png",
    "Panchagavya Diwali Mela (Eco-Friendly Festival)": "/Users/ayush/.gemini/antigravity/brain/5f35a642-2aa2-444f-9c08-efd8b2086e8e/event_panchagavya_diwali_mela_image_1771211690956.png",
    "Year-End \"Go-Gita\" Jayanti Celebration": "/Users/ayush/.gemini/antigravity/brain/5f35a642-2aa2-444f-9c08-efd8b2086e8e/event_go_gita_jayanti_image_v2_1771211708696.png",
    "The Holy Dust (Braja-Raja) Festival": "/Users/ayush/.gemini/antigravity/brain/5f35a642-2aa2-444f-9c08-efd8b2086e8e/event_holy_dust_festival_image_1771211726057.png",
    "International Conference on Bovine Genomics": "/Users/ayush/.gemini/antigravity/brain/5f35a642-2aa2-444f-9c08-efd8b2086e8e/event_bovine_genomics_conference_image_v2_1771211770318.png",
    "Mahashivratri Grand Celebration 2026": "/Users/ayush/.gemini/antigravity/brain/5f35a642-2aa2-444f-9c08-efd8b2086e8e/event_mahashivratri_celeb_image_v2_1771211744218.png"
};

async function uploadEventImages() {
    console.log('Fetching events from Supabase...');

    const { data: events, error: eError } = await supabaseAdmin
        .from('events')
        .select('id, title');

    if (eError) throw eError;

    const bucketName = 'images';

    console.log(`Starting upload for ${events.length} events...\n`);

    for (const event of events) {
        try {
            const localPath = MAPPING[event.title];
            if (!localPath || !fs.existsSync(localPath)) {
                console.warn(`No image found or mapped for: ${event.title}`);
                continue;
            }

            console.log(`Processing: ${event.title}`);
            const fileBuffer = fs.readFileSync(localPath);
            const fileName = path.basename(localPath);
            const timestamp = Date.now();
            const storagePath = `events/${timestamp}-${fileName}`;

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
                title: event.title,
                size: fileBuffer.length,
                mime_type: 'image/png'
            }]);

            // 3. Update event
            const { error: eUpdateError } = await supabaseAdmin
                .from('events')
                .update({ image: publicUrl })
                .eq('id', event.id);

            if (eUpdateError) throw eUpdateError;

            console.log(`Success: ${event.title} updated with ${publicUrl}\n`);

        } catch (error) {
            console.error(`Error processing ${event.title}:`, error.message);
        }
    }
    console.log('All events processed.');
}

uploadEventImages().then(() => process.exit(0));
