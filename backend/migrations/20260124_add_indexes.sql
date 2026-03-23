-- Add indexes to event_registrations for performance
CREATE INDEX IF NOT EXISTS idx_event_registrations_user_id ON event_registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_event_registrations_event_id ON event_registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_event_registrations_status ON event_registrations(status);

-- Composite index for duplicate checks and filtering
CREATE INDEX IF NOT EXISTS idx_event_registrations_user_event ON event_registrations(user_id, event_id);
