const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function updateRpc() {
  const sql = `
CREATE OR REPLACE FUNCTION get_events_paginated(
    p_page int DEFAULT 1,
    p_limit int DEFAULT 10,
    p_search text DEFAULT '',
    p_status text DEFAULT 'all',
    p_lang text DEFAULT 'en'
)
RETURNS jsonb AS $$
DECLARE
    v_offset int;
    v_data jsonb;
    v_total bigint;
    v_now timestamp with time zone := NOW();
BEGIN
    v_offset := (p_page - 1) * p_limit;

    -- Fetch Total Count
    SELECT count(*) INTO v_total
    FROM public.events
    WHERE (p_search = '' OR title ILIKE '%' || p_search || '%' OR description ILIKE '%' || p_search || '%')
    AND (
        p_status = 'all' OR
        (p_status = 'upcoming' AND start_date > v_now) OR
        (p_status = 'completed' AND (end_date < v_now OR (end_date IS NULL AND start_date < v_now))) OR
        (p_status = 'ongoing' AND start_date <= v_now AND (end_date >= v_now OR end_date IS NULL))
    );

    -- Fetch Data
    WITH result_set AS (
        SELECT 
            e.id, 
            REPLACE(REPLACE(e.image, '/event_images/', '/event-media/'), '/events/', '/event-media/') as image, 
            e.start_date, e.end_date, e.location, e.registrations, e.event_code as slug,
            e.status, e.cancellation_status,
            COALESCE(e.title_i18n->>p_lang, e.title) as title,
            COALESCE(e.description_i18n->>p_lang, e.description) as description,
            (SELECT jsonb_build_object('name', COALESCE(c.name_i18n->>p_lang, c.name)) FROM categories c WHERE c.name = e.category AND c.type = 'event' LIMIT 1) as category_data
        FROM public.events e
        WHERE (p_search = '' OR title ILIKE '%' || p_search || '%' OR description ILIKE '%' || p_search || '%')
        AND (
            p_status = 'all' OR
            (p_status = 'upcoming' AND start_date > v_now) OR
            (p_status = 'completed' AND (end_date < v_now OR (end_date IS NULL AND start_date < v_now))) OR
            (p_status = 'ongoing' AND start_date <= v_now AND (end_date >= v_now OR end_date IS NULL))
        )
        ORDER BY start_date ASC
        LIMIT p_limit OFFSET v_offset
    )
    SELECT jsonb_agg(to_jsonb(r.*)) INTO v_data FROM result_set r;

    RETURN jsonb_build_object(
        'events', COALESCE(v_data, '[]'::jsonb),
        'total', v_total,
        'page', p_page,
        'limit', p_limit,
        'totalPages', CEIL(v_total::float / p_limit)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`;
  
  // Actually, supabase JS client does not support raw SQL execution directly from client side via .rpc() if we're creating functions, unless we use `pg` module or call a raw query function.
  // Wait, let me check if there's an arbitrary query execution.
  console.log("Saving to file...");
}
updateRpc();
