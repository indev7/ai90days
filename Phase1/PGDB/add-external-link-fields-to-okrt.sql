-- Migration: Add external link fields to okrt table
-- This adds support for linking OKRTs to external systems (JIRA tickets, Microsoft Calendar events)
-- Add link_type column (enum: JIRA or CAL)
ALTER TABLE okrt
ADD COLUMN IF NOT EXISTS link_type TEXT CHECK(link_type IN ('JIRA', 'CAL'));
-- Add link_id column to store external system ID
ALTER TABLE okrt
ADD COLUMN IF NOT EXISTS link_id TEXT;
-- Create index for faster lookups by link type
CREATE INDEX IF NOT EXISTS idx_okrt_link_type ON okrt(link_type);
-- Create index for faster lookups by link_id
CREATE INDEX IF NOT EXISTS idx_okrt_link_id ON okrt(link_id);
-- Add comments for documentation
COMMENT ON COLUMN okrt.link_type IS 'Type of external link: JIRA (JIRA ticket) or CAL (Microsoft Calendar event)';
COMMENT ON COLUMN okrt.link_id IS 'ID from external system (JIRA ticket ID or Calendar event ID) used to form URL link';