-- Migration: Enhance wedding_lists with personalization and event fields
-- Description: Adds fields for ceremony, party, images, and branding
-- Date: 2026-01-11

ALTER TABLE wedding_lists
ADD COLUMN IF NOT EXISTS ceremony_location_name TEXT,
ADD COLUMN IF NOT EXISTS ceremony_address TEXT,
ADD COLUMN IF NOT EXISTS ceremony_image TEXT,
ADD COLUMN IF NOT EXISTS party_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS party_location_name TEXT,
ADD COLUMN IF NOT EXISTS party_address TEXT,
ADD COLUMN IF NOT EXISTS party_image TEXT,
ADD COLUMN IF NOT EXISTS groom_image TEXT,
ADD COLUMN IF NOT EXISTS bride_image TEXT,
ADD COLUMN IF NOT EXISTS cover_image_mobile TEXT,
ADD COLUMN IF NOT EXISTS cover_image_desktop TEXT,
ADD COLUMN IF NOT EXISTS gallery_images TEXT[],
ADD COLUMN IF NOT EXISTS couple_story TEXT,
ADD COLUMN IF NOT EXISTS brand_color TEXT DEFAULT '#ec4899';
