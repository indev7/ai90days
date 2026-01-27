#!/usr/bin/env node

/**
 * Notifications Timezone Fix Script
 * Converts notifications table timestamps to TIMESTAMPTZ for proper timezone handling
 */

import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigration() {
  console.log('🚀 Starting notifications timezone fix migration...\n');

  // Check if DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    console.error('❌ ERROR: DATABASE_URL not found in .env.local');
    console.error('Please add DATABASE_URL to your .env.local file');
    process.exit(1);
  }

  console.log('📡 Connecting to database...');
  console.log(`   URL: ${process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@')}\n`);

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const client = await pool.connect();
    console.log('✅ Database connection successful!\n');

    try {
      // Read migration file
      console.log('📖 Reading migration file...');
      const migrationPath = join(__dirname, '..', 'Phase1', 'PGDB', 'fix-notifications-timezone-handling.sql');
      const migration = readFileSync(migrationPath, 'utf8');
      console.log('✅ Migration file loaded\n');

      // Execute migration
      console.log('🔨 Running migration...');
      await client.query(migration);
      console.log('✅ Migration executed successfully!\n');

      // Verify the column type change
      const columnInfo = await client.query(`
        SELECT 
          column_name, 
          data_type, 
          is_nullable,
          column_default
        FROM information_schema.columns 
        WHERE table_name = 'notifications' 
        AND column_name = 'created_at';
      `);

      if (columnInfo.rows.length > 0) {
        console.log('📊 Column information after migration:');
        const col = columnInfo.rows[0];
        console.log(`   ✓ ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
        console.log(`   ✓ Default: ${col.column_default || 'none'}`);
      }

      // Show sample data
      const sampleData = await client.query(`
        SELECT 
          id, 
          type, 
          title,
          created_at,
          created_at AT TIME ZONE 'UTC' as utc_time,
          created_at AT TIME ZONE 'Asia/Colombo' as local_time
        FROM notifications 
        ORDER BY created_at DESC 
        LIMIT 3;
      `);

      if (sampleData.rows.length > 0) {
        console.log('\n📅 Sample timestamps (most recent 3):');
        sampleData.rows.forEach(row => {
          console.log(`  Notification ID ${row.id} (${row.type}):`);
          console.log(`    - Stored (TIMESTAMPTZ): ${row.created_at}`);
          console.log(`    - UTC: ${row.utc_time}`);
          console.log(`    - Local (Asia/Colombo): ${row.local_time}`);
        });
      }

      console.log('\n✨ Notifications timezone fix migration complete!');
      console.log('Notifications will now display in local time correctly.');

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('\n❌ Error running migration:');
    console.error(error.message);

    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Tip: Make sure PostgreSQL is running and DATABASE_URL is correct');
    }

    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the migration
runMigration().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
