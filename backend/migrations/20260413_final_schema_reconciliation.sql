-- Final Schema Reconciliation & RPC Repair
-- Date: 2026-04-13
-- Purpose: Fix "relation i18n_content does not exist" and missing column errors in logs

-- 1. Drop old/broken functions
DROP FUNCTION IF EXISTS get_app_initial_payload(text, boolean);
DROP FUNCTION IF EXISTS get_site_metadata(text);
DROP FUNCTION IF EXISTS get_homepage_data(text);

-- 2. Fixed Site Metadata Function
CREATE OR REPLACE FUNCTION get_site_metadata(p_lang text DEFAULT 'en')
RETURNS jsonb AS $$
DECLARE
    v_categories jsonb;
    v_settings jsonb;
    v_policies jsonb;
BEGIN
    SELECT jsonb_agg(jsonb_build_object(
        'id', id,
        'name', COALESCE(name_i18n->>p_lang, name),
        'type', type,
        'category_code', category_code
    )) INTO v_categories FROM categories;

    SELECT jsonb_object_agg(key, value) INTO v_settings FROM store_settings;

    SELECT jsonb_agg(jsonb_build_object(
        'id', id,
        'slug', COALESCE(type, id::text),
        'title', COALESCE(title_i18n->>p_lang, title)
    )) INTO v_policies FROM policy_pages;

    RETURN jsonb_build_object(
        'categories', COALESCE(v_categories, '[]'::jsonb),
        'settings', COALESCE(v_settings, '{}'::jsonb),
        'policies', COALESCE(v_policies, '[]'::jsonb)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Fixed Homepage Data Function
CREATE OR REPLACE FUNCTION get_homepage_data(p_lang text DEFAULT 'en')
RETURNS jsonb AS $$
DECLARE
    v_slides jsonb;
    v_products jsonb;
    v_blogs jsonb;
BEGIN
    SELECT jsonb_agg(jsonb_build_object(
        'id', id,
        'title', COALESCE(title_i18n->>p_lang, title),
        'subtitle', COALESCE(subtitle_i18n->>p_lang, subtitle),
        'image_url', image_url,
        'order_index', order_index
    )) INTO v_slides FROM carousel_slides ORDER BY order_index ASC;

    SELECT jsonb_agg(p) INTO v_products 
    FROM (SELECT * FROM products LIMIT 8) p;

    SELECT jsonb_agg(b) INTO v_blogs
    FROM (SELECT * FROM blogs WHERE published = true ORDER BY created_at DESC LIMIT 6) b;

    RETURN jsonb_build_object(
        'carouselSlides', COALESCE(v_slides, '[]'::jsonb),
        'featuredProducts', COALESCE(v_products, '[]'::jsonb),
        'latestBlogs', COALESCE(v_blogs, '[]'::jsonb)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Re-consolidated Init Payload
CREATE OR REPLACE FUNCTION get_app_initial_payload(p_lang text DEFAULT 'en', p_is_admin boolean DEFAULT false)
RETURNS jsonb AS $$
BEGIN
    RETURN jsonb_build_object(
        'siteMetadata', get_site_metadata(p_lang),
        'homepageData', get_homepage_data(p_lang)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
