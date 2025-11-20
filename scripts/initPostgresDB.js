#!/usr/bin/env node

/**
 * PostgreSQL Database Initialization Script
 * Connects to DATABASE_URL and creates all tables from schema
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

async function initializeDatabase() {
  console.log('🚀 Starting PostgreSQL database initialization...\n');

  // Check if DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    console.error('❌ ERROR: DATABASE_URL not found in .env.local');
    console.error('Please add DATABASE_URL to your .env.local file');
    console.error('Example: DATABASE_URL=postgresql://user:password@localhost:5432/ampcode');
    process.exit(1);
  }

  console.log('📡 Connecting to database...');
  console.log(`   URL: ${process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@')}\n`);

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    // Test connection
    const client = await pool.connect();
    console.log('✅ Database connection successful!\n');

    try {
      // Check if tables already exist
      const tableCheck = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('users', 'okrt', 'groups', 'notifications', 'comments', 'time_blocks')
        ORDER BY table_name;
      `);

      if (tableCheck.rows.length > 0) {
        console.log('⚠️  Warning: Some tables already exist:');
        tableCheck.rows.forEach(row => {
          console.log(`   - ${row.table_name}`);
        });
        console.log('\n❓ Do you want to continue? This will skip existing tables.');
        console.log('   (Press Ctrl+C to cancel, or wait 5 seconds to continue...)\n');
        
        // Wait 5 seconds
        await new Promise(resolve => setTimeout(resolve, 5000));
      }

      // Read schema file
      console.log('📖 Reading schema file...');
      const schemaPath = join(__dirname, '..', 'Phase1', 'PGDB', 'schema.sql');
      const schema = readFileSync(schemaPath, 'utf8');
      console.log('✅ Schema file loaded\n');

      // Execute schema
      console.log('🔨 Creating database tables...');
      await client.query(schema);
      console.log('✅ Schema executed successfully!\n');

      // Verify tables were created
      const verifyTables = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name;
      `);

      console.log('📊 Database tables created:');
      verifyTables.rows.forEach(row => {
        console.log(`   ✓ ${row.table_name}`);
      });

      // Count indexes
      const indexCount = await client.query(`
        SELECT COUNT(*) as count
        FROM pg_indexes
        WHERE schemaname = 'public';
      `);
      console.log(`\n📇 Total indexes created: ${indexCount.rows[0].count}`);

      // Count triggers
      const triggerCount = await client.query(`
        SELECT COUNT(*) as count
        FROM pg_trigger
        WHERE tgname NOT LIKE 'pg_%';
      `);
      console.log(`⚡ Total triggers created: ${triggerCount.rows[0].count}`);

      console.log('\n✨ Database initialization complete!');
      console.log('\n📝 Next steps:');
      console.log('   1. Update your imports from @/lib/db to @/lib/pgdb');
      console.log('   2. Update datetime("now") to CURRENT_TIMESTAMP in queries');
      console.log('   3. Test your application with PostgreSQL');

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('\n❌ Error initializing database:');
    console.error(error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Tip: Make sure PostgreSQL is running and DATABASE_URL is correct');
    } else if (error.code === '42P07') {
      console.error('\n💡 Tip: Table already exists. This is usually safe to ignore.');
    } else if (error.code === '28P01') {
      console.error('\n💡 Tip: Authentication failed. Check your username and password in DATABASE_URL');
    } else if (error.code === '3D000') {
      console.error('\n💡 Tip: Database does not exist. Create it first with: createdb ampcode');
    }
    
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the initialization
initializeDatabase().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});