/**
 * Migration script to convert time_blocks timestamps to TIMESTAMPTZ
 * This fixes timezone issues where scheduled times display incorrectly
 */

import { config } from 'dotenv';
import { Pool } from 'pg';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Load environment variables - try .env.local first, then .env
if (existsSync('.env.local')) {
  config({ path: '.env.local' });
  console.log('Loaded environment from .env.local');
} else if (existsSync('.env')) {
  config({ path: '.env' });
  console.log('Loaded environment from .env');
} else {
  console.error('No .env or .env.local file found!');
  process.exit(1);
}

// Verify DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not found in environment variables!');
  console.error('Please ensure your .env or .env.local file contains DATABASE_URL');
  process.exit(1);
}

// Debug: Show connection info (hide password)
const dbUrl = process.env.DATABASE_URL;
const maskedUrl = dbUrl.replace(/:([^:@]+)@/, ':****@');
console.log('DATABASE_URL found:', maskedUrl);
console.log('Connecting to database...');

async function migrateTimeBlocksTimestamptz() {
  console.log('Starting time_blocks TIMESTAMPTZ migration...');
  
  // Create a new pool directly with the DATABASE_URL
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    // Read the migration SQL file
    const migrationPath = join(process.cwd(), 'Phase1', 'PGDB', 'migrate-time-blocks-timestamptz.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    await pool.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    console.log('Time blocks will now correctly handle timezones.');
    
    // Verify the migration
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'time_blocks' 
      AND column_name IN ('start_time', 'created_at', 'updated_at')
      ORDER BY column_name;
    `);
    
    console.log('\nColumn types after migration:');
    result.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type}`);
    });
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    await pool.end();
    process.exit(1);
  }
}

migrateTimeBlocksTimestamptz();