-- Quick diagnostic query to check invoices table RLS state
-- Run this in Supabase SQL editor to see current state

-- Check if RLS is enabled
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'invoices'
AND schemaname = 'public';

-- Check ALL existing policies on invoices
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'invoices'
ORDER BY policyname;

-- Check if service_role has proper grants
SELECT 
    grantee,
    privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'invoices'
AND grantee = 'service_role';
