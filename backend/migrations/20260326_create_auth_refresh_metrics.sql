BEGIN;

CREATE TABLE IF NOT EXISTS public.auth_refresh_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    reason TEXT,
    correlation_id TEXT,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    status_code INTEGER,
    has_refresh_token_cookie BOOLEAN,
    has_access_token_cookie BOOLEAN,
    rotated_refresh_token BOOLEAN,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_refresh_metrics_created_at
ON public.auth_refresh_metrics(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_auth_refresh_metrics_event_type
ON public.auth_refresh_metrics(event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_auth_refresh_metrics_reason
ON public.auth_refresh_metrics(reason, created_at DESC)
WHERE reason IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_auth_refresh_metrics_correlation
ON public.auth_refresh_metrics(correlation_id)
WHERE correlation_id IS NOT NULL;

ALTER TABLE public.auth_refresh_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_auth_refresh_metrics" ON public.auth_refresh_metrics;
CREATE POLICY "service_role_all_auth_refresh_metrics"
ON public.auth_refresh_metrics FOR ALL TO service_role
USING (true) WITH CHECK (true);

COMMIT;
