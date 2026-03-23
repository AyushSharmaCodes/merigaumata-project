-- 20260115_event_cancellation_jobs_retry.sql
-- Add retry tracking columns to event_cancellation_jobs

-- Add retry_count column for tracking retry attempts
ALTER TABLE event_cancellation_jobs 
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;

-- Add updated_at column for tracking last update time
ALTER TABLE event_cancellation_jobs 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add started_at column for tracking when processing began (for consistency with account_deletion_jobs)
ALTER TABLE event_cancellation_jobs 
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

-- Add RLS policy for admin full management (INSERT, UPDATE, DELETE)
DROP POLICY IF EXISTS "Admins can manage cancellation jobs" ON event_cancellation_jobs;
CREATE POLICY "Admins can manage cancellation jobs" ON event_cancellation_jobs
    FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM profiles p
        JOIN roles r ON p.role_id = r.id
        WHERE p.id = auth.uid() AND r.name IN ('admin', 'manager')
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM profiles p
        JOIN roles r ON p.role_id = r.id
        WHERE p.id = auth.uid() AND r.name IN ('admin', 'manager')
    ));

-- Enable realtime for event_cancellation_jobs (for live status updates)
ALTER PUBLICATION supabase_realtime ADD TABLE event_cancellation_jobs;

SELECT 'Event cancellation jobs retry tracking migration completed!' as status;
