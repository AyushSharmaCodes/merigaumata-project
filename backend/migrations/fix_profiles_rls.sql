-- Add RLS policy to allow service role to insert into profiles table
-- This is needed for creating manager accounts from the backend

DROP POLICY IF EXISTS "Service role can manage all profiles" ON profiles;
CREATE POLICY "Service role can manage all profiles" 
    ON profiles FOR ALL 
    USING (true) 
    WITH CHECK (true);
