-- ============================================================
-- Create inspection_photos storage bucket + comprehensive access policies
-- Handles both authenticated and anon uploads (POST and PUT methods)
-- ============================================================

-- Create the bucket (public = true so GET requests don't need auth)
INSERT INTO storage.buckets (id, name, public)
VALUES ('inspection_photos', 'inspection_photos', true)
ON CONFLICT (id) DO NOTHING;

-- Policy 1: Allow public SELECT (anyone can view photos)
CREATE POLICY "Public SELECT inspection_photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'inspection_photos');

-- Policy 2: Allow authenticated users to INSERT (POST upload)
CREATE POLICY "Authenticated INSERT inspection_photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'inspection_photos' 
    AND auth.role() = 'authenticated'
  );

-- Policy 3: Allow authenticated users to UPDATE (PUT upload)
CREATE POLICY "Authenticated UPDATE inspection_photos"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'inspection_photos' AND auth.role() = 'authenticated')
  WITH CHECK (bucket_id = 'inspection_photos' AND auth.role() = 'authenticated');

-- Policy 4: Allow authenticated users to DELETE
CREATE POLICY "Authenticated DELETE inspection_photos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'inspection_photos' AND auth.role() = 'authenticated');

-- Policy 5: Allow anon users to INSERT inspection photos (POST upload)
CREATE POLICY "Anon INSERT inspection_photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'inspection_photos' 
    AND auth.role() = 'anon'
  );

-- Policy 6: Allow anon users to UPDATE inspection photos (PUT upload)
CREATE POLICY "Anon UPDATE inspection_photos"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'inspection_photos' 
    AND auth.role() = 'anon'
  )
  WITH CHECK (
    bucket_id = 'inspection_photos' 
    AND auth.role() = 'anon'
  );
