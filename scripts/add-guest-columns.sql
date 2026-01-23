-- Add guest user columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_guest_user BOOLEAN DEFAULT FALSE NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS guest_token TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS guest_token_expires_at TIMESTAMP WITH TIME ZONE;

-- Create index for guest_token lookups
CREATE INDEX IF NOT EXISTS idx_users_guest_token ON users(guest_token) WHERE guest_token IS NOT NULL;
