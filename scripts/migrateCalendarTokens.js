import { readFileSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';
import pkg from 'pg';
const { Client } = pkg;

// Load environment variables
config({ path: '.env.local' });

async function runMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Read migration file
    const migrationPath = join(process.cwd(), 'Phase1', 'PGDB', 'migrate-calendar-tokens.sql');
    const migration = readFileSync(migrationPath, 'utf8');

    console.log('Running calendar tokens migration...');
    await client.query(migration);
    console.log('✅ Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();