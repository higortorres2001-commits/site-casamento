-- Migration: Re-enable RLS and Policies
-- Description: Explicitly enables RLS and re-applies security policies to ensure system security.
-- Date: 2026-01-10

-- ============================================================================
-- Enable RLS on all tables
-- ============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE wedding_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE gifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_reservations ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Re-apply Policies
-- ============================================================================

-- Profiles: Users can only view/edit their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Wedding Lists: Users can manage their own lists, anyone can view public lists
DROP POLICY IF EXISTS "Users can view own wedding lists" ON wedding_lists;
CREATE POLICY "Users can view own wedding lists" ON wedding_lists
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can view public wedding lists" ON wedding_lists;
CREATE POLICY "Anyone can view public wedding lists" ON wedding_lists
  FOR SELECT USING (is_public = true);

DROP POLICY IF EXISTS "Users can insert own wedding lists" ON wedding_lists;
CREATE POLICY "Users can insert own wedding lists" ON wedding_lists
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own wedding lists" ON wedding_lists;
CREATE POLICY "Users can update own wedding lists" ON wedding_lists
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own wedding lists" ON wedding_lists;
CREATE POLICY "Users can delete own wedding lists" ON wedding_lists
  FOR DELETE USING (auth.uid() = user_id);

-- Gifts: Users can manage gifts in their lists, anyone can view gifts from public lists
DROP POLICY IF EXISTS "Users can view gifts from own lists" ON gifts;
CREATE POLICY "Users can view gifts from own lists" ON gifts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM wedding_lists 
      WHERE wedding_lists.id = gifts.wedding_list_id 
      AND wedding_lists.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Anyone can view gifts from public lists" ON gifts;
CREATE POLICY "Anyone can view gifts from public lists" ON gifts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM wedding_lists 
      WHERE wedding_lists.id = gifts.wedding_list_id 
      AND wedding_lists.is_public = true
    )
  );

DROP POLICY IF EXISTS "Users can insert gifts to own lists" ON gifts;
CREATE POLICY "Users can insert gifts to own lists" ON gifts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM wedding_lists 
      WHERE wedding_lists.id = gifts.wedding_list_id 
      AND wedding_lists.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update gifts in own lists" ON gifts;
CREATE POLICY "Users can update gifts in own lists" ON gifts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM wedding_lists 
      WHERE wedding_lists.id = gifts.wedding_list_id 
      AND wedding_lists.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete gifts from own lists" ON gifts;
CREATE POLICY "Users can delete gifts from own lists" ON gifts
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM wedding_lists 
      WHERE wedding_lists.id = gifts.wedding_list_id 
      AND wedding_lists.user_id = auth.uid()
    )
  );

-- Gift Reservations: List owners can view all reservations, guests can view their own
DROP POLICY IF EXISTS "List owners can view reservations" ON gift_reservations;
CREATE POLICY "List owners can view reservations" ON gift_reservations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM gifts
      JOIN wedding_lists ON wedding_lists.id = gifts.wedding_list_id
      WHERE gifts.id = gift_reservations.gift_id
      AND wedding_lists.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Anyone can view public list reservations" ON gift_reservations;
CREATE POLICY "Anyone can view public list reservations" ON gift_reservations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM gifts
      JOIN wedding_lists ON wedding_lists.id = gifts.wedding_list_id
      WHERE gifts.id = gift_reservations.gift_id
      AND wedding_lists.is_public = true
    )
  );

DROP POLICY IF EXISTS "Anyone can create reservations on public lists" ON gift_reservations;
CREATE POLICY "Anyone can create reservations on public lists" ON gift_reservations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM gifts
      JOIN wedding_lists ON wedding_lists.id = gifts.wedding_list_id
      WHERE gifts.id = gift_reservations.gift_id
      AND wedding_lists.is_public = true
    )
  );

DROP POLICY IF EXISTS "List owners can update reservations" ON gift_reservations;
CREATE POLICY "List owners can update reservations" ON gift_reservations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM gifts
      JOIN wedding_lists ON wedding_lists.id = gifts.wedding_list_id
      WHERE gifts.id = gift_reservations.gift_id
      AND wedding_lists.user_id = auth.uid()
    )
  );
