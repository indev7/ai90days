-- Test script to check notification timestamps
-- Run with: psql -h <host> -U <user> -d <database> -f scripts/test-timestamps.sql

\echo '=== Current Database Time ==='
SELECT 
    NOW() as current_db_time,
    NOW() AT TIME ZONE 'UTC' as current_utc,
    NOW() AT TIME ZONE 'Asia/Colombo' as current_colombo;

\echo ''
\echo '=== Recent Notifications with Timestamps ==='
SELECT 
    id,
    type,
    title,
    created_at,
    created_at AT TIME ZONE 'UTC' as created_at_utc,
    created_at AT TIME ZONE 'Asia/Colombo' as created_at_colombo,
    EXTRACT(EPOCH FROM (NOW() - created_at))/60 as minutes_ago,
    EXTRACT(EPOCH FROM (NOW() - created_at))/3600 as hours_ago
FROM notifications 
ORDER BY created_at DESC 
LIMIT 5;

\echo ''
\echo '=== Timezone Info ==='
SHOW timezone;