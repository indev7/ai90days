-- Add Jira OAuth 2.0 tokens to users table
-- This enables multi-user Jira authentication where each user has their own tokens
ALTER TABLE users
ADD COLUMN IF NOT EXISTS jira_access_token TEXT,
    ADD COLUMN IF NOT EXISTS jira_refresh_token TEXT,
    ADD COLUMN IF NOT EXISTS jira_cloud_id TEXT,
    ADD COLUMN IF NOT EXISTS jira_token_expires_at TIMESTAMPTZ;
-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_jira_cloud_id ON users(jira_cloud_id);
-- Add comment for documentation
COMMENT ON COLUMN users.jira_access_token IS 'Jira OAuth 2.0 access token for this specific user';
COMMENT ON COLUMN users.jira_refresh_token IS 'Jira OAuth 2.0 refresh token for token renewal';
COMMENT ON COLUMN users.jira_cloud_id IS 'Atlassian cloud ID for this user''s Jira instance';
COMMENT ON COLUMN users.jira_token_expires_at IS 'Expiration timestamp for the Jira access token';