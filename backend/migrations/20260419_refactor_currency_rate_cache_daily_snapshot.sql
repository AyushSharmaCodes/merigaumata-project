-- Normalize currency_rate_cache into one daily snapshot row per base currency.
-- This keeps runtime reads simple and supports the scheduled once-per-day refresh flow.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'currency_rate_cache'
          AND column_name = 'provider'
    ) THEN
        ALTER TABLE public.currency_rate_cache
            ADD COLUMN provider TEXT NOT NULL DEFAULT 'scheduled';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'currency_rate_cache'
          AND column_name = 'fetched_at'
    ) THEN
        ALTER TABLE public.currency_rate_cache
            ADD COLUMN fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'currency_rate_cache'
          AND column_name = 'rates'
    ) THEN
        ALTER TABLE public.currency_rate_cache
            ADD COLUMN rates JSONB;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'currency_rate_cache'
          AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE public.currency_rate_cache
            ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

DO $$
DECLARE
    has_quote_currency BOOLEAN;
    has_rate BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'currency_rate_cache'
          AND column_name = 'quote_currency'
    ) INTO has_quote_currency;

    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'currency_rate_cache'
          AND column_name = 'rate'
    ) INTO has_rate;

    IF has_quote_currency AND has_rate THEN
        CREATE TEMP TABLE tmp_currency_rate_cache_snapshot AS
        SELECT
            base_currency,
            MAX(provider) AS provider,
            MAX(fetched_at) AS fetched_at,
            MAX(expires_at) AS expires_at,
            jsonb_object_agg(UPPER(quote_currency), rate ORDER BY UPPER(quote_currency)) AS rates
        FROM public.currency_rate_cache
        WHERE quote_currency IS NOT NULL
        GROUP BY base_currency;

        DELETE FROM public.currency_rate_cache;

        INSERT INTO public.currency_rate_cache (
            base_currency,
            provider,
            fetched_at,
            expires_at,
            rates
        )
        SELECT
            base_currency,
            COALESCE(provider, 'scheduled'),
            COALESCE(fetched_at, NOW()),
            COALESCE(expires_at, NOW() + INTERVAL '1 day'),
            COALESCE(rates, '{}'::jsonb)
        FROM tmp_currency_rate_cache_snapshot;

        DROP TABLE tmp_currency_rate_cache_snapshot;
    END IF;
END $$;

UPDATE public.currency_rate_cache
SET
    provider = COALESCE(NULLIF(provider, ''), 'scheduled'),
    fetched_at = COALESCE(fetched_at, NOW()),
    expires_at = COALESCE(expires_at, NOW() + INTERVAL '1 day'),
    rates = COALESCE(rates, '{}'::jsonb),
    updated_at = COALESCE(updated_at, NOW());

ALTER TABLE public.currency_rate_cache
    ALTER COLUMN base_currency SET NOT NULL,
    ALTER COLUMN provider SET NOT NULL,
    ALTER COLUMN fetched_at SET NOT NULL,
    ALTER COLUMN expires_at SET NOT NULL,
    ALTER COLUMN rates SET NOT NULL;

DROP INDEX IF EXISTS idx_currency_rate_cache_base_currency_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_currency_rate_cache_base_currency_unique
    ON public.currency_rate_cache(base_currency);

ALTER TABLE public.currency_rate_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage currency rate cache" ON public.currency_rate_cache;
CREATE POLICY "Service role can manage currency rate cache" ON public.currency_rate_cache
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP TRIGGER IF EXISTS currency_rate_cache_updated_at ON public.currency_rate_cache;
CREATE TRIGGER currency_rate_cache_updated_at
    BEFORE UPDATE ON public.currency_rate_cache
    FOR EACH ROW
    EXECUTE PROCEDURE public.handle_updated_at();
