-- Migration script to convert notifications.created_at from TIMESTAMP to TIMESTAMPTZ
-- This migration assumes existing timestamps are in UTC

-- Step 1: Alter the column type to TIMESTAMPTZ
-- The USING clause ensures existing TIMESTAMP values are interpreted as UTC
ALTER TABLE notifications 
ALTER COLUMN created_at TYPE TIMESTAMPTZ 
USING created_at AT TIME ZONE 'UTC';

-- Step 2: Verify the migration
-- This query will show a sample of notifications with their new TIMESTAMPTZ values
SELECT 
    id, 
    user_id, 
    type, 
    title,
    created_at,
    created_at AT TIME ZONE 'UTC' as created_at_utc,
    created_at AT TIME ZONE 'Asia/Colombo' as created_at_local_example
FROM notifications 
ORDER BY created_at DESC 
LIMIT 5;

-- Step 3: Verify the column type change
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'notifications' 
AND column_name = 'created_at';

-- Note: After running this migration:
-- 1. All existing timestamps will be preserved and interpreted as UTC
-- 2. New notifications will automatically store timestamps in UTC
-- 3. PostgreSQL will handle timezone conversions automatically
-- 4. The application code (lib/dateUtils.js) will convert to local time for display