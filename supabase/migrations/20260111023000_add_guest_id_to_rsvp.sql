-- Migration: Add guest_id FK to rsvp_responses
-- Description: Fixes fragile guest_name matching by adding proper FK relationship
-- Date: 2026-01-11

-- ============================================================================
-- Step 1: Add guest_id column
-- ============================================================================

ALTER TABLE rsvp_responses 
ADD COLUMN IF NOT EXISTS guest_id UUID REFERENCES guests(id) ON DELETE SET NULL;

-- ============================================================================
-- Step 2: Create index for faster lookups
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_rsvp_responses_guest_id 
ON rsvp_responses(guest_id);

-- ============================================================================
-- Step 3: Update existing records (match by guest_name where possible)
-- This is a best-effort migration for existing data
-- ============================================================================

UPDATE rsvp_responses r
SET guest_id = g.id
FROM guests g
WHERE r.guest_name = g.name
  AND r.guest_id IS NULL
  AND EXISTS (
    SELECT 1 FROM envelopes e
    WHERE e.id = g.envelope_id
      AND e.wedding_list_id = r.wedding_list_id
  );

-- ============================================================================
-- Step 4: Add unique constraint to prevent duplicates
-- A guest can only have one RSVP per wedding list
-- ============================================================================

-- First, remove potential duplicates keeping only the most recent
DELETE FROM rsvp_responses a
USING rsvp_responses b
WHERE a.id < b.id
  AND a.guest_id = b.guest_id
  AND a.wedding_list_id = b.wedding_list_id
  AND a.guest_id IS NOT NULL;

-- Now add the unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_rsvp_responses_guest_wedding_unique
ON rsvp_responses(guest_id, wedding_list_id)
WHERE guest_id IS NOT NULL;

-- ============================================================================
-- Note: guest_name is kept for backwards compatibility and display purposes
-- The authoritative link is now guest_id
-- ============================================================================
