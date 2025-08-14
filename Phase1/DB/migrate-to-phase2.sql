-- Migration script to add Phase 2 Microsoft OAuth fields
-- Run this if you have existing data in your database

-- Add new columns for Microsoft OAuth
ALTER TABLE users ADD COLUMN microsoft_id TEXT UNIQUE;
ALTER TABLE users ADD COLUMN first_name TEXT;
ALTER TABLE users ADD COLUMN last_name TEXT;
ALTER TABLE users ADD COLUMN profile_picture_url TEXT;
ALTER TABLE users ADD COLUMN auth_provider TEXT DEFAULT 'email';

-- Create index for Microsoft ID lookups
CREATE INDEX IF NOT EXISTS idx_users_microsoft_id ON users(microsoft_id);

-- Update existing users to have auth_provider set
UPDATE users SET auth_provider = 'email' WHERE auth_provider IS NULL;
