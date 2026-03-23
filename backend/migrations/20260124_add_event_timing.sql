-- Add start_time and end_time fields to events table
-- Using TIME WITHOUT TIME ZONE for daily timing (e.g. 3:00 PM to 6:00 PM)
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS start_time TIME WITHOUT TIME ZONE,
ADD COLUMN IF NOT EXISTS end_time TIME WITHOUT TIME ZONE;

-- Add comment for clarity
COMMENT ON COLUMN events.start_time IS 'Daily start time of the event';
COMMENT ON COLUMN events.end_time IS 'Daily end time of the event';
