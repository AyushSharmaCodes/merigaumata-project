-- Mark legacy tables that appear to be superseded or unused by runtime code.
-- This is metadata only. No data is deleted in this migration.

COMMENT ON TABLE public.refresh_tokens IS
'LEGACY: appears superseded by public.app_refresh_tokens. Keep until verified unused in production and archived.';

COMMENT ON TABLE public.webhook_events IS
'LEGACY CANDIDATE: webhook idempotency table with no current runtime references found. Verify before archival/drop.';

COMMENT ON TABLE public.refund_audit_logs IS
'LEGACY CANDIDATE: refund audit table with no current runtime references found. Verify before archival/drop.';

COMMENT ON TABLE public.blog_comments_backup IS
'LEGACY BACKUP TABLE: preserved from earlier comments migration. Not part of current runtime flows.';
