-- Site Content Retrieval RPC (v2)
-- Purpose: Consolidate all global site metadata for maximum performance
-- Date: 2026-04-13

DROP FUNCTION IF EXISTS get_site_content_v2(text);
CREATE OR REPLACE FUNCTION get_site_content_v2(p_lang text DEFAULT 'en')
RETURNS jsonb AS $$
DECLARE
    v_now timestamp with time zone := NOW();
BEGIN
    RETURN jsonb_build_object(
        'settings', (SELECT jsonb_object_agg(key, value) FROM store_settings),
        'categories', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'name', COALESCE(name_i18n->>p_lang, name), 'type', type)), '[]'::jsonb) FROM categories),
        'policies', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'slug', type, 'title', COALESCE(title_i18n->>p_lang, title))), '[]'::jsonb) FROM policy_pages),
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
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_site_content_v2(text) TO anon, authenticated, service_role;
