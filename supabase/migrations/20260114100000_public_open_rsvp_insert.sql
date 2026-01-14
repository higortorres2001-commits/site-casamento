-- Migration: Allow public INSERT for open RSVP mode
-- Description: Fixes error when anonymous users try to confirm presence on open lists
-- Date: 2026-01-14

-- ============================================================================
-- STEP 1: Allow public to create envelopes on public lists with open RSVP
-- ============================================================================

DROP POLICY IF EXISTS "Public can create envelopes on open lists" ON envelopes;
CREATE POLICY "Public can create envelopes on open lists" ON envelopes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM wedding_lists 
      WHERE wedding_lists.id = wedding_list_id 
      AND wedding_lists.is_public = true
      AND wedding_lists.rsvp_mode = 'open'
    )
  );

-- ============================================================================
-- STEP 2: Allow public to create guests on envelopes from public open lists
-- ============================================================================

DROP POLICY IF EXISTS "Public can create guests on open lists" ON guests;
CREATE POLICY "Public can create guests on open lists" ON guests
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM envelopes
      JOIN wedding_lists ON wedding_lists.id = envelopes.wedding_list_id
      WHERE envelopes.id = envelope_id 
      AND wedding_lists.is_public = true
      AND wedding_lists.rsvp_mode = 'open'
    )
  );
