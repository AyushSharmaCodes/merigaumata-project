-- Migration: Create email_logs table
-- This table tracks all emails sent through the system for auditing and debugging

-- Create email_logs table
CREATE TABLE IF NOT EXISTS email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    to_email VARCHAR(255) NOT NULL,
    subject VARCHAR(500),
    provider VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('SENT', 'FAILED', 'PENDING')),
    message_id VARCHAR(255),
    error TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for querying by status
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);

-- Create index for querying by recipient
CREATE INDEX IF NOT EXISTS idx_email_logs_to_email ON email_logs(to_email);

-- Create index for querying by created_at (for time-based queries)
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_logs(created_at DESC);

-- Add comment to table
COMMENT ON TABLE email_logs IS 'Tracks all emails sent through the email service for auditing and debugging';

-- Grant appropriate permissions (adjust based on your RLS policy)
-- Enable Row Level Security
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Only authenticated users with admin/manager role can read email logs
CREATE POLICY "Admin and manager can read email logs" ON email_logs
    FOR SELECT
    USING (
        auth.jwt() ->> 'role' IN ('admin', 'manager')
    );

-- Policy: Service role can insert (backend operations)
CREATE POLICY "Service role can insert email logs" ON email_logs
    FOR INSERT
    WITH CHECK (true);
