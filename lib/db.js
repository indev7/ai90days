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
    
    // Check if we need to migrate to Phase 3 schema (OKRT table)
    try {
      await db.get('SELECT id FROM okrt LIMIT 1');
    } catch (migrationError) {
      // OKRT table doesn't exist, run migration
      console.log('Migrating database to Phase 3 schema...');
      const migrationPath = join(process.cwd(), 'Phase1', 'DB', 'migrate-to-phase3.sql');
      const migration = readFileSync(migrationPath, 'utf8');
      await db.exec(migration);
      console.log('Phase 3 database migration completed!');
    }

    // Add header_image_url to okrt if missing (non-destructive schema change)
    try {
      await db.get('SELECT header_image_url FROM okrt LIMIT 1');
    } catch (missingColumnError) {
      console.log('Adding header_image_url column to okrt table...');
      await db.exec('ALTER TABLE okrt ADD COLUMN header_image_url TEXT');
      console.log('Added header_image_url column.');
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

// OKRT database functions
export async function createOKRT(okrtData) {
  const database = await getDatabase();
  const {
    id, type, owner_id, parent_id, title, description, progress = 0,
    status = 'D', area, cycle_qtr, order_index = 0, visibility = 'private',
    objective_kind, kr_target_number, kr_unit, kr_baseline_number,
    header_image_url,
    weight = 1.0, task_status, due_date, recurrence_json, blocked_by
  } = okrtData;

  const result = await database.run(`
    INSERT INTO okrt (
      id, type, owner_id, parent_id, title, description, progress, status,
      area, cycle_qtr, order_index, visibility, objective_kind,
      kr_target_number, kr_unit, kr_baseline_number, header_image_url, weight,
      task_status, due_date, recurrence_json, blocked_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id, type, owner_id, parent_id, title, description, progress, status,
    area, cycle_qtr, order_index, visibility, objective_kind,
    kr_target_number, kr_unit, kr_baseline_number, header_image_url, weight,
    task_status, due_date, recurrence_json, blocked_by
  ]);

  return database.get('SELECT * FROM okrt WHERE id = ?', [id]);
}

export async function getOKRTById(id) {
  const database = await getDatabase();
  return database.get('SELECT * FROM okrt WHERE id = ?', [id]);
}

export async function getOKRTsByOwner(ownerId) {
  const database = await getDatabase();
  return database.all('SELECT * FROM okrt WHERE owner_id = ? ORDER BY order_index ASC', [ownerId]);
}

export async function getOKRTsByParent(parentId) {
  const database = await getDatabase();
  return database.all('SELECT * FROM okrt WHERE parent_id = ? ORDER BY order_index ASC', [parentId]);
}

export async function updateOKRT(id, updateData) {
  const database = await getDatabase();
  
  // Add updated_at timestamp
  updateData.updated_at = new Date().toISOString();
  
  const updateFields = Object.keys(updateData);
  const updateValues = Object.values(updateData);
  const setClause = updateFields.map(field => `${field} = ?`).join(', ');

  await database.run(
    `UPDATE okrt SET ${setClause} WHERE id = ?`,
    [...updateValues, id]
  );
  
  return database.get('SELECT * FROM okrt WHERE id = ?', [id]);
}

export async function deleteOKRT(id) {
  const database = await getDatabase();
  return database.run('DELETE FROM okrt WHERE id = ?', [id]);
}

// Delete an OKRT and all of its descendants
export async function deleteOKRTCascade(rootId) {
  const database = await getDatabase();
  const idsToDelete = [];
  const stack = [rootId];

  while (stack.length > 0) {
    const currentId = stack.pop();
    idsToDelete.push(currentId);
    const children = await database.all('SELECT id FROM okrt WHERE parent_id = ?', [currentId]);
    for (const child of children) {
      stack.push(child.id);
    }
  }

  // Delete all collected ids in one statement
  const placeholders = idsToDelete.map(() => '?').join(', ');
  await database.run(`DELETE FROM okrt WHERE id IN (${placeholders})`, idsToDelete);
}

export async function getOKRTHierarchy(ownerId) {
  const database = await getDatabase();
  // Get all OKRTs for the user, ordered by parent-child relationship
  const allOKRTs = await database.all(`
    SELECT * FROM okrt 
    WHERE owner_id = ? 
    ORDER BY 
      CASE WHEN parent_id IS NULL THEN 0 ELSE 1 END,
      order_index ASC
  `, [ownerId]);
  
  return allOKRTs;
}
