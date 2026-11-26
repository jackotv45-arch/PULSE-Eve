-- Public images for the event page. Uploads are restricted to UENERGY administrators.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'uenergy-event-images',
  'uenergy-event-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE OR REPLACE FUNCTION public.is_event_image_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.staff
     WHERE user_id = auth.uid()
       AND role = 'admin'
  )
$$;

REVOKE ALL ON FUNCTION public.is_event_image_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_event_image_admin() TO authenticated;

DROP POLICY IF EXISTS "UENERGY admins upload event images" ON storage.objects;
CREATE POLICY "UENERGY admins upload event images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'uenergy-event-images'
    AND public.is_event_image_admin()
  );
