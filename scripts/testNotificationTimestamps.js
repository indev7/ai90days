// Test script to retrieve actual notification timestamps from database
// and test the conversion logic
import { getDatabase } from '../lib/pgdb.js';

async function testNotificationTimestamps() {
  try {
    const pool = await getDatabase();
    
    // Get recent notifications with their timestamps
    const result = await pool.query(`
      SELECT 
        id, 
        type, 
        title,
        created_at,
        created_at::text as created_at_text,
        NOW() as current_time,
        NOW()::text as current_time_text,
        EXTRACT(EPOCH FROM (NOW() - created_at)) as seconds_ago
      FROM notifications 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    console.log('=== Database Notification Timestamps ===\n');
    console.log('Current time in DB:', result.rows[0]?.current_time);
    console.log('Current time (text):', result.rows[0]?.current_time_text);
    console.log('');
    
    for (const row of result.rows) {
      console.log(`Notification ID: ${row.id}`);
      console.log(`  Title: ${row.title}`);
      console.log(`  DB Timestamp (object): ${row.created_at}`);
      console.log(`  DB Timestamp (text): ${row.created_at_text}`);
      console.log(`  Seconds ago (from DB): ${Math.floor(row.seconds_ago)}`);
      
      // Test our conversion logic
      const timestamp = row.created_at_text || row.created_at.toISOString();
      const isoString = timestamp.includes('Z') || timestamp.includes('+') 
        ? timestamp 
        : timestamp.replace(' ', 'T') + 'Z';
      
      console.log(`  Converted to ISO: ${isoString}`);
      
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      
      console.log(`  Parsed Date: ${date.toISOString()}`);
      console.log(`  Current JS time: ${now.toISOString()}`);
      console.log(`  Difference (minutes): ${diffMins}`);
      console.log(`  Difference (hours): ${diffHours}`);
      
      let display;
      if (diffMins < 1) display = 'Just now';
      else if (diffMins < 60) display = `${diffMins}m ago`;
      else if (diffHours < 24) display = `${diffHours}h ago`;
      else display = date.toLocaleDateString();
      
      console.log(`  Display: ${display}`);
      console.log('');
    }
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error);
  }
}

testNotificationTimestamps();