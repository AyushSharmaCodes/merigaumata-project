-- Restart Failed Deletion Jobs
-- This script resets FAILED deletion jobs to PENDING so the processor picks them up again.
-- It works for the most recent failed job.

DO $$
DECLARE
    v_job_id UUID;
BEGIN
    -- 1. Find the most recent failed job
    SELECT id INTO v_job_id
    FROM account_deletion_jobs
    WHERE status = 'FAILED'
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_job_id IS NOT NULL THEN
        -- 2. Reset job status
        UPDATE account_deletion_jobs
        SET 
            status = 'PENDING',
            current_step = 'LOCK_USER', -- Reset to beginning or keep current? Safer to restart.
            -- Use || operator for JSONB concatenation instead of array_append
            error_log = error_log || jsonb_build_array(jsonb_build_object('message', 'Manual restart via SQL script', 'timestamp', NOW())),
            updated_at = NOW()
        WHERE id = v_job_id;

        -- 3. Ensure profile is in correct state for processing
        -- (The processor checks for DELETION_IN_PROGRESS)
        UPDATE profiles
        SET deletion_status = 'DELETION_IN_PROGRESS'
        WHERE id = (SELECT user_id FROM account_deletion_jobs WHERE id = v_job_id);

        RAISE NOTICE 'Restarted job %', v_job_id;
    ELSE
        RAISE NOTICE 'No FAILED jobs found to restart.';
    END IF;
END $$;
