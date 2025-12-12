-- Table members
CREATE TABLE IF NOT EXISTS table_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  is_master BOOLEAN DEFAULT FALSE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(table_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_table_members_table ON table_members(table_id);
CREATE INDEX IF NOT EXISTS idx_table_members_user ON table_members(user_id);

-- Enable RLS
ALTER TABLE table_members ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is a table member
CREATE OR REPLACE FUNCTION is_user_table_member(p_table_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM table_members tm
    JOIN users u ON tm.user_id = u.id
    WHERE tm.table_id = p_table_id AND u.firebase_uid = auth.uid()::text
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is table owner
CREATE OR REPLACE FUNCTION is_user_table_owner(p_table_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM tables t
    JOIN users u ON t.owner_user_id = u.id
    WHERE t.id = p_table_id AND u.firebase_uid = auth.uid()::text
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS policies
CREATE POLICY "Members can view table members" ON table_members 
  FOR SELECT USING (
    is_user_table_member(table_id) OR is_user_table_owner(table_id)
  );

-- Allow authenticated users to view members (for invite pages/counts)
CREATE POLICY "Authenticated users can view table members" ON table_members
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert themselves as members" ON table_members 
  FOR INSERT WITH CHECK (
    user_id IN (SELECT id FROM users WHERE firebase_uid = auth.uid()::text)
  );

CREATE POLICY "Users can update their own membership" ON table_members 
  FOR UPDATE USING (
    user_id IN (SELECT id FROM users WHERE firebase_uid = auth.uid()::text)
  );

CREATE POLICY "Owner can delete members" ON table_members 
  FOR DELETE USING (
    is_user_table_owner(table_id) OR 
    user_id IN (SELECT id FROM users WHERE firebase_uid = auth.uid()::text)
  );
