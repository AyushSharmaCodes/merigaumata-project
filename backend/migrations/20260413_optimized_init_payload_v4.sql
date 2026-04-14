-- Unified Site Initialization RPC (v4)
-- Purpose: Fix property mapping for Carousel, Testimonials, and Gallery
-- Updated: 2026-04-14 — Added brandAssets from media-assets bucket

DROP FUNCTION IF EXISTS get_app_initial_payload_v4(text);
CREATE OR REPLACE FUNCTION get_app_initial_payload_v4(p_lang text DEFAULT 'en')
RETURNS jsonb AS $$
DECLARE
    v_site_content jsonb;
    v_homepage jsonb;
    v_now timestamp with time zone := NOW();
BEGIN
    -- 1. SITE CONTENT (Settings, Categories, Policies, Social Media)
    v_site_content := (
        SELECT jsonb_build_object(
            'settings', (SELECT jsonb_object_agg(key, value) FROM store_settings),
            'categories', (SELECT jsonb_agg(jsonb_build_object('id', id, 'name', COALESCE(name_i18n->>p_lang, name), 'type', type)) FROM categories),
            'policies', (SELECT jsonb_agg(jsonb_build_object('id', id, 'slug', type, 'title', COALESCE(title_i18n->>p_lang, title))) FROM policy_pages),
            'socialMedia', (
                SELECT COALESCE(jsonb_agg(jsonb_build_object(
                    'id', id, 
                    'platform', platform, 
                    'url', url, 
                    'icon', icon
                )), '[]'::jsonb) 
                FROM social_media 
                WHERE is_active = true 
                ORDER BY display_order
            ),
            'bankDetails', (SELECT COALESCE(jsonb_agg(b.*), '[]'::jsonb) FROM (SELECT * FROM bank_details WHERE is_active = true ORDER BY display_order) b),
            'contactInfo', (
                SELECT jsonb_build_object(
                    'address', (SELECT to_jsonb(ci.*) FROM contact_info ci LIMIT 1),
                    'phones', (SELECT COALESCE(jsonb_agg(cp.*), '[]'::jsonb) FROM (SELECT * FROM contact_phones WHERE is_active = true ORDER BY is_primary DESC, display_order ASC) cp),
                    'emails', (SELECT COALESCE(jsonb_agg(ce.*), '[]'::jsonb) FROM (SELECT * FROM contact_emails WHERE is_active = true ORDER BY is_primary DESC, display_order ASC) ce),
                    'officeHours', (SELECT COALESCE(jsonb_agg(coh.*), '[]'::jsonb) FROM (SELECT * FROM contact_office_hours ORDER BY display_order ASC) coh)
                )
            ),
            'about', (SELECT jsonb_build_object('footerDescription', footer_description) FROM about_settings LIMIT 1),
            'coupons', (
                SELECT COALESCE(jsonb_agg(c.*), '[]'::jsonb) 
                FROM coupons c 
                WHERE is_active = true 
                AND valid_from <= v_now 
                AND (valid_until IS NULL OR valid_until >= v_now)
                AND (usage_limit IS NULL OR usage_count < usage_limit)
            ),
            'brandAssets', (
                SELECT COALESCE(jsonb_object_agg(key, url), '{}'::jsonb)
                FROM brand_assets
            )
        )
    );

    -- 2. HOMEPAGE DATA (Carousel, Products, Blogs, Events, Testimonials, Gallery)
    v_homepage := (
        SELECT jsonb_build_object(
            'carouselSlides', (
                SELECT COALESCE(jsonb_agg(jsonb_build_object(
                    'id', gi.id, 
                    'title', COALESCE(gi.title_i18n->>p_lang, gi.title), 
                    'subtitle', COALESCE(gi.description_i18n->>p_lang, gi.description), 
                    'image', gi.image_url, 
                    'order', gi.order_index
                )), '[]'::jsonb) 
                FROM gallery_items gi
                JOIN gallery_folders gf ON gf.id = gi.folder_id
                WHERE gf.is_home_carousel = true 
                AND gf.is_active = true
                ORDER BY gi.order_index ASC
            ),
            'products', (
                SELECT COALESCE(jsonb_agg(p), '[]'::jsonb) FROM (
                    SELECT 
                        id, price, mrp, rating, "ratingCount", "reviewCount", created_at,
                        is_new, tags, variant_mode, is_returnable, return_days,
                        category, category_id, images,
                        default_hsn_code, default_gst_rate, default_tax_applicable, default_price_includes_tax,
                        COALESCE(title_i18n->>p_lang, title) as title,
                        title_i18n,
                        COALESCE(description_i18n->>p_lang, description) as description,
                        description_i18n,
                        tags_i18n,
                        benefits,
                        benefits_i18n,
                        COALESCE(images[1], '') as primary_image
                    FROM products 
                    WHERE is_active = true
                    ORDER BY created_at DESC
                    LIMIT 10
                ) p
            ),
            'blogs', (
                SELECT COALESCE(jsonb_agg(b), '[]'::jsonb) FROM (
                    SELECT id, image, blog_code as slug, created_at,
                           COALESCE(title_i18n->>p_lang, title) as title,
                           COALESCE(excerpt_i18n->>p_lang, excerpt) as excerpt
                    FROM blogs 
                    WHERE published = true 
                    ORDER BY created_at DESC 
                    LIMIT 10
                ) b
            ),
            'events', (
                SELECT COALESCE(jsonb_agg(e), '[]'::jsonb) FROM (
                    SELECT id, image, event_code as slug, start_date, location,
                           COALESCE(title_i18n->>p_lang, title) as title,
                           COALESCE(description_i18n->>p_lang, description) as description
                    FROM events 
                    WHERE status NOT IN ('cancelled', 'completed')
                      AND (end_date >= v_now OR (end_date IS NULL AND start_date >= v_now - interval '1 day'))
                    ORDER BY start_date ASC 
                    LIMIT 10
                ) e
            ),
            'testimonials', (
                SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (
                    SELECT id, rating, 
                           COALESCE(name, author_name) as name, 
                           COALESCE(image, author_image) as image,
                           COALESCE(content_i18n->>p_lang, content) as content
                    FROM testimonials 
                    WHERE approved = true 
                    ORDER BY created_at DESC 
                    LIMIT 10
                ) t
            ),
            'galleryItems', (
                SELECT COALESCE(jsonb_agg(g), '[]'::jsonb) FROM (
                    SELECT id, COALESCE(image_url, image) as image, title, caption
                    FROM gallery_items 
                    WHERE is_active = true 
                    ORDER BY display_order DESC 
                    LIMIT 12
                ) g
            )
        )
    );

    RETURN jsonb_build_object(
        'siteContent', v_site_content,
        'homepage', v_homepage,
        'timestamp', v_now
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION get_app_initial_payload_v4(text) TO anon, authenticated, service_role;
