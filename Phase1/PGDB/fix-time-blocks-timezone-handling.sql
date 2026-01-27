-- Migration: Convert time_blocks.start_time to TIMESTAMPTZ
-- This fixes timezone issues where times are displayed incorrectly

-- Step 1: Add new column with timezone support
ALTER TABLE time_blocks ADD COLUMN start_time_tz TIMESTAMPTZ;

-- Step 2: Copy data, interpreting existing timestamps as UTC
UPDATE time_blocks SET start_time_tz = start_time AT TIME ZONE 'UTC';

-- Step 3: Drop old column
ALTER TABLE time_blocks DROP COLUMN start_time;

-- Step 4: Rename new column to original name
ALTER TABLE time_blocks RENAME COLUMN start_time_tz TO start_time;

-- Step 5: Make it NOT NULL
ALTER TABLE time_blocks ALTER COLUMN start_time SET NOT NULL;

-- Step 6: Recreate the index
DROP INDEX IF EXISTS idx_time_blocks_user_date;
CREATE INDEX idx_time_blocks_user_date ON time_blocks(user_id, start_time);

-- Also update created_at and updated_at to use TIMESTAMPTZ for consistency
ALTER TABLE time_blocks ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE time_blocks ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';