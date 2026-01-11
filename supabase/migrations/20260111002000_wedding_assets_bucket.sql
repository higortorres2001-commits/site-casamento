-- Migration: Create Storage Bucket for Wedding Assets
-- Description: Creates the wedding-assets bucket and sets up security policies
-- Date: 2026-01-11

-- Create the bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('wedding-assets', 'wedding-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Policies

-- 1. Public Access
DROP POLICY IF EXISTS "Public Access to Wedding Assets" ON storage.objects;
CREATE POLICY "Public Access to Wedding Assets"
ON storage.objects FOR SELECT
USING ( bucket_id = 'wedding-assets' );

-- 2. Upload Access (Authenticated Users)
DROP POLICY IF EXISTS "Users can upload their own wedding assets" ON storage.objects;
CREATE POLICY "Users can upload their own wedding assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'wedding-assets' AND
  auth.role() = 'authenticated' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. Update Access
DROP POLICY IF EXISTS "Users can update their own wedding assets" ON storage.objects;
CREATE POLICY "Users can update their own wedding assets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'wedding-assets' AND
  auth.role() = 'authenticated' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. Delete Access
DROP POLICY IF EXISTS "Users can delete their own wedding assets" ON storage.objects;
CREATE POLICY "Users can delete their own wedding assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'wedding-assets' AND
  auth.role() = 'authenticated' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
