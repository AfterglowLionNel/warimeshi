-- Tables (groups/sessions) for bill splitting
CREATE TABLE IF NOT EXISTS tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  event_date DATE NOT NULL,
  invite_token TEXT UNIQUE NOT NULL,
  is_archived BOOLEAN DEFAULT FALSE,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for invite token lookups
CREATE INDEX IF NOT EXISTS idx_tables_invite_token ON tables(invite_token);
CREATE INDEX IF NOT EXISTS idx_tables_owner ON tables(owner_user_id);

-- Enable RLS
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;

-- Allow anyone to view tables (for invite link resolution)
CREATE POLICY "Anyone can view tables" ON tables 
  FOR SELECT USING (true);

-- Only owner can insert/update/delete
CREATE POLICY "Owner can insert tables" ON tables 
  FOR INSERT WITH CHECK (
    owner_user_id IN (SELECT id FROM users WHERE firebase_uid = auth.uid()::text)
  );

CREATE POLICY "Owner can update tables" ON tables 
  FOR UPDATE USING (
    owner_user_id IN (SELECT id FROM users WHERE firebase_uid = auth.uid()::text)
  );

CREATE POLICY "Owner can delete tables" ON tables 
  FOR DELETE USING (
    owner_user_id IN (SELECT id FROM users WHERE firebase_uid = auth.uid()::text)
  );

CREATE TRIGGER tables_updated_at
  BEFORE UPDATE ON tables
  FOR EACH ROW
  EXECUTE FUNCTION touch_updated_at();
