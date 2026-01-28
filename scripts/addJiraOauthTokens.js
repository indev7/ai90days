// Run Jira OAuth database migration
import 'dotenv/config';
import { getDatabase } from '../lib/pgdb.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigration() {
  try {
    console.log('Running Jira OAuth migration...');
    console.log('Database URL:', process.env.DATABASE_URL ? 'Found' : 'Not found');
    
    const db = await getDatabase();
    const migrationSQL = readFileSync(
      join(__dirname, '../Phase1/PGDB/add-jira-oauth-tokens.sql'),
      'utf8'
    );
    
    await db.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    console.log('Added columns:');
    console.log('  - jira_access_token');
    console.log('  - jira_refresh_token');
    console.log('  - jira_cloud_id');
    console.log('  - jira_token_expires_at');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();
