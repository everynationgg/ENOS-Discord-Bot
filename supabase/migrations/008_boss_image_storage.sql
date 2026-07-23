-- Create the boss-images storage bucket for AI-generated boss artwork
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'boss-images',
  'boss-images',
  true,
  5242880, -- 5 MB limit per image
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access
CREATE POLICY "Public read access for boss images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'boss-images');

-- Allow service role to upload
CREATE POLICY "Service role can upload boss images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'boss-images');

-- Allow service role to update/upsert
CREATE POLICY "Service role can update boss images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'boss-images');
