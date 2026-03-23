-- Create policy-documents bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('policy-documents', 'policy-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Policies for the bucket
-- Allow Admin/Manager to upload/manage
DROP POLICY IF EXISTS "Admin can manage policy documents" ON storage.objects;

CREATE POLICY "Admin can manage policy documents"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'policy-documents' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    JOIN public.roles ON profiles.role_id = roles.id
    WHERE profiles.id = auth.uid()
    AND roles.name IN ('admin', 'manager')
  )
)
WITH CHECK (
  bucket_id = 'policy-documents' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    JOIN public.roles ON profiles.role_id = roles.id
    WHERE profiles.id = auth.uid()
    AND roles.name IN ('admin', 'manager')
  )
);

-- No public read access policy needed as files are private and served via backend.
