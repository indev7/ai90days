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
    
    // Check if we need to migrate to Phase 6 schema (Groups and Sharing)
    try {
      await db.get('SELECT id FROM groups LIMIT 1');
    } catch (migrationError) {
      // Groups table doesn't exist, run migration
      console.log('Migrating database to Phase 6 schema...');
      const migrationPath = join(process.cwd(), 'Phase1', 'DB', 'migrate-to-phase6.sql');
      const migration = readFileSync(migrationPath, 'utf8');
      await db.exec(migration);
      console.log('Phase 6 database migration completed!');
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
    weight = 1.0, task_status, due_date, recurrence_json, blocked_by
  } = okrtData;

  const result = await database.run(`
    INSERT INTO okrt (
      id, type, owner_id, parent_id, title, description, progress, status,
      area, cycle_qtr, order_index, visibility, objective_kind,
      kr_target_number, kr_unit, kr_baseline_number, weight,
      task_status, due_date, recurrence_json, blocked_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id, type, owner_id, parent_id, title, description, progress, status,
    area, cycle_qtr, order_index, visibility, objective_kind,
    kr_target_number, kr_unit, kr_baseline_number, weight,
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

// Groups database functions
export async function createGroup(groupData) {
  const database = await getDatabase();
  const { id, name, type, parent_group_id, thumbnail_url } = groupData;

  const result = await database.run(`
    INSERT INTO groups (id, name, type, parent_group_id, thumbnail_url)
    VALUES (?, ?, ?, ?, ?)
  `, [id, name, type, parent_group_id, thumbnail_url]);

  return database.get('SELECT * FROM groups WHERE id = ?', [id]);
}

export async function getGroupById(id) {
  const database = await getDatabase();
  return database.get('SELECT * FROM groups WHERE id = ?', [id]);
}

export async function getAllGroups() {
  const database = await getDatabase();
  return database.all('SELECT * FROM groups ORDER BY name ASC');
}

export async function getGroupsByParent(parentId) {
  const database = await getDatabase();
  return database.all('SELECT * FROM groups WHERE parent_group_id = ? ORDER BY name ASC', [parentId]);
}

export async function getRootGroups() {
  const database = await getDatabase();
  return database.all('SELECT * FROM groups WHERE parent_group_id IS NULL ORDER BY name ASC');
}

export async function updateGroup(id, updateData) {
  const database = await getDatabase();
  
  updateData.updated_at = new Date().toISOString();
  
  const updateFields = Object.keys(updateData);
  const updateValues = Object.values(updateData);
  const setClause = updateFields.map(field => `${field} = ?`).join(', ');

  await database.run(
    `UPDATE groups SET ${setClause} WHERE id = ?`,
    [...updateValues, id]
  );
  
  return database.get('SELECT * FROM groups WHERE id = ?', [id]);
}

export async function deleteGroup(id) {
  const database = await getDatabase();
  return database.run('DELETE FROM groups WHERE id = ?', [id]);
}

// User-Group relationship functions
export async function addUserToGroup(userId, groupId, isAdmin = false) {
  const database = await getDatabase();
  return database.run(`
    INSERT OR REPLACE INTO user_group (user_id, group_id, is_admin)
    VALUES (?, ?, ?)
  `, [userId, groupId, isAdmin]);
}

export async function removeUserFromGroup(userId, groupId) {
  const database = await getDatabase();
  return database.run('DELETE FROM user_group WHERE user_id = ? AND group_id = ?', [userId, groupId]);
}

export async function getUserGroups(userId) {
  const database = await getDatabase();
  return database.all(`
    SELECT g.*, ug.is_admin
    FROM groups g
    JOIN user_group ug ON g.id = ug.group_id
    WHERE ug.user_id = ?
    ORDER BY g.name ASC
  `, [userId]);
}

export async function getGroupMembers(groupId) {
  const database = await getDatabase();
  return database.all(`
    SELECT u.id, u.display_name, u.email, u.first_name, u.last_name, u.profile_picture_url, ug.is_admin
    FROM users u
    JOIN user_group ug ON u.id = ug.user_id
    WHERE ug.group_id = ?
    ORDER BY ug.is_admin DESC, u.display_name ASC
  `, [groupId]);
}

export async function isUserGroupAdmin(userId, groupId) {
  const database = await getDatabase();
  const result = await database.get(`
    SELECT is_admin FROM user_group
    WHERE user_id = ? AND group_id = ?
  `, [userId, groupId]);
  return result?.is_admin || false;
}

// Sharing functions
export async function shareOKRTWithGroup(okrtId, groupId) {
  const database = await getDatabase();
  return database.run(`
    INSERT OR REPLACE INTO share (okrt_id, group_or_user_id, share_type)
    VALUES (?, ?, 'G')
  `, [okrtId, groupId]);
}

export async function shareOKRTWithUser(okrtId, userId) {
  const database = await getDatabase();
  return database.run(`
    INSERT OR REPLACE INTO share (okrt_id, group_or_user_id, share_type)
    VALUES (?, ?, 'U')
  `, [okrtId, userId]);
}

export async function unshareOKRT(okrtId, groupOrUserId, shareType) {
  const database = await getDatabase();
  return database.run(`
    DELETE FROM share
    WHERE okrt_id = ? AND group_or_user_id = ? AND share_type = ?
  `, [okrtId, groupOrUserId, shareType]);
}

export async function getOKRTShares(okrtId) {
  const database = await getDatabase();
  return database.all('SELECT * FROM share WHERE okrt_id = ?', [okrtId]);
}

export async function getSharedOKRTsForUser(userId) {
  const database = await getDatabase();
  // Get OKRTs shared directly with user or with groups user belongs to
  return database.all(`
    SELECT DISTINCT o.*, u.display_name as owner_name
    FROM okrt o
    JOIN users u ON o.owner_id = u.id
    JOIN share s ON o.id = s.okrt_id
    WHERE (
      (s.share_type = 'U' AND s.group_or_user_id = ?)
      OR
      (s.share_type = 'G' AND s.group_or_user_id IN (
        SELECT group_id FROM user_group WHERE user_id = ?
      ))
    )
    AND o.visibility = 'shared'
    ORDER BY o.updated_at DESC
  `, [userId, userId]);
}

export async function getGroupSharedOKRTCount(groupId) {
  const database = await getDatabase();
  const result = await database.get(`
    SELECT COUNT(*) as count
    FROM share s
    JOIN okrt o ON s.okrt_id = o.id
    WHERE s.group_or_user_id = ? AND s.share_type = 'G' AND o.visibility = 'shared'
  `, [groupId]);
  return result?.count || 0;
}

export async function getGroupSharedOKRTs(groupId) {
  const database = await getDatabase();
  return database.all(`
    SELECT o.*, u.display_name as owner_name
    FROM okrt o
    JOIN users u ON o.owner_id = u.id
    JOIN share s ON o.id = s.okrt_id
    WHERE s.group_or_user_id = ? AND s.share_type = 'G' AND o.visibility = 'shared'
    ORDER BY o.updated_at DESC
  `, [groupId]);
}
