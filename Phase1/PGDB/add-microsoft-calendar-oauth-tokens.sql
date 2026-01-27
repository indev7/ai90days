-- Migration to add Microsoft Calendar token columns
-- This migration adds columns to store Microsoft OAuth tokens for calendar access

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS microsoft_access_token TEXT,
ADD COLUMN IF NOT EXISTS microsoft_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS microsoft_token_expires_at TIMESTAMPTZ;

-- Create index for token expiration lookups
CREATE INDEX IF NOT EXISTS idx_users_token_expires ON users(microsoft_token_expires_at);