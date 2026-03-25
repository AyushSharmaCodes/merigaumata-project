const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });
const { supabaseAdmin } = require(path.join(__dirname, '../backend/config/supabase'));

async function inspectEvents() {
    try {
        const { data: events, error } = await supabaseAdmin
            .from('events')
            .select('*')
            .limit(5);

        if (error) throw error;

        console.log('Events Schema Sample:');
        console.log(JSON.stringify(events, null, 2));

        const { data: eventsWithoutImages, error: error2 } = await supabaseAdmin
            .from('events')
            .select('id, title')
            .or('image.is.null, image.eq.""');

        if (error2) throw error2;

        console.log(`\nEvents without images: ${eventsWithoutImages.length}`);
        eventsWithoutImages.forEach((event, index) => {
            console.log(`${index + 1}. [${event.id}] ${event.title}`);
        });

    } catch (error) {
        console.error('Error inspecting events:', error.message);
    }
}

inspectEvents().then(() => process.exit(0));
