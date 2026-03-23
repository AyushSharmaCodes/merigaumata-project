-- Enable Realtime for account_deletion_jobs
BEGIN;
  -- Add table to publication
  ALTER PUBLICATION supabase_realtime ADD TABLE account_deletion_jobs;
COMMIT;
