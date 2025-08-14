import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { readFileSync } from 'fs';
import { join } from 'path';

let db = null;

export async function getDatabase() {
  if (db) return db;

  // Ensure Phase1/DB directory exists
  const dbPath = join(process.cwd(), 'Phase1', 'DB', 'app.db');
  
  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Initialize schema if needed
  try {
    const schemaPath = join(process.cwd(), 'Phase1', 'DB', 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf8');
    await db.exec(schema);
    
    // Check if we need to migrate to Phase 2 schema
    try {
      await db.get('SELECT microsoft_id FROM users LIMIT 1');
    } catch (migrationError) {
      // Column doesn't exist, run migration
      console.log('Migrating database to Phase 2 schema...');
      const migrationPath = join(process.cwd(), 'Phase1', 'DB', 'migrate-to-phase2.sql');
      const migration = readFileSync(migrationPath, 'utf8');
      await db.exec(migration);
      console.log('Database migration completed!');
    }
  } catch (error) {
    console.error('Error initializing database schema:', error);
  }

  return db;
}

export async function getUserByEmail(email) {
  const database = await getDatabase();
  return database.get('SELECT * FROM users WHERE email = ?', [email]);
}

export async function getUserByUsername(username) {
  const database = await getDatabase();
  return database.get('SELECT * FROM users WHERE LOWER(username) = LOWER(?)', [username]);
}

export async function createUser({ email, password_hash, display_name }) {
  const database = await getDatabase();
  const username = email; // Use email as username for Phase 1
  
  const result = await database.run(
    'INSERT INTO users (username, password_hash, display_name, email) VALUES (?, ?, ?, ?)',
    [username, password_hash, display_name, email]
  );
  
  return database.get('SELECT * FROM users WHERE id = ?', [result.lastID]);
}

export async function updateUser(userId, updateData) {
  const database = await getDatabase();
  
  const updateFields = Object.keys(updateData);
  const updateValues = Object.values(updateData);
  const setClause = updateFields.map(field => `${field} = ?`).join(', ');

  await database.run(
    `UPDATE users SET ${setClause} WHERE id = ?`,
    [...updateValues, userId]
  );
  
  return database.get('SELECT * FROM users WHERE id = ?', [userId]);
}

export async function getUserByMicrosoftId(microsoftId) {
  const database = await getDatabase();
  return database.get('SELECT * FROM users WHERE microsoft_id = ?', [microsoftId]);
}
