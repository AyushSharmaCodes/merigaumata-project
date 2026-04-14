-- FAQ Retrieval RPC (v2)
-- Purpose: Fetch localized FAQs with their categories in a single call
-- Date: 2026-04-13

DROP FUNCTION IF EXISTS get_faqs_v2(text, uuid);
CREATE OR REPLACE FUNCTION get_faqs_v2(
    p_lang text DEFAULT 'en',
    p_category_id uuid DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
    v_data jsonb;
BEGIN
    SELECT json_agg(f) INTO v_data
    FROM (
        SELECT 
            f.id,
            f.display_order,
            COALESCE(f.question_i18n->>p_lang, f.question) as question,
            COALESCE(f.answer_i18n->>p_lang, f.answer) as answer,
            (
                SELECT jsonb_build_object(
                    'id', c.id,
                    'name', COALESCE(c.name_i18n->>p_lang, c.name)
                )
                FROM categories c 
                WHERE c.id = f.category_id
            ) as category
        FROM faqs f
        WHERE f.is_active = true
        AND (p_category_id IS NULL OR f.category_id = p_category_id)
        ORDER BY f.display_order ASC
    ) f;

    RETURN COALESCE(v_data, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_faqs_v2(text, uuid) TO anon, authenticated, service_role;
