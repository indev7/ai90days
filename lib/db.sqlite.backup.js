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
    
    // Check if we need to migrate to Phase 7 schema (Follow functionality)
    try {
      await db.get('SELECT id FROM follows LIMIT 1');
    } catch (migrationError) {
      // Follows table doesn't exist, run migration
      console.log('Migrating database to Phase 7 schema...');
      const migrationPath = join(process.cwd(), 'Phase1', 'DB', 'migrate-to-phase7.sql');
      const migration = readFileSync(migrationPath, 'utf8');
      await db.exec(migration);
      console.log('Phase 7 database migration completed!');
    }
    
    // Check if we need to migrate to Phase 8 schema (Notifications)
    try {
      await db.get('SELECT id FROM notifications LIMIT 1');
    } catch (migrationError) {
      // Notifications table doesn't exist, run migration
      console.log('Migrating database to Phase 8 schema...');
      const migrationPath = join(process.cwd(), 'Phase1', 'DB', 'migrate-to-phase8.sql');
      const migration = readFileSync(migrationPath, 'utf8');
      await db.exec(migration);
      console.log('Phase 8 database migration completed!');
    }
    
    // Check if we need to migrate to Phase 9 schema (Comments)
    try {
      await db.get('SELECT id FROM comments LIMIT 1');
    } catch (migrationError) {
      // Comments table doesn't exist, run migration
      console.log('Migrating database to Phase 9 schema...');
      const migrationPath = join(process.cwd(), 'Phase1', 'DB', 'migrate-to-phase9.sql');
      const migration = readFileSync(migrationPath, 'utf8');
      await db.exec(migration);
      console.log('Phase 9 database migration completed!');
    }
    
    // Check if we need to migrate to Phase 11 schema (Time Blocks)
    try {
      await db.get('SELECT id FROM time_blocks LIMIT 1');
    } catch (migrationError) {
      // Time blocks table doesn't exist, run migration
      console.log('Migrating database to Phase 11 schema...');
      const migrationPath = join(process.cwd(), 'Phase1', 'DB', 'migrate-to-phase11.sql');
      const migration = readFileSync(migrationPath, 'utf8');
      await db.exec(migration);
      console.log('Phase 11 database migration completed!');
    }
    
    // Check if we need to migrate to Phase 14 schema (User Preferences)
    try {
      await db.get('SELECT preferences FROM users LIMIT 1');
    } catch (migrationError) {
      // Preferences column doesn't exist, run migration
      console.log('Migrating database to Phase 14 schema...');
      const migrationPath = join(process.cwd(), 'Phase1', 'DB', 'migrate-to-phase14.sql');
      const migration = readFileSync(migrationPath, 'utf8');
      await db.exec(migration);
      console.log('Phase 14 database migration completed!');
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

export async function getUserAdminGroups(userId) {
  const database = await getDatabase();
  return database.all(`
    SELECT g.*
    FROM groups g
    JOIN user_group ug ON g.id = ug.group_id
    WHERE ug.user_id = ? AND ug.is_admin = 1
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
  // Get OKRTs shared directly with user or with groups user belongs to, including follow status
  return database.all(`
    SELECT DISTINCT o.*, u.display_name as owner_name,
           CASE WHEN f.id IS NOT NULL THEN 1 ELSE 0 END as is_following
    FROM okrt o
    JOIN users u ON o.owner_id = u.id
    JOIN share s ON o.id = s.okrt_id
    LEFT JOIN follows f ON o.id = f.objective_id AND f.user_id = ?
    WHERE (
      (s.share_type = 'U' AND s.group_or_user_id = ?)
      OR
      (s.share_type = 'G' AND s.group_or_user_id IN (
        SELECT group_id FROM user_group WHERE user_id = ?
      ))
    )
    AND o.visibility = 'shared'
    ORDER BY
      CASE WHEN f.id IS NOT NULL THEN 0 ELSE 1 END,
      o.updated_at DESC
  `, [userId, userId, userId]);
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

// Notifications database functions
export async function createNotification(notificationData) {
  const database = await getDatabase();
  const {
    user_id, type, title, message, related_okrt_id, related_group_id, related_user_id
  } = notificationData;

  const result = await database.run(`
    INSERT INTO notifications (
      user_id, type, title, message, related_okrt_id, related_group_id, related_user_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [user_id, type, title, message, related_okrt_id, related_group_id, related_user_id]);

  return database.get('SELECT * FROM notifications WHERE id = ?', [result.lastID]);
}

export async function getNotificationsByUser(userId, limit = 50) {
  const database = await getDatabase();
  return database.all(`
    SELECT n.*,
           u.display_name as related_user_name,
           o.title as related_okrt_title,
           g.name as related_group_name
    FROM notifications n
    LEFT JOIN users u ON n.related_user_id = u.id
    LEFT JOIN okrt o ON n.related_okrt_id = o.id
    LEFT JOIN groups g ON n.related_group_id = g.id
    WHERE n.user_id = ?
    ORDER BY n.created_at DESC
    LIMIT ?
  `, [userId, limit]);
}

export async function getUnreadNotificationCount(userId) {
  const database = await getDatabase();
  const result = await database.get(`
    SELECT COUNT(*) as count
    FROM notifications
    WHERE user_id = ? AND is_read = FALSE
  `, [userId]);
  return result?.count || 0;
}

export async function markNotificationAsRead(notificationId, userId) {
  const database = await getDatabase();
  return database.run(`
    UPDATE notifications
    SET is_read = TRUE
    WHERE id = ? AND user_id = ?
  `, [notificationId, userId]);
}

export async function markAllNotificationsAsRead(userId) {
  const database = await getDatabase();
  return database.run(`
    UPDATE notifications
    SET is_read = TRUE
    WHERE user_id = ? AND is_read = FALSE
  `, [userId]);
}

export async function deleteNotification(notificationId, userId) {
  const database = await getDatabase();
  return database.run(`
    DELETE FROM notifications
    WHERE id = ? AND user_id = ?
  `, [notificationId, userId]);
}

// Follow functions
export async function getOKRTFollowers(okrtId) {
  const database = await getDatabase();
  return database.all(`
    SELECT f.user_id, u.display_name
    FROM follows f
    JOIN users u ON f.user_id = u.id
    WHERE f.objective_id = ?
  `, [okrtId]);
}

export async function getUserById(userId) {
  const database = await getDatabase();
  return database.get('SELECT * FROM users WHERE id = ?', [userId]);
}

export async function searchUsers(query, limit = 10) {
  const database = await getDatabase();
  return database.all(`
    SELECT id, display_name, email, first_name, last_name, profile_picture_url
    FROM users
    WHERE (
      LOWER(display_name) LIKE LOWER(?) OR
      LOWER(email) LIKE LOWER(?) OR
      LOWER(first_name) LIKE LOWER(?) OR
      LOWER(last_name) LIKE LOWER(?)
    )
    ORDER BY display_name ASC
    LIMIT ?
  `, [`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`, limit]);
}

// Comments database functions
export async function createComment(commentData) {
  const database = await getDatabase();
  const {
    comment, parent_comment_id, type = 'text', count = 1,
    sending_user, receiving_user, okrt_id
  } = commentData;

  const result = await database.run(`
    INSERT INTO comments (
      comment, parent_comment_id, type, count, sending_user, receiving_user, okrt_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [comment, parent_comment_id, type, count, sending_user, receiving_user, okrt_id]);

  return database.get('SELECT * FROM comments WHERE id = ?', [result.lastID]);
}

export async function getCommentsByOKRT(okrtId) {
  const database = await getDatabase();
  return database.all(`
    SELECT c.*,
           su.display_name as sender_name, su.profile_picture_url as sender_avatar,
           ru.display_name as receiver_name, ru.profile_picture_url as receiver_avatar
    FROM comments c
    JOIN users su ON c.sending_user = su.id
    JOIN users ru ON c.receiving_user = ru.id
    WHERE c.okrt_id = ?
    ORDER BY c.created_at ASC
  `, [okrtId]);
}

export async function getCommentById(commentId) {
  const database = await getDatabase();
  return database.get(`
    SELECT c.*,
           su.display_name as sender_name, su.profile_picture_url as sender_avatar,
           ru.display_name as receiver_name, ru.profile_picture_url as receiver_avatar
    FROM comments c
    JOIN users su ON c.sending_user = su.id
    JOIN users ru ON c.receiving_user = ru.id
    WHERE c.id = ?
  `, [commentId]);
}

export async function updateComment(commentId, updateData) {
  const database = await getDatabase();
  
  updateData.updated_at = new Date().toISOString();
  
  const updateFields = Object.keys(updateData);
  const updateValues = Object.values(updateData);
  const setClause = updateFields.map(field => `${field} = ?`).join(', ');

  await database.run(
    `UPDATE comments SET ${setClause} WHERE id = ?`,
    [...updateValues, commentId]
  );
  
  return database.get('SELECT * FROM comments WHERE id = ?', [commentId]);
}

export async function deleteComment(commentId) {
  const database = await getDatabase();
  return database.run('DELETE FROM comments WHERE id = ?', [commentId]);
}

export async function getCommentsByUser(userId, type = 'sent') {
  const database = await getDatabase();
  const userField = type === 'sent' ? 'sending_user' : 'receiving_user';
  
  return database.all(`
    SELECT c.*,
           su.display_name as sender_name, su.profile_picture_url as sender_avatar,
           ru.display_name as receiver_name, ru.profile_picture_url as receiver_avatar,
           o.title as okrt_title
    FROM comments c
    JOIN users su ON c.sending_user = su.id
    JOIN users ru ON c.receiving_user = ru.id
    JOIN okrt o ON c.okrt_id = o.id
    WHERE c.${userField} = ?
    ORDER BY c.created_at DESC
  `, [userId]);
}

export async function getReplies(parentCommentId) {
  const database = await getDatabase();
  return database.all(`
    SELECT c.*,
           su.display_name as sender_name, su.profile_picture_url as sender_avatar,
           ru.display_name as receiver_name, ru.profile_picture_url as receiver_avatar
    FROM comments c
    JOIN users su ON c.sending_user = su.id
    JOIN users ru ON c.receiving_user = ru.id
    WHERE c.parent_comment_id = ?
    ORDER BY c.created_at ASC
  `, [parentCommentId]);
}

// Time Blocks functions for Phase 11
export async function createTimeBlock(timeBlockData) {
  const database = await getDatabase();
  const {
    task_id, user_id, start_time, duration, objective_id
  } = timeBlockData;

  const result = await database.run(
    'INSERT INTO time_blocks (task_id, user_id, start_time, duration, objective_id) VALUES (?, ?, ?, ?, ?)',
    [task_id, user_id, start_time, duration, objective_id]
  );

  return database.get('SELECT * FROM time_blocks WHERE id = ?', [result.lastID]);
}

export async function getTimeBlocksByUserAndDate(userId, date) {
  const database = await getDatabase();
  // Get time blocks for a specific date (all day)
  const startOfDay = `${date}T00:00:00`;
  const endOfDay = `${date}T23:59:59`;
  
  return database.all(`
    SELECT tb.*, 
           task.title as task_title, 
           task.description as task_description, 
           task.status as task_status
    FROM time_blocks tb
    JOIN okrt task ON tb.task_id = task.id
    WHERE tb.user_id = ? AND tb.start_time >= ? AND tb.start_time <= ?
    ORDER BY tb.start_time ASC
  `, [userId, startOfDay, endOfDay]);
}

export async function getTimeBlockById(id) {
  const database = await getDatabase();
  return database.get('SELECT * FROM time_blocks WHERE id = ?', [id]);
}

export async function updateTimeBlock(id, updateData) {
  const database = await getDatabase();
  
  const updateFields = Object.keys(updateData);
  const updateValues = Object.values(updateData);
  const setClause = updateFields.map(field => `${field} = ?`).join(', ');
  
  await database.run(
    `UPDATE time_blocks SET ${setClause}, updated_at = datetime('now') WHERE id = ?`,
    [...updateValues, id]
  );
  
  return database.get('SELECT * FROM time_blocks WHERE id = ?', [id]);
}

export async function deleteTimeBlock(id) {
  const database = await getDatabase();
  return database.run('DELETE FROM time_blocks WHERE id = ?', [id]);
}

export async function getTimeBlocksByUser(userId) {
  const database = await getDatabase();
  return database.all(`
    SELECT tb.*, o.title as task_title, o.description as task_description, o.status as task_status
    FROM time_blocks tb
    JOIN okrt o ON tb.task_id = o.id
    WHERE tb.user_id = ?
    ORDER BY tb.start_time ASC
  `, [userId]);
}

export async function getRewardSummaryForOKRT(okrtId) {
  const database = await getDatabase();
  return database.all(`
    SELECT type, SUM(count) as total_count
    FROM comments
    WHERE okrt_id = ? AND type IN ('medal', 'star', 'cookie')
    GROUP BY type
  `, [okrtId]);
}
