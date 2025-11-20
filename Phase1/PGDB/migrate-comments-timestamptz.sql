-- Migration: Convert comments table timestamps to TIMESTAMPTZ
-- This ensures timestamps are stored in UTC and properly converted to local time

BEGIN;

-- Step 1: Add new TIMESTAMPTZ columns
ALTER TABLE comments 
ADD COLUMN created_at_tz TIMESTAMPTZ,
ADD COLUMN updated_at_tz TIMESTAMPTZ;

-- Step 2: Copy data from old columns to new columns
-- Assuming the existing timestamps are in UTC (server time)
UPDATE comments 
SET created_at_tz = created_at AT TIME ZONE 'UTC',
    updated_at_tz = updated_at AT TIME ZONE 'UTC';

-- Step 3: Drop old columns
ALTER TABLE comments 
DROP COLUMN created_at,
DROP COLUMN updated_at;

-- Step 4: Rename new columns to original names
ALTER TABLE comments 
RENAME COLUMN created_at_tz TO created_at;

ALTER TABLE comments 
RENAME COLUMN updated_at_tz TO updated_at;

-- Step 5: Set defaults and NOT NULL for new columns
ALTER TABLE comments 
ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN created_at SET NOT NULL;

ALTER TABLE comments 
ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN updated_at SET NOT NULL;

-- Step 6: Recreate the index on created_at
DROP INDEX IF EXISTS idx_comments_created_at;
CREATE INDEX idx_comments_created_at ON comments(created_at);

COMMIT;