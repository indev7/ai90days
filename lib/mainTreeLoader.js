import { getDatabase } from './db.js';

/**
 * Fetch and populate the mainTree for a specific user
 * This function loads all necessary data from the database in an optimized way
 * 
 * @param {number} userId - The user ID to fetch data for
 * @returns {Promise<Object>} The populated mainTree object
 */
export async function loadMainTreeForUser(userId) {
  const db = await getDatabase();
  
  try {
    // Fetch myOKRTs - lazy load only fields needed for My OKRs page
    const myOKRTs = await db.all(`
      SELECT 
        o.id,
        o.type,
        o.parent_id,
        o.title,
        o.description,
        o.progress,
        o.status,
        o.area,
        o.cycle_qtr,
        o.order_index,
        o.visibility,
        o.objective_kind,
        o.kr_target_number,
        o.kr_unit,
        o.kr_baseline_number,
        o.weight,
        o.task_status,
        o.due_date,
        o.created_at,
        o.updated_at
      FROM okrt o
      WHERE o.owner_id = ?
      ORDER BY 
        CASE WHEN o.parent_id IS NULL THEN 0 ELSE 1 END,
        o.order_index ASC
    `, [userId]);

    // Fetch sharedOKRTs - OKRTs shared with this user (same fields as myOKRTs)
    const sharedOKRTs = await db.all(`
      SELECT DISTINCT
        o.id,
        o.type,
        o.parent_id,
        o.title,
        o.description,
        o.progress,
        o.status,
        o.area,
        o.cycle_qtr,
        o.order_index,
        o.visibility,
        o.objective_kind,
        o.kr_target_number,
        o.kr_unit,
        o.kr_baseline_number,
        o.weight,
        o.task_status,
        o.due_date,
        o.created_at,
        o.updated_at,
        o.owner_id,
        u.display_name as owner_name,
        u.first_name as owner_first_name,
        u.last_name as owner_last_name,
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

    // Fetch notifications - lazy load only fields needed for notifications widget and page
    const notifications = await db.all(`
      SELECT 
        n.id,
        n.type,
        n.title,
        n.message,
        n.is_read,
        n.created_at,
        n.related_okrt_id,
        n.related_group_id,
        n.related_user_id,
        u.display_name as related_user_name,
        u.first_name as related_user_first_name,
        u.last_name as related_user_last_name,
        o.title as related_okrt_title,
        g.name as related_group_name
      FROM notifications n
      LEFT JOIN users u ON n.related_user_id = u.id
      LEFT JOIN okrt o ON n.related_okrt_id = o.id
      LEFT JOIN groups g ON n.related_group_id = g.id
      WHERE n.user_id = ?
      ORDER BY n.created_at DESC
      LIMIT 50
    `, [userId]);

    // Fetch timeBlocks - all fields needed for Calendar and Dashboard clock
    const timeBlocks = await db.all(`
      SELECT 
        tb.id,
        tb.task_id,
        tb.user_id,
        tb.start_time,
        tb.duration,
        tb.objective_id,
        tb.created_at,
        tb.updated_at,
        t.title as task_title,
        t.description as task_description,
        t.task_status,
        t.progress as task_progress,
        o.title as objective_title,
        o.area as objective_area
      FROM time_blocks tb
      JOIN okrt t ON tb.task_id = t.id
      LEFT JOIN okrt o ON tb.objective_id = o.id
      WHERE tb.user_id = ?
      ORDER BY tb.start_time ASC
    `, [userId]);

    // Fetch groups with members and objectives
    const groups = await db.all(`
      SELECT 
        g.id,
        g.name,
        g.type,
        g.parent_group_id,
        g.thumbnail_url,
        g.created_at,
        g.updated_at,
        ug.is_admin
      FROM groups g
      JOIN user_group ug ON g.id = ug.group_id
      WHERE ug.user_id = ?
      ORDER BY g.name ASC
    `, [userId]);

    // For each group, fetch members and shared objectives
    const groupsWithDetails = await Promise.all(
      groups.map(async (group) => {
        // Fetch group members
        const members = await db.all(`
          SELECT 
            u.id,
            u.display_name,
            u.email,
            u.first_name,
            u.last_name,
            u.profile_picture_url,
            ug.is_admin
          FROM users u
          JOIN user_group ug ON u.id = ug.user_id
          WHERE ug.group_id = ?
          ORDER BY ug.is_admin DESC, u.display_name ASC
        `, [group.id]);

        // Fetch objective IDs shared with this group
        const objectiveIds = await db.all(`
          SELECT DISTINCT s.okrt_id
          FROM share s
          JOIN okrt o ON s.okrt_id = o.id
          WHERE s.group_or_user_id = ? 
            AND s.share_type = 'G' 
            AND o.visibility = 'shared'
          ORDER BY o.updated_at DESC
        `, [group.id]);

        return {
          ...group,
          members: members,
          objectiveIds: objectiveIds.map(obj => obj.okrt_id)
        };
      })
    );

    // Construct the mainTree
    const mainTree = {
      myOKRTs: myOKRTs,
      sharedOKRTs: sharedOKRTs,
      notifications: notifications,
      timeBlocks: timeBlocks,
      groups: groupsWithDetails
    };

    return mainTree;
  } catch (error) {
    console.error('Error loading mainTree for user:', userId, error);
    throw error;
  }
}

/**
 * Export mainTree as JSON for a specific user
 * Useful for debugging and documentation
 * 
 * @param {number} userId - The user ID to export data for
 * @returns {Promise<string>} JSON string of the mainTree
 */
export async function exportMainTreeAsJSON(userId) {
  const mainTree = await loadMainTreeForUser(userId);
  return JSON.stringify(mainTree, null, 2);
}