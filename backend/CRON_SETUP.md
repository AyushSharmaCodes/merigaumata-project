# External Cron Setup

This project supports running scheduled background recovery jobs from an external scheduler.

## Endpoints

`POST /api/cron/account-deletions`

`POST /api/cron/refund-reconciliation`

Required header:

`x-cron-secret: <CRON_SECRET>`

## Recommended cadence

- Account deletions: every 5 minutes
- Refund reconciliation: every 5 minutes

## GitHub Actions setup

This repo includes [`/.github/workflows/account-deletions-cron.yml`](/Users/ayush/Developer/Projects/Personal-Projects/antigravity-project/ecommerce-fullstack/.github/workflows/account-deletions-cron.yml), which can act as the external scheduler.

Add these GitHub Actions repository secrets:

- `CRON_BASE_URL`
  Example: `https://api.yourdomain.com`
- `CRON_SECRET`
  Must exactly match the production backend `CRON_SECRET`

## Production env checklist

- Set `NODE_ENV=production`
- Set `BACKEND_URL=https://api.yourdomain.com`
- Set a strong `CRON_SECRET`
- Keep `ALLOWED_ORIGINS` restricted to real frontend origins
- Apply the migration [`backend/migrations/20260325_prevent_duplicate_active_account_deletion_jobs.sql`](/Users/ayush/Developer/Projects/Personal-Projects/antigravity-project/ecommerce-fullstack/backend/migrations/20260325_prevent_duplicate_active_account_deletion_jobs.sql#L1)
- Apply the migration [`backend/migrations/20260325_normalize_refund_job_statuses.sql`](/Users/ayush/Developer/Projects/Personal-Projects/antigravity-project/ecommerce-fullstack/backend/migrations/20260325_normalize_refund_job_statuses.sql#L1)
- If needed, override refund cadence with `REFUND_RECONCILIATION_SCHEDULE`

## Verification

1. Run the GitHub workflow manually with `workflow_dispatch`.
2. Confirm `200 OK` from `/api/cron/account-deletions` and `/api/cron/refund-reconciliation`.
3. Check backend logs for `CRON_ACCOUNT_DELETIONS` and `CRON_REFUND_RECONCILIATION`.
4. Confirm due jobs move out of `PENDING`, `PROCESSING`, or `BLOCKED` as expected.

## Refund Rollout Checklist

1. Apply [`20260325_normalize_refund_job_statuses.sql`](/Users/ayush/Developer/Projects/Personal-Projects/antigravity-project/ecommerce-fullstack/backend/migrations/20260325_normalize_refund_job_statuses.sql#L1) before deploying the backend changes.
2. Deploy backend code that includes the reconciler and webhook/status normalization.
3. Configure the external scheduler to call `POST /api/cron/refund-reconciliation` every 5 minutes with `x-cron-secret`.
4. In staging, create one refund and verify the `refunds.status` row transitions `PENDING -> PROCESSING -> PROCESSED`.
5. In staging, simulate a missed webhook and verify the reconciliation cron settles the stuck refund without creating a duplicate refund.
