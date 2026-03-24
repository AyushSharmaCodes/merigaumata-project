-- Migration: prevent duplicate active account deletion jobs per user
-- Description: keeps scheduled deletion processing deterministic and cancellation-safe

WITH ranked_active_jobs AS (
    SELECT
        id,
        user_id,
        ROW_NUMBER() OVER (
            PARTITION BY user_id
            ORDER BY created_at DESC, id DESC
        ) AS job_rank
    FROM account_deletion_jobs
    WHERE status IN ('PENDING', 'BLOCKED', 'IN_PROGRESS')
),
duplicate_jobs AS (
    SELECT id
    FROM ranked_active_jobs
    WHERE job_rank > 1
)
UPDATE account_deletion_jobs
SET
    status = 'CANCELLED',
    updated_at = NOW(),
    error_log = COALESCE(error_log, '[]'::jsonb) || jsonb_build_array(
        jsonb_build_object(
            'reason', 'DUPLICATE_ACTIVE_JOB_CANCELLED',
            'message', 'Cancelled by migration before adding unique active-job constraint',
            'timestamp', NOW()
        )
    )
WHERE id IN (SELECT id FROM duplicate_jobs);

CREATE UNIQUE INDEX IF NOT EXISTS uq_account_deletion_jobs_one_active_per_user
ON account_deletion_jobs(user_id)
WHERE status IN ('PENDING', 'BLOCKED', 'IN_PROGRESS');
