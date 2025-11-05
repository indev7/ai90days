# Time Blocks Timezone Fix

## Problem Description

Time blocks were displaying at incorrect times due to timezone handling issues. For example:
- A time block scheduled at 12:00 PM local time (Asia/Colombo, UTC+5:30)
- Was being stored in the database correctly as 12:00
- But when rendered, it appeared at 5:30 PM (12:00 + 5:30 offset)

## Root Cause

The issue had two parts:

1. **Database Schema**: The `time_blocks.start_time` column used `TIMESTAMP` (without timezone) instead of `TIMESTAMPTZ` (with timezone)
2. **Client Code**: The calendar page was creating local ISO strings without timezone information (e.g., `2024-11-05T12:00:00` instead of `2024-11-05T12:00:00+05:30`)

When JavaScript's `Date` constructor parsed a timestamp without timezone info, it assumed UTC, causing the offset issue.

## Solution

### 1. Database Migration

Run the migration to convert the `time_blocks` table to use `TIMESTAMPTZ`:

**Important**: Make sure your `.env` file contains the `DATABASE_URL` connection string.

```bash
node scripts/migrateTimeBlocksTimestamptz.js
```

If you get a connection error, verify:
1. Your PostgreSQL database is running
2. The `DATABASE_URL` in `.env` is correct
3. You have network access to the database

This migration:
- Converts `start_time` from `TIMESTAMP` to `TIMESTAMPTZ`
- Converts `created_at` and `updated_at` to `TIMESTAMPTZ` for consistency
- Preserves all existing data by interpreting it as UTC

### 2. Code Changes

**Calendar Page (`app/calendar/page.js`)**:
- Changed from creating local ISO strings to using `toISOString()`
- This ensures timestamps include timezone information

**Schema Update (`Phase1/PGDB/schema.sql`)**:
- Updated for new installations to use `TIMESTAMPTZ` from the start

## Verification

After applying the fix:

1. **Check Database Schema**:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'time_blocks' 
AND column_name IN ('start_time', 'created_at', 'updated_at');
```

Expected output:
```
column_name  | data_type
-------------+---------------------------
created_at   | timestamp with time zone
start_time   | timestamp with time zone
updated_at   | timestamp with time zone
```

2. **Test Time Block Creation**:
- Go to the Calendar page
- Click on 12:00 PM slot
- Schedule a task
- Verify it appears at 12:00 PM (not 5:30 PM)

3. **Check Today Widget**:
- Verify scheduled tasks appear at the correct time
- Check that the clock sectors align with the scheduled times

## Technical Details

### TIMESTAMP vs TIMESTAMPTZ

- `TIMESTAMP`: Stores date/time without timezone info. When parsed by clients, they may interpret it differently based on their timezone.
- `TIMESTAMPTZ`: Stores date/time with timezone info. PostgreSQL converts it to UTC internally but preserves the original timezone offset, ensuring consistent interpretation across all clients.

### ISO String Format

- Without timezone: `2024-11-05T12:00:00` (ambiguous)
- With timezone: `2024-11-05T12:00:00+05:30` (unambiguous)
- UTC format: `2024-11-05T06:30:00Z` (same moment, expressed in UTC)

JavaScript's `toISOString()` always returns UTC format with 'Z' suffix, which PostgreSQL correctly interprets and converts to the appropriate timezone.

## Files Modified

1. `Phase1/PGDB/migrate-time-blocks-timestamptz.sql` - Migration script (new)
2. `scripts/migrateTimeBlocksTimestamptz.js` - Migration runner (new)
3. `Phase1/PGDB/schema.sql` - Updated schema for new installations
4. `app/calendar/page.js` - Fixed timestamp creation
5. `TIME_BLOCKS_TIMEZONE_FIX.md` - This documentation (new)

## Rollback (if needed)

If you need to rollback the migration:

```sql
-- Convert back to TIMESTAMP (will lose timezone info)
ALTER TABLE time_blocks ALTER COLUMN start_time TYPE TIMESTAMP;
ALTER TABLE time_blocks ALTER COLUMN created_at TYPE TIMESTAMP;
ALTER TABLE time_blocks ALTER COLUMN updated_at TYPE TIMESTAMP;
```

Note: This is not recommended as it will reintroduce the timezone bug.