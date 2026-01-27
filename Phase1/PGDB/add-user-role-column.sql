-- Migration: Add role column to users table
-- This adds a role-based access control system with Admin, Owner, Leader, and User roles
-- Add role column with default value and constraint
ALTER TABLE users
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'User';
-- Add check constraint to ensure only valid roles
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users
ADD CONSTRAINT users_role_check CHECK(role IN ('Admin', 'Owner', 'Leader', 'User'));
-- Create index for better performance on role-based queries
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
-- Add comment for documentation
COMMENT ON COLUMN users.role IS 'User role for access control: Admin, Owner, Leader, or User';