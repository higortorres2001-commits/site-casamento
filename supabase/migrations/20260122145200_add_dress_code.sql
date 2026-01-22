-- Migration: Add dress_code field to wedding_lists
-- This field allows couples to specify the dress code for their wedding

ALTER TABLE public.wedding_lists 
ADD COLUMN IF NOT EXISTS dress_code TEXT;

COMMENT ON COLUMN public.wedding_lists.dress_code IS 'Optional dress code specification for the wedding (e.g., "Esporte Fino", "Black Tie")';
