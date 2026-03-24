CREATE TABLE IF NOT EXISTS geo_cache (
    cache_key TEXT PRIMARY KEY,
    cache_type TEXT NOT NULL,
    provider TEXT,
    fetched_at TIMESTAMP WITH TIME ZONE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    payload JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_geo_cache_type ON geo_cache(cache_type);
CREATE INDEX IF NOT EXISTS idx_geo_cache_expires_at ON geo_cache(expires_at);

ALTER TABLE geo_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage geo cache" ON geo_cache;
CREATE POLICY "Service role can manage geo cache" ON geo_cache
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP TRIGGER IF EXISTS geo_cache_updated_at ON geo_cache;
CREATE TRIGGER geo_cache_updated_at
    BEFORE UPDATE ON geo_cache
    FOR EACH ROW
    EXECUTE PROCEDURE handle_updated_at();
