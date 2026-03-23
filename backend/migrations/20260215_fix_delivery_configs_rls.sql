-- Migration: Fix RLS policies for delivery_configs table
-- Created: 2026-02-15
-- Purpose: Add proper RLS policies to allow admin/manager users to manage delivery configurations
-- Issue: Error 42501 - "new row violates row-level security policy for table delivery_configs"

-- Enable RLS on delivery_configs table (if not already enabled)
ALTER TABLE delivery_configs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to make migration idempotent)
DROP POLICY IF EXISTS "Allow admin users to insert delivery configs" ON delivery_configs;
DROP POLICY IF EXISTS "Allow admin users to update delivery configs" ON delivery_configs;
DROP POLICY IF EXISTS "Allow admin users to delete delivery configs" ON delivery_configs;
DROP POLICY IF EXISTS "Allow admin users to select delivery configs" ON delivery_configs;
DROP POLICY IF EXISTS "Allow public to view delivery configs" ON delivery_configs;

-- Policy 1: Allow admin/manager users to INSERT delivery configurations
CREATE POLICY "Allow admin users to insert delivery configs"
ON delivery_configs
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles
        JOIN roles ON profiles.role_id = roles.id
        WHERE profiles.id = auth.uid()
        AND roles.name IN ('admin', 'manager')
    )
);

-- Policy 2: Allow admin/manager users to UPDATE delivery configurations
CREATE POLICY "Allow admin users to update delivery configs"
ON delivery_configs
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        JOIN roles ON profiles.role_id = roles.id
        WHERE profiles.id = auth.uid()
        AND roles.name IN ('admin', 'manager')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles
        JOIN roles ON profiles.role_id = roles.id
        WHERE profiles.id = auth.uid()
        AND roles.name IN ('admin', 'manager')
    )
);

-- Policy 3: Allow admin/manager users to DELETE delivery configurations
CREATE POLICY "Allow admin users to delete delivery configs"
ON delivery_configs
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        JOIN roles ON profiles.role_id = roles.id
        WHERE profiles.id = auth.uid()
        AND roles.name IN ('admin', 'manager')
    )
);

-- Policy 4: Allow admin/manager users to SELECT (view) delivery configurations
CREATE POLICY "Allow admin users to select delivery configs"
ON delivery_configs
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        JOIN roles ON profiles.role_id = roles.id
        WHERE profiles.id = auth.uid()
        AND roles.name IN ('admin', 'manager')
    )
);

-- Policy 5: Allow public (unauthenticated and authenticated users) to view delivery configs
-- This is needed for the frontend to display delivery charges to customers
CREATE POLICY "Allow public to view delivery configs"
ON delivery_configs
FOR SELECT
TO public
USING (true);

-- Add comments for documentation
COMMENT ON POLICY "Allow admin users to insert delivery configs" ON delivery_configs 
    IS 'Allows admin and manager users to create new delivery configurations';
COMMENT ON POLICY "Allow admin users to update delivery configs" ON delivery_configs 
    IS 'Allows admin and manager users to update existing delivery configurations';
COMMENT ON POLICY "Allow admin users to delete delivery configs" ON delivery_configs 
    IS 'Allows admin and manager users to delete delivery configurations';
COMMENT ON POLICY "Allow admin users to select delivery configs" ON delivery_configs 
    IS 'Allows admin and manager users to view all delivery configurations';
COMMENT ON POLICY "Allow public to view delivery configs" ON delivery_configs 
    IS 'Allows all users (including unauthenticated) to view delivery configurations for products';
