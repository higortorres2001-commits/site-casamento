-- Enable RLS
ALTER TABLE rsvp_responses ENABLE ROW LEVEL SECURITY;

-- Policy: Owners can do everything (SELECT, INSERT, UPDATE, DELETE)
-- This relies on determining ownership via the wedding_lists table
CREATE POLICY "Owners can manage all rsvp" ON rsvp_responses
  USING (
    EXISTS (
      SELECT 1 FROM wedding_lists 
      WHERE wedding_lists.id = rsvp_responses.wedding_list_id 
      AND wedding_lists.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM wedding_lists 
      WHERE wedding_lists.id = rsvp_responses.wedding_list_id 
      AND wedding_lists.user_id = auth.uid()
    )
  );

-- Policy: Public/Anonymous access (SELECT, INSERT, UPDATE)
-- Allowed only if the wedding list is marked as public
-- Note: This is an "open" policy for public lists to allow guest RSVPs without login
CREATE POLICY "Public can manage rsvp for public lists" ON rsvp_responses
  USING (
    EXISTS (
      SELECT 1 FROM wedding_lists 
      WHERE wedding_lists.id = rsvp_responses.wedding_list_id 
      AND wedding_lists.is_public = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM wedding_lists 
      WHERE wedding_lists.id = rsvp_responses.wedding_list_id 
      AND wedding_lists.is_public = true
    )
  );
