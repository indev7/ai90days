#!/usr/bin/env node

/**
 * Phase 17 Migration Script
 * Creates Strategic_Objectives table for mapping groups to strategic objectives
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
  console.log('🚀 Starting strategic objectives table migration...\n');

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
      // Check if strategic_objectives table already exists
      const tableCheck = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'strategic_objectives';
      `);

      if (tableCheck.rows.length > 0) {
        console.log('⚠️  Warning: strategic_objectives table already exists!');
        console.log('   Migration may have already been run.');
        console.log('\n❓ Do you want to continue anyway? (Press Ctrl+C to cancel, or wait 3 seconds...)\n');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      // Read migration file
      console.log('📖 Reading migration file...');
      const migrationPath = join(__dirname, '..', 'Phase1', 'PGDB', 'add-strategic-objectives-table.sql');
      const migration = readFileSync(migrationPath, 'utf8');
      console.log('✅ Migration file loaded\n');

      // Execute migration
      console.log('🔨 Running migration...');
      await client.query(migration);
      console.log('✅ Migration executed successfully!\n');

      // Verify table was created
      const verifyTable = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name = 'strategic_objectives'
        ORDER BY ordinal_position;
      `);

      console.log('📊 Strategic_Objectives table structure:');
      verifyTable.rows.forEach(row => {
        console.log(`   ✓ ${row.column_name} (${row.data_type}) ${row.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
      });

      // Verify indexes
      const verifyIndexes = await client.query(`
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
        AND tablename = 'strategic_objectives';
      `);

      console.log('\n📇 Indexes created:');
      verifyIndexes.rows.forEach(row => {
        console.log(`   ✓ ${row.indexname}`);
      });

      console.log('\n✨ Strategic objectives table migration complete!');
      console.log('\n📝 Next steps:');
      console.log('   1. Update API endpoints to handle strategic objectives');
      console.log('   2. Update AddGroupModal component to allow selecting strategic objectives');
      console.log('   3. Test the new functionality');

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('\n❌ Error running migration:');
    console.error(error.message);

    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Tip: Make sure PostgreSQL is running and DATABASE_URL is correct');
    } else if (error.code === '42P07') {
      console.error('\n💡 Tip: Table already exists. Migration may have already been run.');
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