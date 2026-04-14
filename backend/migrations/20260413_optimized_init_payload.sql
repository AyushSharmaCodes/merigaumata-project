-- Unified Site Initialization RPC (v3)
-- Purpose: Instant Home Page Loading via Single DB Request
-- Date: 2026-04-13

DROP FUNCTION IF EXISTS get_app_initial_payload_v3(text);
CREATE OR REPLACE FUNCTION get_app_initial_payload_v3(p_lang text DEFAULT 'en')
RETURNS jsonb AS $$
DECLARE
    v_site_content jsonb;
    v_homepage jsonb;
    v_now timestamp with time zone := NOW();
BEGIN
    -- 1. SITE CONTENT (Settings, Categories, Policies)
    v_site_content := (
        SELECT jsonb_build_object(
            'settings', (SELECT jsonb_object_agg(key, value) FROM store_settings),
            'categories', (SELECT jsonb_agg(jsonb_build_object('id', id, 'name', COALESCE(name_i18n->>p_lang, name), 'type', type)) FROM categories),
            'policies', (SELECT jsonb_agg(jsonb_build_object('id', id, 'slug', id::text, 'title', COALESCE(title_i18n->>p_lang, title))) FROM policy_pages),
            'socialMedia', '[]'::jsonb,
            'bankDetails', '[]'::jsonb,
            'about', jsonb_build_object('footerDescription', (SELECT value FROM store_settings WHERE key = 'FOOTER_DESCRIPTION' LIMIT 1))
        )
    );

    -- 2. HOMEPAGE DATA (Carousel, Products, Blogs, Events)
    v_homepage := (
        SELECT jsonb_build_object(
            'carouselSlides', (SELECT jsonb_agg(jsonb_build_object('id', id, 'title', COALESCE(title_i18n->>p_lang, title), 'subtitle', COALESCE(subtitle_i18n->>p_lang, subtitle), 'image_url', image_url)) FROM carousel_slides ORDER BY order_index ASC),
            'products', (
                SELECT jsonb_agg(p) FROM (
                    SELECT id, price, mrp, rating, "reviewCount",
                           COALESCE(title_i18n->>p_lang, title) as title,
                           COALESCE(images->>0, '') as primary_image
                    FROM products 
                    LIMIT 8
                ) p
            ),
            'blogs', (
                SELECT jsonb_agg(b) FROM (
                    SELECT id, image, blog_code as slug, created_at,
                           COALESCE(title_i18n->>p_lang, title) as title,
                           COALESCE(excerpt_i18n->>p_lang, excerpt) as excerpt
                    FROM blogs 
                    WHERE published = true 
                    ORDER BY created_at DESC 
                    LIMIT 6
                ) b
            ),
            'events', (
                SELECT jsonb_agg(e) FROM (
                    SELECT id, image, event_code as slug, start_date, location,
                           COALESCE(title_i18n->>p_lang, title) as title,
                           COALESCE(description_i18n->>p_lang, description) as description
                    FROM events 
                    WHERE start_date >= v_now
                    ORDER BY start_date ASC 
                    LIMIT 4
                ) e
            ),
            'testimonials', '[]'::jsonb,
            'galleryItems', '[]'::jsonb
        )
    );

    RETURN jsonb_build_object(
        'siteContent', v_site_content,
        'homepage', v_homepage,
        'timestamp', v_now
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_app_initial_payload_v3(text) TO anon, authenticated, service_role;
