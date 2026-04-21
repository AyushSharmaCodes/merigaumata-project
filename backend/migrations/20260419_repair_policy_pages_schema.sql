-- Repair policy_pages so fresh-baseline databases match the runtime policy service.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'policy_pages'
          AND column_name = 'policy_type'
    ) THEN
        ALTER TABLE public.policy_pages ADD COLUMN policy_type TEXT;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'policy_pages'
          AND column_name = 'type'
    ) THEN
        EXECUTE '
            UPDATE public.policy_pages
            SET policy_type = COALESCE(policy_type, type)
            WHERE policy_type IS NULL
        ';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'policy_pages'
          AND column_name = 'content_html'
    ) THEN
        ALTER TABLE public.policy_pages ADD COLUMN content_html TEXT;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'policy_pages'
          AND column_name = 'content'
    ) THEN
        EXECUTE '
            UPDATE public.policy_pages
            SET content_html = COALESCE(content_html, content)
            WHERE content_html IS NULL
        ';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'policy_pages'
          AND column_name = 'title_i18n'
    ) THEN
        ALTER TABLE public.policy_pages ADD COLUMN title_i18n JSONB DEFAULT '{}'::jsonb;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'policy_pages'
          AND column_name = 'content_html_i18n'
    ) THEN
        ALTER TABLE public.policy_pages ADD COLUMN content_html_i18n JSONB DEFAULT '{}'::jsonb;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'policy_pages'
          AND column_name = 'content_i18n'
    ) THEN
        EXECUTE '
            UPDATE public.policy_pages
            SET content_html_i18n = CASE
                WHEN content_html_i18n IS NULL OR content_html_i18n = ''{}''::jsonb THEN COALESCE(content_i18n, ''{}''::jsonb)
                ELSE content_html_i18n
            END
        ';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'policy_pages'
          AND column_name = 'storage_path'
    ) THEN
        ALTER TABLE public.policy_pages ADD COLUMN storage_path TEXT DEFAULT '';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'policy_pages'
          AND column_name = 'file_type'
    ) THEN
        ALTER TABLE public.policy_pages ADD COLUMN file_type TEXT DEFAULT 'pdf';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'policy_pages'
          AND column_name = 'version'
    ) THEN
        ALTER TABLE public.policy_pages ADD COLUMN version INTEGER DEFAULT 1;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'policy_pages'
          AND column_name = 'created_at'
    ) THEN
        ALTER TABLE public.policy_pages ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

UPDATE public.policy_pages
SET policy_type = 'shipping-refund'
WHERE policy_type IN ('shipping', 'refund');

UPDATE public.policy_pages
SET title_i18n = CASE
    WHEN title_i18n IS NULL OR title_i18n = '{}'::jsonb THEN jsonb_build_object('en', title)
    ELSE title_i18n
END,
content_html_i18n = CASE
    WHEN content_html_i18n IS NULL OR content_html_i18n = '{}'::jsonb THEN jsonb_build_object('en', COALESCE(content_html, ''))
    ELSE content_html_i18n
END,
content_html = COALESCE(content_html, ''),
storage_path = COALESCE(storage_path, ''),
file_type = COALESCE(NULLIF(file_type, ''), 'pdf'),
version = COALESCE(version, 1),
created_at = COALESCE(created_at, NOW()),
updated_at = COALESCE(updated_at, NOW()),
is_active = COALESCE(is_active, false)
WHERE true;

WITH ranked AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY policy_type
            ORDER BY is_active DESC, updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
        ) AS row_num
    FROM public.policy_pages
    WHERE is_active = true
)
UPDATE public.policy_pages p
SET is_active = false
FROM ranked
WHERE ranked.id = p.id
  AND ranked.row_num > 1;

ALTER TABLE public.policy_pages DROP CONSTRAINT IF EXISTS policy_pages_policy_type_check;
ALTER TABLE public.policy_pages
    ADD CONSTRAINT policy_pages_policy_type_check
    CHECK (policy_type IN ('privacy', 'terms', 'shipping-refund'));

ALTER TABLE public.policy_pages
    ALTER COLUMN policy_type SET NOT NULL,
    ALTER COLUMN title SET NOT NULL,
    ALTER COLUMN content_html SET NOT NULL,
    ALTER COLUMN storage_path SET NOT NULL,
    ALTER COLUMN file_type SET NOT NULL,
    ALTER COLUMN version SET NOT NULL,
    ALTER COLUMN is_active SET NOT NULL,
    ALTER COLUMN created_at SET NOT NULL,
    ALTER COLUMN updated_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_policy_pages_type_active
    ON public.policy_pages(policy_type, is_active);

CREATE UNIQUE INDEX IF NOT EXISTS idx_policy_pages_one_active_per_type
    ON public.policy_pages(policy_type)
    WHERE is_active = true;
