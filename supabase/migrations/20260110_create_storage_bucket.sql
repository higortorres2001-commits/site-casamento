-- Migration: Create Storage Bucket for Gift Images
-- Description: Creates the gift-images bucket and sets up security policies
-- Date: 2026-01-10

-- ============================================================================
-- Create Bucket
-- ============================================================================

-- Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('gift-images', 'gift-images', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Storage Policies
-- ============================================================================

-- 1. Public Access: Anyone can view images in this bucket
DROP POLICY IF EXISTS "Public Access to Gift Images" ON storage.objects;
CREATE POLICY "Public Access to Gift Images"
ON storage.objects FOR SELECT
USING ( bucket_id = 'gift-images' );

-- 2. Upload Access: Authenticated users can upload their own images
-- Enforces that the file path starts with their user ID (folder isolation)
DROP POLICY IF EXISTS "Users can upload their own gift images" ON storage.objects;
CREATE POLICY "Users can upload their own gift images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'gift-images' AND
  auth.role() = 'authenticated' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. Update Access: Users can update their own images
DROP POLICY IF EXISTS "Users can update their own gift images" ON storage.objects;
CREATE POLICY "Users can update their own gift images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'gift-images' AND
  auth.role() = 'authenticated' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. Delete Access: Users can delete their own images
DROP POLICY IF EXISTS "Users can delete their own gift images" ON storage.objects;
CREATE POLICY "Users can delete their own gift images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'gift-images' AND
  auth.role() = 'authenticated' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
