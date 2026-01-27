-- Phase 18 Migration: Add vision and mission fields to groups table
-- This migration adds two new TEXT fields to store group vision and mission statements

-- Add vision column to groups table
ALTER TABLE groups ADD COLUMN IF NOT EXISTS vision TEXT;

-- Add mission column to groups table
ALTER TABLE groups ADD COLUMN IF NOT EXISTS mission TEXT;

-- Add comments for documentation
COMMENT ON COLUMN groups.vision IS 'Vision statement for the group';
COMMENT ON COLUMN groups.mission IS 'Mission statement for the group';