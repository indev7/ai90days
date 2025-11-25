import { all, get } from './pgdb.js';

/**
 * Fetch calendar events from Microsoft Graph API for current quarter
 */
async function fetchCalendarEvents(userId) {
  try {
    console.log(`[MainTreeLoader] Fetching calendar events for user ${userId}`);
    
    // Get user's Microsoft access token
    const user = await get(`
      SELECT microsoft_access_token, microsoft_refresh_token, microsoft_token_expires_at
      FROM users
      WHERE id = ?
    `, [userId]);

    if (!user || !user.microsoft_access_token) {
      console.log('[MainTreeLoader] No Microsoft account linked, skipping calendar fetch');
      return [];
    }

    // Check if token is expired and refresh if needed
    let accessToken = user.microsoft_access_token;
    const now = Date.now();
    const expiresAt = user.microsoft_token_expires_at ? new Date(user.microsoft_token_expires_at).getTime() : 0;

    if (expiresAt <= now && user.microsoft_refresh_token) {
      console.log('[MainTreeLoader] Access token expired, refreshing...');
      
      const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: process.env.MICROSOFT_CLIENT_ID,
          client_secret: process.env.MICROSOFT_CLIENT_SECRET,
          refresh_token: user.microsoft_refresh_token,
          grant_type: 'refresh_token',
          scope: 'openid profile email User.Read Calendars.Read offline_access',
        }),
      });

      if (!tokenResponse.ok) {
        console.error('[MainTreeLoader] Failed to refresh token');
        return [];
      }

      const tokenData = await tokenResponse.json();
      accessToken = tokenData.access_token;

      // Update tokens in database
      const { run } = await import('./pgdb.js');
      const newExpiresAt = new Date(now + tokenData.expires_in * 1000).toISOString();
      await run(`
        UPDATE users
        SET microsoft_access_token = ?,
            microsoft_refresh_token = ?,
            microsoft_token_expires_at = ?
        WHERE id = ?
      `, [tokenData.access_token, tokenData.refresh_token || user.microsoft_refresh_token, newExpiresAt, userId]);
    }

    // Calculate date range for current quarter
    const now_date = new Date();
    const currentMonth = now_date.getMonth();
    const currentYear = now_date.getFullYear();
    const quarterStartMonth = Math.floor(currentMonth / 3) * 3;
    
    const startDate = new Date(currentYear, quarterStartMonth, 1);
    const endDate = new Date(currentYear, quarterStartMonth + 3, 0, 23, 59, 59);

    const startDateTime = startDate.toISOString();
    const endDateTime = endDate.toISOString();

    console.log(`[MainTreeLoader] 🗓️  Fetching Microsoft Calendar events from ${startDateTime} to ${endDateTime}`);

    // Fetch calendar events from Microsoft Graph API
    // Request events in the user's timezone (Asia/Colombo for Sri Lanka)
    const calendarResponse = await fetch(
      `https://graph.microsoft.com/v1.0/me/calendarview?startDateTime=${startDateTime}&endDateTime=${endDateTime}&$select=subject,start,end&$orderby=start/dateTime&$top=100`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Prefer': 'outlook.timezone="Asia/Colombo"',
        },
      }
    );

    if (!calendarResponse.ok) {
      console.error('[MainTreeLoader] Failed to fetch calendar events:', calendarResponse.status);
      return [];
    }

    const calendarData = await calendarResponse.json();
    console.log(`[MainTreeLoader] ✅ Successfully fetched ${calendarData.value?.length || 0} calendar events from Microsoft Graph API`);

    // Transform the data to only include title, start time, and end time
    const events = calendarData.value.map(event => ({
      title: event.subject,
      startTime: event.start.dateTime,
      endTime: event.end.dateTime,
      timeZone: event.start.timeZone || 'UTC',
    }));

    return events;
  } catch (error) {
    console.error('[MainTreeLoader] Error fetching calendar events:', error);
    return [];
  }
}

/**
 * Load calendar events separately (for background refresh)
 */
export async function loadCalendarForUser(userId) {
  try {
    const calendarEvents = await fetchCalendarEvents(userId);
    
    const now_date = new Date();
    const currentMonth = now_date.getMonth();
    const currentYear = now_date.getFullYear();
    const quarterStartMonth = Math.floor(currentMonth / 3) * 3;
    
    return {
      events: calendarEvents,
      quarter: {
        start: new Date(currentYear, quarterStartMonth, 1).toISOString(),
        end: new Date(currentYear, quarterStartMonth + 3, 0, 23, 59, 59).toISOString()
      }
    };
  } catch (error) {
    console.error('Error loading calendar for user:', userId, error);
    return {
      events: [],
      quarter: null
    };
  }
}

/**
 * Fetch and populate the mainTree for a specific user
 * This function loads all necessary data from the database in an optimized way
 *
 * @param {number} userId - The user ID to fetch data for
 * @param {Object} options - Loading options
 * @param {boolean} options.includeCalendar - Whether to include calendar events (default: false for progressive loading)
 * @returns {Promise<Object>} The populated mainTree object
 */
export async function loadMainTreeForUser(userId, options = {}) {
  const { includeCalendar = false } = options;
  
  try {
    // Fetch calendar events from Microsoft (optional - can be loaded separately)
    const calendarData = includeCalendar ? await loadCalendarForUser(userId) : {
      events: [],
      quarter: {
        start: new Date(new Date().getFullYear(), Math.floor(new Date().getMonth() / 3) * 3, 1).toISOString(),
        end: new Date(new Date().getFullYear(), Math.floor(new Date().getMonth() / 3) * 3 + 3, 0, 23, 59, 59).toISOString()
      }
    };
    
    // Fetch myOKRTs - lazy load only fields needed for My OKRs page
    const myOKRTs = await all(`
      SELECT
        o.id,
        o.type,
        o.owner_id,
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

    // For each objective (type='O'), fetch its comments
    const myOKRTsWithComments = await Promise.all(
      myOKRTs.map(async (okrt) => {
        if (okrt.type === 'O') {
          // Fetch comments for this objective
          const comments = await all(`
            SELECT
              c.id,
              c.comment,
              c.parent_comment_id,
              c.type,
              c.count,
              c.sending_user,
              c.receiving_user,
              c.okrt_id,
              c.created_at,
              c.updated_at,
              su.display_name as sender_name,
              su.first_name as sender_first_name,
              su.last_name as sender_last_name,
              su.profile_picture_url as sender_avatar,
              ru.display_name as receiver_name,
              ru.first_name as receiver_first_name,
              ru.last_name as receiver_last_name,
              ru.profile_picture_url as receiver_avatar
            FROM comments c
            JOIN users su ON c.sending_user = su.id
            JOIN users ru ON c.receiving_user = ru.id
            WHERE c.okrt_id = ?
            ORDER BY c.created_at ASC
          `, [okrt.id]);
          
          return {
            ...okrt,
            comments: comments
          };
        }
        return okrt;
      })
    );

    // Fetch sharedOKRTs - OKRTs shared with this user (same fields as myOKRTs)
    const sharedOKRTsRaw = await all(`
      SELECT DISTINCT ON (o.id)
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
        CASE WHEN f.id IS NOT NULL THEN TRUE ELSE FALSE END as is_following
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
        o.id,
        CASE WHEN f.id IS NOT NULL THEN 0 ELSE 1 END,
        o.updated_at DESC
    `, [userId, userId, userId]);

    // For each shared objective (type='O'), fetch its comments
    const sharedOKRTs = await Promise.all(
      sharedOKRTsRaw.map(async (okrt) => {
        if (okrt.type === 'O') {
          // Fetch comments for this objective
          const comments = await all(`
            SELECT
              c.id,
              c.comment,
              c.parent_comment_id,
              c.type,
              c.count,
              c.sending_user,
              c.receiving_user,
              c.okrt_id,
              c.created_at,
              c.updated_at,
              su.display_name as sender_name,
              su.first_name as sender_first_name,
              su.last_name as sender_last_name,
              su.profile_picture_url as sender_avatar,
              ru.display_name as receiver_name,
              ru.first_name as receiver_first_name,
              ru.last_name as receiver_last_name,
              ru.profile_picture_url as receiver_avatar
            FROM comments c
            JOIN users su ON c.sending_user = su.id
            JOIN users ru ON c.receiving_user = ru.id
            WHERE c.okrt_id = ?
            ORDER BY c.created_at ASC
          `, [okrt.id]);
          
          return {
            ...okrt,
            comments: comments
          };
        }
        return okrt;
      })
    );

    // Fetch notifications - lazy load only fields needed for notifications widget and page
    // Convert created_at to ISO string to preserve UTC timezone info
    const notifications = await all(`
      SELECT
        n.id,
        n.type,
        n.title,
        n.message,
        n.is_read,
        to_char(n.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as created_at,
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
    const timeBlocks = await all(`
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

    // Fetch ALL groups (not just groups where user is a member)
    const allGroups = await all(`
      SELECT
        g.id,
        g.name,
        g.type,
        g.parent_group_id,
        g.thumbnail_url,
        g.vision,
        g.mission,
        g.created_at,
        g.updated_at
      FROM groups g
      ORDER BY g.name ASC
    `);

    // Get user's group memberships
    const userMemberships = await all(`
      SELECT
        group_id,
        is_admin
      FROM user_group
      WHERE user_id = ?
    `, [userId]);

    // Create a map of user's memberships for quick lookup
    const membershipMap = new Map();
    userMemberships.forEach(membership => {
      membershipMap.set(membership.group_id, {
        is_member: true,
        is_admin: membership.is_admin
      });
    });

    // For each group, fetch members and conditionally fetch shared objectives
    const groupsWithDetails = await Promise.all(
      allGroups.map(async (group) => {
        const membership = membershipMap.get(group.id) || { is_member: false, is_admin: false };
        
        // Fetch group members
        const members = await all(`
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

        // Only fetch objective IDs if user is a member of this group
        let objectiveIds = [];
        let strategicObjectiveIds = [];
        
        if (membership.is_member) {
          const objectiveIdsResult = await all(`
            SELECT DISTINCT s.okrt_id, o.updated_at
            FROM share s
            JOIN okrt o ON s.okrt_id = o.id
            WHERE s.group_or_user_id = ?
              AND s.share_type = 'G'
              AND o.visibility = 'shared'
            ORDER BY o.updated_at DESC
          `, [group.id]);
          objectiveIds = objectiveIdsResult.map(obj => obj.okrt_id);
          
          // Fetch strategic objectives for this group
          const strategicObjectivesResult = await all(`
            SELECT so.okrt_id
            FROM strategic_objectives so
            WHERE so.group_id = ?
            ORDER BY so.created_at ASC
          `, [group.id]);
          strategicObjectiveIds = strategicObjectivesResult.map(obj => obj.okrt_id);
        }

        return {
          ...group,
          is_member: membership.is_member,
          is_admin: membership.is_admin,
          members: members,
          objectiveIds: objectiveIds,
          strategicObjectiveIds: strategicObjectiveIds
        };
      })
    );

    // Construct the mainTree with calendar node
    const mainTree = {
      myOKRTs: myOKRTsWithComments,
      sharedOKRTs: sharedOKRTs,
      calendar: calendarData,
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
  const mainTree = await loadMainTreeForUser(userId, { includeCalendar: true });
  return JSON.stringify(mainTree, null, 2);
}