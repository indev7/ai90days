// Check notification timestamps from database
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env.local
config({ path: join(__dirname, '..', '.env.local') });

const { Pool } = pg;

async function checkTimestamps() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('=== Current Database Time ===');
    const timeResult = await pool.query(`
      SELECT 
        NOW() as current_db_time,
        NOW() AT TIME ZONE 'UTC' as current_utc,
        NOW() AT TIME ZONE 'Asia/Colombo' as current_colombo
    `);
    console.log('DB Time:', timeResult.rows[0].current_db_time);
    console.log('UTC Time:', timeResult.rows[0].current_utc);
    console.log('Colombo Time:', timeResult.rows[0].current_colombo);
    console.log('');

    console.log('=== Recent Notifications ===');
    const notifResult = await pool.query(`
      SELECT 
        id,
        type,
        title,
        created_at,
        created_at::text as created_at_text,
        created_at AT TIME ZONE 'UTC' as created_at_utc,
        created_at AT TIME ZONE 'Asia/Colombo' as created_at_colombo,
        EXTRACT(EPOCH FROM (NOW() - created_at))/60 as minutes_ago,
        EXTRACT(EPOCH FROM (NOW() - created_at))/3600 as hours_ago
      FROM notifications 
      ORDER BY created_at DESC 
      LIMIT 5
    `);

    for (const row of notifResult.rows) {
      console.log(`\nNotification ID: ${row.id}`);
      console.log(`  Title: ${row.title}`);
      console.log(`  created_at (object): ${row.created_at}`);
      console.log(`  created_at (text): ${row.created_at_text}`);
      console.log(`  created_at UTC: ${row.created_at_utc}`);
      console.log(`  created_at Colombo: ${row.created_at_colombo}`);
      console.log(`  Minutes ago (DB calc): ${Math.floor(row.minutes_ago)}`);
      console.log(`  Hours ago (DB calc): ${Math.floor(row.hours_ago)}`);
      
      // Test our conversion logic
      const timestamp = row.created_at_text;
      const isoString = timestamp.includes('Z') || timestamp.includes('+') 
        ? timestamp 
        : timestamp.replace(' ', 'T') + 'Z';
      
      console.log(`  Converted to ISO: ${isoString}`);
      
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      
      console.log(`  JS Date object: ${date.toISOString()}`);
      console.log(`  JS Current time: ${now.toISOString()}`);
      console.log(`  JS Minutes ago: ${diffMins}`);
      console.log(`  JS Hours ago: ${diffHours}`);
      
      let display;
      if (diffMins < 1) display = 'Just now';
      else if (diffMins < 60) display = `${diffMins}m ago`;
      else if (diffHours < 24) display = `${diffHours}h ago`;
      else display = date.toLocaleDateString();
      
      console.log(`  Display: ${display}`);
    }

    console.log('\n=== Database Timezone ===');
    const tzResult = await pool.query('SHOW timezone');
    console.log('Timezone:', tzResult.rows[0].TimeZone);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkTimestamps();