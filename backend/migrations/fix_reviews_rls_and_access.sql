-- Allow admins/managers to delete any review
CREATE POLICY "Admins and Managers can delete any review"
ON public.reviews FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role_id IN (
      SELECT id FROM public.roles WHERE name IN ('admin', 'manager')
    )
  )
);

-- Ensure profiles are viewable by everyone (needed for reviews to show user info)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone"
ON public.profiles FOR SELECT
USING (true);

-- Ensure products are viewable by everyone
DROP POLICY IF EXISTS "Products are viewable by everyone" ON public.products;
CREATE POLICY "Products are viewable by everyone"
ON public.products FOR SELECT
USING (true);
