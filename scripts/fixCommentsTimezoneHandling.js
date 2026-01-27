#!/usr/bin/env node

/**
 * Migration script to convert comments table timestamps to TIMESTAMPTZ
 * This ensures timestamps are stored in UTC and properly converted to local time
 */

require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🔄 Starting comments timezone fix migration...');

    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '../Phase1/PGDB/fix-comments-timezone-handling.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📝 Executing migration as a single transaction...');

    // Execute the entire migration as one query (it has BEGIN/COMMIT)
    await pool.query(migrationSQL);

    console.log('✅ Migration completed successfully!');
    console.log('\n🔍 Verifying migration...');

    // Verify the migration
    const result = await pool.query(`
      SELECT 
        column_name, 
        data_type, 
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_name = 'comments' 
        AND column_name IN ('created_at', 'updated_at')
      ORDER BY column_name;
    `);

    console.log('\n📊 Current column definitions:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable}, default: ${row.column_default})`);
    });

    // Show sample data
    const sampleData = await pool.query(`
      SELECT 
        id, 
        created_at,
        created_at AT TIME ZONE 'UTC' as utc_time,
        created_at AT TIME ZONE 'Asia/Colombo' as local_time
      FROM comments 
      ORDER BY created_at DESC 
      LIMIT 3;
    `);

    if (sampleData.rows.length > 0) {
      console.log('\n📅 Sample timestamps (most recent 3):');
      sampleData.rows.forEach(row => {
        console.log(`  Comment ID ${row.id}:`);
        console.log(`    - Stored (TIMESTAMPTZ): ${row.created_at}`);
        console.log(`    - UTC: ${row.utc_time}`);
        console.log(`    - Local (Asia/Colombo): ${row.local_time}`);
      });
    }

    console.log('\n✨ Migration complete! Comments will now display in local time.');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the migration
runMigration();