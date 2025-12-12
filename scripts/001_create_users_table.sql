-- Users table to store user information
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid TEXT UNIQUE NOT NULL,
  email TEXT,
  nickname TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- RLS policies for users table
CREATE POLICY "Users can view their own data" ON users 
  FOR SELECT USING (auth.uid()::text = firebase_uid);

CREATE POLICY "Users can update their own data" ON users 
  FOR UPDATE USING (auth.uid()::text = firebase_uid);

CREATE POLICY "Users can insert their own data" ON users 
  FOR INSERT WITH CHECK (auth.uid()::text = firebase_uid);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION touch_updated_at();
