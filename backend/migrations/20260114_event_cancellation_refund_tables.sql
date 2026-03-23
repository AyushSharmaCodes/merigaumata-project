-- 20260114_event_cancellation_refund_tables.sql

-- Enable uuid-ossp if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Update events table for admin cancellation tracking
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS cancellation_status VARCHAR(30) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
ADD COLUMN IF NOT EXISTS cancellation_correlation_id UUID;

-- 2. Update event_registrations table for user/admin cancellation reason
ALTER TABLE event_registrations 
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- 3. Create Event Refunds Table (Refund State Machine)
CREATE TABLE IF NOT EXISTS event_refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    refund_id VARCHAR(50) UNIQUE, -- Razorpay refund ID (rfnd_xxx)
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    registration_id UUID NOT NULL REFERENCES event_registrations(id) ON DELETE CASCADE,
    payment_id VARCHAR(100) NOT NULL, -- Razorpay payment ID (pay_xxx)
    amount DECIMAL(10,2) NOT NULL,
    gateway_reference VARCHAR(100),
    status VARCHAR(30) DEFAULT 'NOT_APPLICABLE',
    initiated_at TIMESTAMPTZ,
    settled_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    failure_reason TEXT,
    correlation_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for refunds
CREATE INDEX IF NOT EXISTS idx_event_refunds_event_id ON event_refunds(event_id);
CREATE INDEX IF NOT EXISTS idx_event_refunds_registration_id ON event_refunds(registration_id);
CREATE INDEX IF NOT EXISTS idx_event_refunds_status ON event_refunds(status);

-- 4. Create Event Cancellation Jobs Table (Async Processing Queue)
CREATE TABLE IF NOT EXISTS event_cancellation_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    correlation_id UUID NOT NULL,
    status VARCHAR(30) DEFAULT 'PENDING',
    total_registrations INTEGER DEFAULT 0,
    processed_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    batch_size INTEGER DEFAULT 50,
    last_processed_at TIMESTAMPTZ,
    error_log JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Index for jobs
CREATE INDEX IF NOT EXISTS idx_event_cancellation_jobs_event_id ON event_cancellation_jobs(event_id);
CREATE INDEX IF NOT EXISTS idx_event_cancellation_jobs_status ON event_cancellation_jobs(status);

-- RLS for event_refunds
ALTER TABLE event_refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own refunds" ON event_refunds
    FOR SELECT USING (auth.uid() = user_id);

-- RLS for event_cancellation_jobs (Admins only)
ALTER TABLE event_cancellation_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can see cancellation jobs" ON event_cancellation_jobs
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM profiles 
        JOIN roles ON profiles.role_id = roles.id
        WHERE profiles.id = auth.uid() AND roles.name IN ('admin', 'manager')
    ));
