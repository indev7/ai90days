/**
 * Database Migration Runner
 * 
 * Automatically runs pending database migrations in order.
 * Tracks executed migrations in a 'migrations' table.
 * 
 * Usage:
 *   npm run migrate              - Run all pending migrations
 *   npm run migrate:status       - Show migration status
 *   node scripts/runMigrations.js [--status]
 */

// Load environment variables from .env.local
require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') });

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

const MIGRATIONS_DIR = path.join(__dirname, '../Phase1/PGDB');
const EXCLUDED_FILES = ['schema.sql']; // schema.sql is handled separately by auto-init

/**
 * Create migrations tracking table if it doesn't exist
 */
async function ensureMigrationsTable() {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_migrations_name ON migrations(name);
  `;

  await pool.query(createTableSQL);
  console.log('✓ Migrations tracking table ready');
}

/**
 * Get list of all migration files in order
 */
function getMigrationFiles() {
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(file => file.endsWith('.sql'))
    .filter(file => !EXCLUDED_FILES.includes(file))
    .sort(); // Alphabetical order ensures correct execution sequence

  return files;
}

/**
 * Get list of already executed migrations
 */
async function getExecutedMigrations() {
  const result = await pool.query('SELECT name FROM migrations ORDER BY executed_at');
  return result.rows.map(row => row.name);
}

/**
 * Execute a single migration file
 */
async function executeMigration(filename) {
  const filepath = path.join(MIGRATIONS_DIR, filename);
  const sql = fs.readFileSync(filepath, 'utf8');

  console.log(`\n🔄 Running migration: ${filename}`);

  try {
    // Execute the migration SQL
    await pool.query(sql);

    // Record the migration
    await pool.query(
      'INSERT INTO migrations (name) VALUES ($1)',
      [filename]
    );

    console.log(`✅ Completed: ${filename}`);
    return { success: true, filename };
  } catch (error) {
    console.error(`❌ Failed: ${filename}`);
    console.error(`   Error: ${error.message}`);
    return { success: false, filename, error };
  }
}

/**
 * Show migration status
 */
async function showStatus() {
  const allMigrations = getMigrationFiles();
  const executed = await getExecutedMigrations();

  console.log('\n📊 Migration Status:\n');
  console.log('Executed Migrations:');
  if (executed.length === 0) {
    console.log('  (none)');
  } else {
    executed.forEach(name => console.log(`  ✅ ${name}`));
  }

  const pending = allMigrations.filter(name => !executed.includes(name));
  console.log('\nPending Migrations:');
  if (pending.length === 0) {
    console.log('  (none)');
  } else {
    pending.forEach(name => console.log(`  ⏳ ${name}`));
  }

  console.log(`\nTotal: ${allMigrations.length} | Executed: ${executed.length} | Pending: ${pending.length}\n`);
}

/**
 * Run all pending migrations
 */
async function runPendingMigrations() {
  const allMigrations = getMigrationFiles();
  const executed = await getExecutedMigrations();
  const pending = allMigrations.filter(name => !executed.includes(name));

  if (pending.length === 0) {
    console.log('\n✨ All migrations are up to date!\n');
    return { total: 0, successful: 0, failed: 0 };
  }

  console.log(`\n📦 Found ${pending.length} pending migration(s)\n`);

  const results = {
    total: pending.length,
    successful: 0,
    failed: 0,
    failures: []
  };

  for (const filename of pending) {
    const result = await executeMigration(filename);
    if (result.success) {
      results.successful++;
    } else {
      results.failed++;
      results.failures.push(result);
      // Stop on first failure to prevent cascading issues
      console.error('\n⚠️  Stopping migrations due to failure\n');
      break;
    }
  }

  return results;
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const showStatusOnly = args.includes('--status');

  console.log('🔧 Database Migration Runner\n');
  console.log(`Database: ${process.env.DATABASE_URL?.split('@')[1]?.split('?')[0] || 'configured'}\n`);

  try {
    // Ensure migrations table exists
    await ensureMigrationsTable();

    if (showStatusOnly) {
      await showStatus();
    } else {
      // Run pending migrations
      const results = await runPendingMigrations();

      // Summary
      console.log('\n' + '='.repeat(50));
      console.log('📋 Migration Summary:');
      console.log(`   Total: ${results.total}`);
      console.log(`   ✅ Successful: ${results.successful}`);
      console.log(`   ❌ Failed: ${results.failed}`);
      console.log('='.repeat(50) + '\n');

      if (results.failed > 0) {
        console.error('⚠️  Some migrations failed. Please fix errors and run again.\n');
        process.exit(1);
      } else if (results.successful > 0) {
        console.log('✨ All migrations completed successfully!\n');
      }
    }
  } catch (error) {
    console.error('\n❌ Migration runner error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { runPendingMigrations, showStatus };
