#!/usr/bin/env node

/**
 * Phase 18 Migration Script
 * Adds vision and mission fields to groups table
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
  console.log('🚀 Starting Phase 18 migration...\n');

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
      const migrationPath = join(__dirname, '..', 'Phase1', 'PGDB', 'migrate-to-phase18.sql');
      const migration = readFileSync(migrationPath, 'utf8');
      console.log('✅ Migration file loaded\n');

      // Execute migration
      console.log('🔨 Running migration...');
      await client.query(migration);
      console.log('✅ Migration executed successfully!\n');

      // Verify columns were added
      const verifyColumns = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'groups'
          AND column_name IN ('vision', 'mission')
        ORDER BY column_name;
      `);

      if (verifyColumns.rows.length === 2) {
        console.log('📊 New columns added to groups table:');
        verifyColumns.rows.forEach(row => {
          console.log(`   ✓ ${row.column_name} (${row.data_type}, nullable: ${row.is_nullable})`);
        });
        console.log('\n✨ Phase 18 migration complete!');
      } else {
        console.error('⚠️  Warning: Expected 2 columns but found', verifyColumns.rows.length);
      }

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('\n❌ Error running migration:');
    console.error(error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Tip: Make sure PostgreSQL is running and DATABASE_URL is correct');
    } else if (error.code === '42P07') {
      console.error('\n💡 Tip: Column already exists. This is usually safe to ignore.');
    } else if (error.code === '28P01') {
      console.error('\n💡 Tip: Authentication failed. Check your username and password in DATABASE_URL');
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