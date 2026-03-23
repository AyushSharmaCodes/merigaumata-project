
-- Enable RLS on tables just in case (best practice)
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_items ENABLE ROW LEVEL SECURITY;

-- Grant massive permissions to service_role (Backend)
-- This ensures the backend client (supabaseAdmin) can do ANYTHING
DROP POLICY IF EXISTS "Enable all for service_role" ON public.returns;
CREATE POLICY "Enable all for service_role"
ON public.returns
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all for service_role" ON public.return_items;
CREATE POLICY "Enable all for service_role"
ON public.return_items
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Allow Authenticated Users to INSERT returns (Self-Service)
-- Users should be able to create their own returns
DROP POLICY IF EXISTS "Allow users to create returns" ON public.returns;
CREATE POLICY "Allow users to create returns"
ON public.returns
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Allow Authenticated Users to SELECT their own returns
DROP POLICY IF EXISTS "Allow users to view own returns" ON public.returns;
CREATE POLICY "Allow users to view own returns"
ON public.returns
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Allow Authenticated Users to INSERT return items linked to their return
-- This is trickier as return_items doesn't have user_id, but has return_id
DROP POLICY IF EXISTS "Allow users to insert return items" ON public.return_items;
CREATE POLICY "Allow users to insert return items"
ON public.return_items
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.returns
        WHERE id = return_id
        AND user_id = auth.uid()
    )
);

-- Allow Authenticated Users to VIEW return items for their returns
DROP POLICY IF EXISTS "Allow users to view own return items" ON public.return_items;
CREATE POLICY "Allow users to view own return items"
ON public.return_items
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.returns
        WHERE id = return_id
        AND user_id = auth.uid()
    )
);
