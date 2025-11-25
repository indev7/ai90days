import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

let pool = null;

// PostgreSQL connection configuration
// Uses DATABASE_URL from environment variables (e.g., from .env.local)
const dbConfig = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL }
  : {
      host: process.env.POSTGRES_HOST || 'localhost',
      port: process.env.POSTGRES_PORT || 5432,
      database: process.env.POSTGRES_DB || 'ampcode',
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || '',
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    };

export async function getDatabase() {
  if (pool) return pool;

  pool = new Pool(dbConfig);

  // Set timezone to UTC for all connections
  pool.on('connect', (client) => {
    client.query('SET timezone = "UTC"');
  });

  // Test connection and initialize schema if needed
  try {
    const client = await pool.connect();
    
    try {
      // Check if users table exists
      const tableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'users'
        );
      `);
      
      if (!tableCheck.rows[0].exists) {
        console.log('Initializing database schema...');
        const schemaPath = join(process.cwd(), 'Phase1', 'PGDB', 'schema.sql');
        const schema = readFileSync(schemaPath, 'utf8');
        await client.query(schema);
        console.log('Database schema initialized successfully!');
      }
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }

  return pool;
}

// Helper function to convert positional parameters (?, ?, ?) to PostgreSQL format ($1, $2, $3)
function convertParams(sql) {
  let index = 1;
  return sql.replace(/\?/g, () => `$${index++}`);
}

// Helper wrapper for queries that mimics SQLite's db.get()
async function get(sql, params = []) {
  const db = await getDatabase();
  const convertedSql = convertParams(sql);
  const result = await db.query(convertedSql, params);
  return result.rows[0] || null;
}

// Helper wrapper for queries that mimics SQLite's db.all()
async function all(sql, params = []) {
  const db = await getDatabase();
  const convertedSql = convertParams(sql);
  const result = await db.query(convertedSql, params);
  return result.rows;
}

// Helper wrapper for queries that mimics SQLite's db.run()
async function run(sql, params = []) {
  const db = await getDatabase();
  const convertedSql = convertParams(sql);
  const result = await db.query(convertedSql, params);
  return {
    lastID: result.rows[0]?.id || null,
    changes: result.rowCount
  };
}

// Export the helper functions for direct use
export { get, all, run };

export async function getUserByEmail(email) {
  return get('SELECT * FROM users WHERE email = ?', [email]);
}

export async function getUserByUsername(username) {
  return get('SELECT * FROM users WHERE LOWER(username) = LOWER(?)', [username]);
}

export async function createUser({ email, password_hash, display_name, role = 'User' }) {
  const username = email; // Use email as username for Phase 1
  
  const result = await get(
    'INSERT INTO users (username, password_hash, display_name, email, role) VALUES (?, ?, ?, ?, ?) RETURNING *',
    [username, password_hash, display_name, email, role]
  );
  
  return result;
}

export async function updateUser(userId, updateData) {
  const updateFields = Object.keys(updateData);
  const updateValues = Object.values(updateData);
  const setClause = updateFields.map((field, idx) => `${field} = $${idx + 1}`).join(', ');

  await run(
    `UPDATE users SET ${setClause} WHERE id = $${updateFields.length + 1}`,
    [...updateValues, userId]
  );
  
  return get('SELECT * FROM users WHERE id = ?', [userId]);
}

export async function getUserByMicrosoftId(microsoftId) {
  return get('SELECT * FROM users WHERE microsoft_id = ?', [microsoftId]);
}

// OKRT database functions
export async function createOKRT(okrtData) {
  let {
    id, type, owner_id, parent_id, title, description, progress = 0,
    status = 'D', area, cycle_qtr, order_index = 0, visibility = 'private',
    objective_kind, kr_target_number, kr_unit, kr_baseline_number,
    weight = 1.0, task_status, due_date, recurrence_json, blocked_by
  } = okrtData;

  // Convert empty strings to null for date fields (PostgreSQL requirement)
  if (due_date === '') due_date = null;
  
  // Convert empty strings to null for optional text fields
  if (area === '') area = null;
  if (cycle_qtr === '') cycle_qtr = null;
  if (kr_unit === '') kr_unit = null;
  if (recurrence_json === '') recurrence_json = null;
  if (blocked_by === '') blocked_by = null;

  const result = await get(`
    INSERT INTO okrt (
      id, type, owner_id, parent_id, title, description, progress, status,
      area, cycle_qtr, order_index, visibility, objective_kind,
      kr_target_number, kr_unit, kr_baseline_number, weight,
      task_status, due_date, recurrence_json, blocked_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING *
  `, [
    id, type, owner_id, parent_id, title, description, progress, status,
    area, cycle_qtr, order_index, visibility, objective_kind,
    kr_target_number, kr_unit, kr_baseline_number, weight,
    task_status, due_date, recurrence_json, blocked_by
  ]);

  return result;
}

export async function getOKRTById(id) {
  return get('SELECT * FROM okrt WHERE id = ?', [id]);
}

export async function getOKRTsByOwner(ownerId) {
  return all('SELECT * FROM okrt WHERE owner_id = ? ORDER BY order_index ASC', [ownerId]);
}

export async function getOKRTsByParent(parentId) {
  return all('SELECT * FROM okrt WHERE parent_id = ? ORDER BY order_index ASC', [parentId]);
}

export async function updateOKRT(id, updateData) {
  // Add updated_at timestamp
  updateData.updated_at = new Date().toISOString();
  
  // Convert empty strings to null for date fields (PostgreSQL requirement)
  if (updateData.due_date === '') {
    updateData.due_date = null;
  }
  
  // Convert empty strings to null for optional text fields that might be confused with dates
  const optionalFields = ['area', 'cycle_qtr', 'kr_unit', 'recurrence_json', 'blocked_by', 'header_image_url'];
  optionalFields.forEach(field => {
    if (updateData[field] === '') {
      updateData[field] = null;
    }
  });
  
  const updateFields = Object.keys(updateData);
  const updateValues = Object.values(updateData);
  const setClause = updateFields.map((field, idx) => `${field} = $${idx + 1}`).join(', ');

  await run(
    `UPDATE okrt SET ${setClause} WHERE id = $${updateFields.length + 1}`,
    [...updateValues, id]
  );
  
  return get('SELECT * FROM okrt WHERE id = ?', [id]);
}

export async function deleteOKRT(id) {
  return run('DELETE FROM okrt WHERE id = ?', [id]);
}

// Delete an OKRT and all of its descendants
export async function deleteOKRTCascade(rootId) {
  const idsToDelete = [];
  const stack = [rootId];

  while (stack.length > 0) {
    const currentId = stack.pop();
    idsToDelete.push(currentId);
    const children = await all('SELECT id FROM okrt WHERE parent_id = ?', [currentId]);
    for (const child of children) {
      stack.push(child.id);
    }
  }

  // Delete all collected ids in one statement
  const placeholders = idsToDelete.map((_, idx) => `$${idx + 1}`).join(', ');
  await run(`DELETE FROM okrt WHERE id IN (${placeholders})`, idsToDelete);
}

export async function getOKRTHierarchy(ownerId) {
  // Get all OKRTs for the user, ordered by parent-child relationship
  const allOKRTs = await all(`
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
  let { id, name, type, parent_group_id, thumbnail_url, vision, mission } = groupData;

  // Convert empty strings to null for optional fields (PostgreSQL requirement)
  if (parent_group_id === '') parent_group_id = null;
  if (thumbnail_url === '') thumbnail_url = null;
  if (vision === '') vision = null;
  if (mission === '') mission = null;

  const result = await get(`
    INSERT INTO groups (id, name, type, parent_group_id, thumbnail_url, vision, mission)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    RETURNING *
  `, [id, name, type, parent_group_id, thumbnail_url, vision, mission]);

  return result;
}

export async function getGroupById(id) {
  return get('SELECT * FROM groups WHERE id = ?', [id]);
}

export async function getAllGroups() {
  return all('SELECT * FROM groups ORDER BY name ASC');
}

export async function getGroupsByParent(parentId) {
  return all('SELECT * FROM groups WHERE parent_group_id = ? ORDER BY name ASC', [parentId]);
}

export async function getRootGroups() {
  return all('SELECT * FROM groups WHERE parent_group_id IS NULL ORDER BY name ASC');
}

export async function updateGroup(id, updateData) {
  updateData.updated_at = new Date().toISOString();
  
  // Convert empty strings to null for optional fields (PostgreSQL requirement)
  if (updateData.parent_group_id === '') {
    updateData.parent_group_id = null;
  }
  if (updateData.thumbnail_url === '') {
    updateData.thumbnail_url = null;
  }
  if (updateData.vision === '') {
    updateData.vision = null;
  }
  if (updateData.mission === '') {
    updateData.mission = null;
  }
  
  const updateFields = Object.keys(updateData);
  const updateValues = Object.values(updateData);
  const setClause = updateFields.map((field, idx) => `${field} = $${idx + 1}`).join(', ');

  await run(
    `UPDATE groups SET ${setClause} WHERE id = $${updateFields.length + 1}`,
    [...updateValues, id]
  );
  
  return get('SELECT * FROM groups WHERE id = ?', [id]);
}

export async function deleteGroup(id) {
  return run('DELETE FROM groups WHERE id = ?', [id]);
}

// User-Group relationship functions
export async function addUserToGroup(userId, groupId, isAdmin = false) {
  return run(`
    INSERT INTO user_group (user_id, group_id, is_admin)
    VALUES (?, ?, ?)
    ON CONFLICT (user_id, group_id) DO UPDATE SET is_admin = EXCLUDED.is_admin
  `, [userId, groupId, isAdmin]);
}

export async function removeUserFromGroup(userId, groupId) {
  return run('DELETE FROM user_group WHERE user_id = ? AND group_id = ?', [userId, groupId]);
}

export async function getUserGroups(userId) {
  return all(`
    SELECT g.*, ug.is_admin
    FROM groups g
    JOIN user_group ug ON g.id = ug.group_id
    WHERE ug.user_id = ?
    ORDER BY g.name ASC
  `, [userId]);
}

export async function getUserAdminGroups(userId) {
  return all(`
    SELECT g.*
    FROM groups g
    JOIN user_group ug ON g.id = ug.group_id
    WHERE ug.user_id = ? AND ug.is_admin = TRUE
    ORDER BY g.name ASC
  `, [userId]);
}

export async function getGroupMembers(groupId) {
  return all(`
    SELECT u.id, u.display_name, u.email, u.first_name, u.last_name, u.profile_picture_url, ug.is_admin
    FROM users u
    JOIN user_group ug ON u.id = ug.user_id
    WHERE ug.group_id = ?
    ORDER BY ug.is_admin DESC, u.display_name ASC
  `, [groupId]);
}

export async function isUserGroupAdmin(userId, groupId) {
  const result = await get(`
    SELECT is_admin FROM user_group
    WHERE user_id = ? AND group_id = ?
  `, [userId, groupId]);
  return result?.is_admin || false;
}

// Sharing functions
export async function shareOKRTWithGroup(okrtId, groupId) {
  return run(`
    INSERT INTO share (okrt_id, group_or_user_id, share_type)
    VALUES (?, ?, 'G')
    ON CONFLICT (okrt_id, group_or_user_id, share_type) DO NOTHING
  `, [okrtId, groupId]);
}

export async function shareOKRTWithUser(okrtId, userId) {
  return run(`
    INSERT INTO share (okrt_id, group_or_user_id, share_type)
    VALUES (?, ?, 'U')
    ON CONFLICT (okrt_id, group_or_user_id, share_type) DO NOTHING
  `, [okrtId, userId.toString()]);
}

export async function unshareOKRT(okrtId, groupOrUserId, shareType) {
  return run(`
    DELETE FROM share
    WHERE okrt_id = ? AND group_or_user_id = ? AND share_type = ?
  `, [okrtId, groupOrUserId, shareType]);
}

export async function getOKRTShares(okrtId) {
  return all('SELECT * FROM share WHERE okrt_id = ?', [okrtId]);
}

export async function getSharedOKRTsForUser(userId) {
  // Get OKRTs shared directly with user or with groups user belongs to, including follow status
  return all(`
    SELECT DISTINCT o.*, u.display_name as owner_name,
           CASE WHEN f.id IS NOT NULL THEN TRUE ELSE FALSE END as is_following,
           o.updated_at,
           CASE WHEN f.id IS NOT NULL THEN 0 ELSE 1 END as follow_order
    FROM okrt o
    JOIN users u ON o.owner_id = u.id
    JOIN share s ON o.id = s.okrt_id
    LEFT JOIN follows f ON o.id = f.objective_id AND f.user_id = ?
    WHERE (
      (s.share_type = 'U' AND s.group_or_user_id = ?::text)
      OR
      (s.share_type = 'G' AND s.group_or_user_id IN (
        SELECT group_id FROM user_group WHERE user_id = ?
      ))
    )
    AND o.visibility = 'shared'
    ORDER BY
      follow_order,
      o.updated_at DESC
  `, [userId, userId, userId]);
}

export async function getGroupSharedOKRTCount(groupId) {
  const result = await get(`
    SELECT COUNT(*) as count
    FROM share s
    JOIN okrt o ON s.okrt_id = o.id
    WHERE s.group_or_user_id = ? AND s.share_type = 'G' AND o.visibility = 'shared'
  `, [groupId]);
  return result?.count || 0;
}

export async function getGroupSharedOKRTs(groupId) {
  return all(`
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
  let {
    user_id, type, title, message, related_okrt_id, related_group_id, related_user_id
  } = notificationData;

  // Convert empty strings to null for optional fields (PostgreSQL requirement)
  if (related_okrt_id === '') related_okrt_id = null;
  if (related_group_id === '') related_group_id = null;
  if (related_user_id === '') related_user_id = null;

  const result = await get(`
    INSERT INTO notifications (
      user_id, type, title, message, related_okrt_id, related_group_id, related_user_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    RETURNING *
  `, [user_id, type, title, message, related_okrt_id, related_group_id, related_user_id]);

  return result;
}

export async function getNotificationsByUser(userId, limit = 50) {
  return all(`
    SELECT n.id,
           n.user_id,
           n.type,
           n.title,
           n.message,
           n.related_okrt_id,
           n.related_group_id,
           n.related_user_id,
           n.is_read,
           to_char(n.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as created_at,
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
  const result = await get(`
    SELECT COUNT(*) as count
    FROM notifications
    WHERE user_id = ? AND is_read = FALSE
  `, [userId]);
  return result?.count || 0;
}

export async function markNotificationAsRead(notificationId, userId) {
  return run(`
    UPDATE notifications
    SET is_read = TRUE
    WHERE id = ? AND user_id = ?
  `, [notificationId, userId]);
}

export async function markAllNotificationsAsRead(userId) {
  return run(`
    UPDATE notifications
    SET is_read = TRUE
    WHERE user_id = ? AND is_read = FALSE
  `, [userId]);
}

export async function deleteNotification(notificationId, userId) {
  return run(`
    DELETE FROM notifications
    WHERE id = ? AND user_id = ?
  `, [notificationId, userId]);
}

// Follow functions
export async function getOKRTFollowers(okrtId) {
  return all(`
    SELECT f.user_id, u.display_name
    FROM follows f
    JOIN users u ON f.user_id = u.id
    WHERE f.objective_id = ?
  `, [okrtId]);
}

export async function getUserById(userId) {
  return get('SELECT * FROM users WHERE id = ?', [userId]);
}

export async function searchUsers(query, limit = 10) {
  return all(`
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
  let {
    comment, parent_comment_id, type = 'text', count = 1,
    sending_user, receiving_user, okrt_id
  } = commentData;

  // Convert empty strings to null for optional fields (PostgreSQL requirement)
  if (comment === '') comment = null;
  if (parent_comment_id === '') parent_comment_id = null;

  const result = await get(`
    INSERT INTO comments (
      comment, parent_comment_id, type, count, sending_user, receiving_user, okrt_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    RETURNING *
  `, [comment, parent_comment_id, type, count, sending_user, receiving_user, okrt_id]);

  return result;
}

export async function getCommentsByOKRT(okrtId) {
  return all(`
    SELECT c.*,
           su.display_name as sender_name, su.profile_picture_url as sender_avatar,
           ru.display_name as receiver_name, ru.profile_picture_url as receiver_avatar
    FROM comments c
    JOIN users su ON c.sending_user = su.id
    JOIN users ru ON c.receiving_user = ru.id
    WHERE c.okrt_id = ?
    ORDER BY c.created_at DESC
  `, [okrtId]);
}

export async function getCommentById(commentId) {
  return get(`
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
  updateData.updated_at = new Date().toISOString();
  
  // Convert empty strings to null for optional fields (PostgreSQL requirement)
  if (updateData.comment === '') {
    updateData.comment = null;
  }
  if (updateData.parent_comment_id === '') {
    updateData.parent_comment_id = null;
  }
  
  const updateFields = Object.keys(updateData);
  const updateValues = Object.values(updateData);
  const setClause = updateFields.map((field, idx) => `${field} = $${idx + 1}`).join(', ');

  await run(
    `UPDATE comments SET ${setClause} WHERE id = $${updateFields.length + 1}`,
    [...updateValues, commentId]
  );
  
  return get('SELECT * FROM comments WHERE id = ?', [commentId]);
}

export async function deleteComment(commentId) {
  return run('DELETE FROM comments WHERE id = ?', [commentId]);
}

export async function getCommentsByUser(userId, type = 'sent') {
  const userField = type === 'sent' ? 'sending_user' : 'receiving_user';
  
  return all(`
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
  return all(`
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
  let {
    task_id, user_id, start_time, duration, objective_id
  } = timeBlockData;

  // Convert empty strings to null for optional fields (PostgreSQL requirement)
  if (objective_id === '') objective_id = null;

  const result = await get(
    'INSERT INTO time_blocks (task_id, user_id, start_time, duration, objective_id) VALUES (?, ?, ?, ?, ?) RETURNING *',
    [task_id, user_id, start_time, duration, objective_id]
  );

  return result;
}

export async function getTimeBlocksByUserAndDate(userId, date) {
  // Get time blocks for a specific date (all day)
  const startOfDay = `${date}T00:00:00`;
  const endOfDay = `${date}T23:59:59`;
  
  return all(`
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
  return get('SELECT * FROM time_blocks WHERE id = ?', [id]);
}

export async function updateTimeBlock(id, updateData) {
  // Convert empty strings to null for optional fields (PostgreSQL requirement)
  if (updateData.objective_id === '') {
    updateData.objective_id = null;
  }
  
  const updateFields = Object.keys(updateData);
  const updateValues = Object.values(updateData);
  const setClause = updateFields.map((field, idx) => `${field} = $${idx + 1}`).join(', ');
  
  await run(
    `UPDATE time_blocks SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = $${updateFields.length + 1}`,
    [...updateValues, id]
  );
  
  return get('SELECT * FROM time_blocks WHERE id = ?', [id]);
}

export async function deleteTimeBlock(id) {
  return run('DELETE FROM time_blocks WHERE id = ?', [id]);
}

export async function getTimeBlocksByUser(userId) {
  return all(`
    SELECT tb.*, o.title as task_title, o.description as task_description, o.status as task_status
    FROM time_blocks tb
    JOIN okrt o ON tb.task_id = o.id
    WHERE tb.user_id = ?
    ORDER BY tb.start_time ASC
  `, [userId]);
}

export async function getRewardSummaryForOKRT(okrtId) {
  return all(`
    SELECT type, SUM(count) as total_count
    FROM comments
    WHERE okrt_id = ? AND type IN ('medal', 'star', 'cookie')
    GROUP BY type
  `, [okrtId]);
}

// Cleanup function to close the pool
export async function closeDatabase() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}