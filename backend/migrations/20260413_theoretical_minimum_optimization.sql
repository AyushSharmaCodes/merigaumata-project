-- "The Theoretical Minimum" - Final Consolidation Migration (PRODUCTION HARDENED - v4)
-- Created: 2026-04-13
-- Goal: Fix 500 errors (Column "slug" not found) and consolidate landing page data.

--------------------------------------------------------------------------------
-- 1. Site Metadata RPC
--------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS get_site_metadata(text);
CREATE OR REPLACE FUNCTION get_site_metadata(p_lang text DEFAULT 'en')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result jsonb;
    v_categories jsonb;
    v_settings jsonb;
    v_policies jsonb;
    v_contact_info jsonb;
    v_phones jsonb;
    v_emails jsonb;
    v_social_media jsonb;
    v_bank_details jsonb;
BEGIN
    -- 1. Categories
    SELECT jsonb_agg(jsonb_build_object(
        'id', c.id,
        'name', COALESCE(c.name_i18n->>p_lang, c.name_i18n->>'en', c.name),
        'type', c.type
    )) INTO v_categories FROM categories c;

    -- 2. Store Settings
    SELECT jsonb_object_agg(key, value) INTO v_settings FROM store_settings;

    -- 3. Policy Pages (Using id as slug if slug column is missing)
    SELECT jsonb_agg(jsonb_build_object(
        'id', id, 
        'slug', id::text, 
        'title', COALESCE(title_i18n->>p_lang, title_i18n->>'en', title)
    )) INTO v_policies FROM policy_pages WHERE is_active = true;

    -- 4. Contact Info
    SELECT jsonb_build_object(
        'address', COALESCE(v_settings->>'store_address', 'Main Office'),
        'primary_phone', v_settings->>'contact_phone',
        'primary_email', v_settings->>'contact_email'
    ) INTO v_contact_info;

    -- 5. Detailed Lists
    SELECT jsonb_agg(p.*) INTO v_phones FROM (SELECT id, "number", label, is_primary, COALESCE(label_i18n->>p_lang, label_i18n->>'en', label) as label_local FROM contact_phones WHERE is_active = true ORDER BY display_order) p;
    SELECT jsonb_agg(e.*) INTO v_emails FROM (SELECT * FROM contact_emails WHERE is_active = true ORDER BY display_order) e;
    SELECT jsonb_agg(s.*) INTO v_social_media FROM (SELECT * FROM social_media WHERE is_active = true ORDER BY display_order) s;
    SELECT jsonb_agg(b.*) INTO v_bank_details FROM (SELECT * FROM bank_details WHERE is_active = true ORDER BY display_order) b;
    
    -- Build Final Object
    result := jsonb_build_object(
        'categories', COALESCE(v_categories, '[]'::jsonb),
        'settings', COALESCE(v_settings, '{}'::jsonb),
        'policies', COALESCE(v_policies, '[]'::jsonb),
        'contactInfo', v_contact_info || jsonb_build_object(
            'phones', COALESCE(v_phones, '[]'::jsonb),
            'emails', COALESCE(v_emails, '[]'::jsonb)
        ),
        'socialMedia', COALESCE(v_social_media, '[]'::jsonb),
        'bankDetails', COALESCE(v_bank_details, '[]'::jsonb)
    );

    RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_site_metadata(text) TO anon, authenticated, service_role;

--------------------------------------------------------------------------------
-- 2. Homepage Data RPC
--------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS get_homepage_data(text);
CREATE OR REPLACE FUNCTION get_homepage_data(p_lang text DEFAULT 'en')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result jsonb;
    v_carousel jsonb;
    v_products jsonb;
    v_blogs jsonb;
    v_events jsonb;
    v_testimonials jsonb;
BEGIN
    -- 1. Active Carousel Slides
    SELECT jsonb_agg(s.*) INTO v_carousel FROM (
        SELECT id, image_url, order_index, link_url,
               COALESCE(title_i18n->>p_lang, title_i18n->>'en', title) as title,
               COALESCE(subtitle_i18n->>p_lang, subtitle_i18n->>'en', subtitle) as subtitle
        FROM carousel_slides
        WHERE is_active = true
        ORDER BY order_index ASC
    ) s;

    -- 2. Featured Products
    SELECT jsonb_agg(p.*) INTO v_products FROM (
        SELECT pr.id, pr.inventory, pr.rating, pr."reviewCount",
               COALESCE(title_i18n->>p_lang, title_i18n->>'en', title) as title,
               COALESCE(description_i18n->>p_lang, description_i18n->>'en', description) as description,
               (SELECT jsonb_agg(pv.*) FROM product_variants pv WHERE pv.product_id = pr.id AND pv.is_active = true) as variants,
               (SELECT image_url FROM product_images WHERE product_id = pr.id ORDER BY is_primary DESC, sort_order ASC LIMIT 1) as primary_image
        FROM products pr
        WHERE pr.is_active = true
        LIMIT 10
    ) p;

    -- 3. Latest Blogs (Aliasing blog_code as slug)
    SELECT jsonb_agg(b.*) INTO v_blogs FROM (
        SELECT id, created_at, image, blog_code as slug,
               COALESCE(title_i18n->>p_lang, title_i18n->>'en', title) as title,
               COALESCE(excerpt_i18n->>p_lang, excerpt_i18n->>'en', excerpt) as excerpt
        FROM blogs
        WHERE published = true
        ORDER BY created_at DESC
        LIMIT 6
    ) b;

    -- 4. Upcoming Events (Aliasing event_code as slug)
    SELECT jsonb_agg(e.*) INTO v_events FROM (
        SELECT id, start_date, "image", event_code as slug,
               COALESCE(title_i18n->>p_lang, title_i18n->>'en', title) as title,
               COALESCE(description_i18n->>p_lang, description_i18n->>'en', description) as description
        FROM events
        WHERE start_date >= NOW() AND status = 'published'
        ORDER BY start_date ASC
        LIMIT 4
    ) e;

    -- 5. Testimonials
    SELECT jsonb_agg(t.*) INTO v_testimonials FROM (
        SELECT id, rating, name as author_name, image as author_image,
               COALESCE(content_i18n->>p_lang, content_i18n->>'en', "content") as content
        FROM testimonials
        WHERE approved = true
        ORDER BY created_at DESC
        LIMIT 10
    ) t;

    -- Build Final Object
    result := jsonb_build_object(
        'carouselSlides', COALESCE(v_carousel, '[]'::jsonb),
        'products', COALESCE(v_products, '[]'::jsonb),
        'blogs', COALESCE(v_blogs, '[]'::jsonb),
        'events', COALESCE(v_events, '[]'::jsonb),
        'testimonials', COALESCE(v_testimonials, '[]'::jsonb)
    );

    RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_homepage_data(text) TO anon, authenticated, service_role;

--------------------------------------------------------------------------------
-- 3. Unified Initialization RPC
--------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS get_app_initial_payload(text, boolean);
CREATE OR REPLACE FUNCTION get_app_initial_payload(p_lang text DEFAULT 'en', p_is_admin boolean DEFAULT false)
RETURNS jsonb AS $$
DECLARE
    v_site_metadata jsonb;
    v_homepage_content jsonb;
BEGIN
    v_site_metadata := get_site_metadata(p_lang);
    v_homepage_content := get_homepage_data(p_lang);

    RETURN jsonb_build_object(
        'siteContent', v_site_metadata,
        'homepage', v_homepage_content,
        'timestamp', now()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION get_app_initial_payload(text, boolean) TO anon, authenticated, service_role;

--------------------------------------------------------------------------------
-- 4. Paginated Products RPC
--------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS get_products_paginated_v2(int, int, text, text, text, text);
CREATE OR REPLACE FUNCTION get_products_paginated_v2(
    p_page int DEFAULT 1,
    p_limit int DEFAULT 15,
    p_search text DEFAULT '',
    p_category text DEFAULT 'all',
    p_sort_by text DEFAULT 'newest',
    p_lang text DEFAULT 'en'
)
RETURNS jsonb AS $$
DECLARE
    v_offset int;
    v_data jsonb;
    v_total bigint;
BEGIN
    v_offset := (p_page - 1) * p_limit;

    -- Fetch Total Count
    SELECT count(*) INTO v_total
    FROM public.products
    WHERE (p_category = 'all' OR category = p_category)
    AND (p_search = '' OR title ILIKE '%' || p_search || '%' OR description ILIKE '%' || p_search || '%');

    -- Fetch Data
    WITH result_set AS (
        SELECT 
            p.*,
            COALESCE(title_i18n->>p_lang, title_i18n->>'en', title) as title_local,
            (SELECT jsonb_agg(v.*) FROM public.product_variants v WHERE v.product_id = p.id AND v.is_active = true) as variants,
            (SELECT image_url FROM product_images WHERE product_id = p.id ORDER BY is_primary DESC, sort_order ASC LIMIT 1) as primary_image
        FROM public.products p
        WHERE (p_category = 'all' OR category = p_category)
        AND (p_search = '' OR title ILIKE '%' || p_search || '%' OR description ILIKE '%' || p_search || '%')
        ORDER BY 
            CASE WHEN p_sort_by = 'priceLowHigh' THEN price END ASC,
            CASE WHEN p_sort_by = 'priceHighLow' THEN price END DESC,
            CASE WHEN p_sort_by = 'reviewCount' THEN "reviewCount" END DESC,
            CASE WHEN p_sort_by = 'newest' THEN created_at END DESC NULLS LAST
        LIMIT p_limit OFFSET v_offset
    )
    SELECT jsonb_agg(to_jsonb(r.*)) INTO v_data FROM result_set r;

    RETURN jsonb_build_object(
        'products', COALESCE(v_data, '[]'::jsonb),
        'total', v_total,
        'page', p_page,
        'limit', p_limit,
        'totalPages', CEIL(v_total::float / p_limit)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION get_products_paginated_v2(int, int, text, text, text, text) TO anon, authenticated, service_role;
