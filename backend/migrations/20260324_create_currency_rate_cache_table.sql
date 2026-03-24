CREATE TABLE IF NOT EXISTS currency_rate_cache (
    base_currency TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    fetched_at TIMESTAMP WITH TIME ZONE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    rates JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE currency_rate_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage currency rate cache" ON currency_rate_cache;
CREATE POLICY "Service role can manage currency rate cache" ON currency_rate_cache
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP TRIGGER IF EXISTS currency_rate_cache_updated_at ON currency_rate_cache;
CREATE TRIGGER currency_rate_cache_updated_at
    BEFORE UPDATE ON currency_rate_cache
    FOR EACH ROW
    EXECUTE PROCEDURE handle_updated_at();
