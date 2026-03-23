const supabase = require('./config/supabase');
require('dotenv').config();

async function diagnoseThumbnails() {
    try {
        const { data, error } = await supabase
            .from('gallery_videos')
            .select('id, title, youtube_id, thumbnail_url');

        if (error) throw error;

        console.log(`Found ${data.length} videos.`);
        data.forEach(video => {
            console.log(`ID: ${video.id} | Title: ${video.title} | Thumbnail: ${video.thumbnail_url}`);
        });

    } catch (error) {
        console.error('Error diagnosing thumbnails:', error);
    }
}

diagnoseThumbnails();
