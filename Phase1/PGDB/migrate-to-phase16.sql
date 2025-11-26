-- Phase 16: Add user roles system
-- Add Role column to users table

-- Add role column with default value 'User'
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'User' CHECK(role IN ('Admin', 'Owner', 'Leader', 'User'));

-- Create index for faster role-based queries
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Set 'indev' user to Admin role
UPDATE users SET role = 'Admin' WHERE username = 'indev';

-- Verify the changes
SELECT username, role FROM users WHERE username = 'indev';