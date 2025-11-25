import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { all, get } from '@/lib/pgdb';

/**
 * GET /api/main-tree/progressive
 * Fetch mainTree sections progressively with streaming responses
 * Each section is sent as soon as it's ready
 */
export async function GET(request) {
  try {
    // Verify authentication
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = user.id;

    // Create a readable stream for progressive loading
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Helper to send a section update
          const sendSection = (section, data) => {
            const message = JSON.stringify({
              section,
              data,
              _cacheUpdate: {
                action: `set${section.charAt(0).toUpperCase() + section.slice(1)}`,
                data
              }
            }) + '\n';
            controller.enqueue(encoder.encode(message));
          };

          // 1. Load MyOKRTs first
          console.log('[Progressive] Loading myOKRTs...');
          const myOKRTs = await all(`
            SELECT
              o.id, o.type, o.owner_id, o.parent_id, o.title, o.description,
              o.progress, o.status, o.area, o.cycle_qtr, o.order_index,
              o.visibility, o.objective_kind, o.kr_target_number, o.kr_unit,
              o.kr_baseline_number, o.weight, o.task_status, o.due_date,
              o.created_at, o.updated_at
            FROM okrt o
            WHERE o.owner_id = ?
            ORDER BY CASE WHEN o.parent_id IS NULL THEN 0 ELSE 1 END, o.order_index ASC
          `, [userId]);

          // Fetch comments for objectives
          const myOKRTsWithComments = await Promise.all(
            myOKRTs.map(async (okrt) => {
              if (okrt.type === 'O') {
                const comments = await all(`
                  SELECT c.id, c.comment, c.parent_comment_id, c.type, c.count,
                         c.sending_user, c.receiving_user, c.okrt_id,
                         c.created_at, c.updated_at,
                         su.display_name as sender_name, su.first_name as sender_first_name,
                         su.last_name as sender_last_name, su.profile_picture_url as sender_avatar,
                         ru.display_name as receiver_name, ru.first_name as receiver_first_name,
                         ru.last_name as receiver_last_name, ru.profile_picture_url as receiver_avatar
                  FROM comments c
                  JOIN users su ON c.sending_user = su.id
                  JOIN users ru ON c.receiving_user = ru.id
                  WHERE c.okrt_id = ?
                  ORDER BY c.created_at ASC
                `, [okrt.id]);
                return { ...okrt, comments };
              }
              return okrt;
            })
          );
          
          sendSection('myOKRTs', myOKRTsWithComments);
          console.log('[Progressive] ✅ myOKRTs sent');

          // 2. Load TimeBlocks
          console.log('[Progressive] Loading timeBlocks...');
          const timeBlocks = await all(`
            SELECT tb.id, tb.task_id, tb.user_id, tb.start_time, tb.duration,
                   tb.objective_id, tb.created_at, tb.updated_at,
                   t.title as task_title, t.description as task_description,
                   t.task_status, t.progress as task_progress,
                   o.title as objective_title, o.area as objective_area
            FROM time_blocks tb
            JOIN okrt t ON tb.task_id = t.id
            LEFT JOIN okrt o ON tb.objective_id = o.id
            WHERE tb.user_id = ?
            ORDER BY tb.start_time ASC
          `, [userId]);
          
          sendSection('timeBlocks', timeBlocks);
          console.log('[Progressive] ✅ timeBlocks sent');

          // 3. Load Notifications
          console.log('[Progressive] Loading notifications...');
          const notifications = await all(`
            SELECT n.id, n.type, n.title, n.message, n.is_read,
                   to_char(n.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as created_at,
                   n.related_okrt_id, n.related_group_id, n.related_user_id,
                   u.display_name as related_user_name, u.first_name as related_user_first_name,
                   u.last_name as related_user_last_name,
                   o.title as related_okrt_title, g.name as related_group_name
            FROM notifications n
            LEFT JOIN users u ON n.related_user_id = u.id
            LEFT JOIN okrt o ON n.related_okrt_id = o.id
            LEFT JOIN groups g ON n.related_group_id = g.id
            WHERE n.user_id = ?
            ORDER BY n.created_at DESC
            LIMIT 50
          `, [userId]);
          
          sendSection('notifications', notifications);
          console.log('[Progressive] ✅ notifications sent');

          // 4. Load SharedOKRTs - Only Objectives, with KRs nested inside
          console.log('[Progressive] Loading sharedOKRTs...');
          const sharedOKRTsRaw = await all(`
            SELECT DISTINCT ON (o.id)
              o.id, o.type, o.parent_id, o.title, o.description,
              o.progress, o.status, o.area, o.cycle_qtr, o.order_index, o.visibility,
              o.objective_kind, o.kr_target_number, o.kr_unit, o.kr_baseline_number,
              o.weight, o.task_status, o.due_date, o.created_at, o.updated_at,
              o.owner_id, u.display_name as owner_name, u.first_name as owner_first_name,
              u.last_name as owner_last_name,
              CASE WHEN f.id IS NOT NULL THEN TRUE ELSE FALSE END as is_following
            FROM okrt o
            JOIN users u ON o.owner_id = u.id
            JOIN share s ON o.id = s.okrt_id
            LEFT JOIN follows f ON o.id = f.objective_id AND f.user_id = ?
            WHERE ((s.share_type = 'U' AND s.group_or_user_id = ?)
                   OR (s.share_type = 'G' AND s.group_or_user_id IN (
                     SELECT group_id FROM user_group WHERE user_id = ?
                   )))
              AND o.visibility = 'shared'
              AND o.type = 'O'
            ORDER BY o.id, CASE WHEN f.id IS NOT NULL THEN 0 ELSE 1 END, o.updated_at DESC
          `, [userId, userId, userId]);

          const sharedOKRTs = await Promise.all(
            sharedOKRTsRaw.map(async (okrt) => {
              // Fetch comments for this objective
              const comments = await all(`
                SELECT c.id, c.comment, c.parent_comment_id, c.type, c.count,
                       c.sending_user, c.receiving_user, c.okrt_id,
                       c.created_at, c.updated_at,
                       su.display_name as sender_name, su.first_name as sender_first_name,
                       su.last_name as sender_last_name, su.profile_picture_url as sender_avatar,
                       ru.display_name as receiver_name, ru.first_name as receiver_first_name,
                       ru.last_name as receiver_last_name, ru.profile_picture_url as receiver_avatar
                FROM comments c
                JOIN users su ON c.sending_user = su.id
                JOIN users ru ON c.receiving_user = ru.id
                WHERE c.okrt_id = ?
                ORDER BY c.created_at ASC
              `, [okrt.id]);
              
              // Fetch KRs (Key Results) for this objective
              const keyResults = await all(`
                SELECT o.id, o.description, o.progress
                FROM okrt o
                WHERE o.parent_id = ? AND o.type = 'K'
                ORDER BY o.order_index ASC
              `, [okrt.id]);
              
              // Transform KRs to simple array with only description and progress
              const krs = keyResults.map(kr => ({
                description: kr.description,
                progress: Math.round(kr.progress || 0)
              }));
              
              return {
                ...okrt,
                comments,
                keyResults: krs
              };
            })
          );
          
          sendSection('sharedOKRTs', sharedOKRTs);
          console.log('[Progressive] ✅ sharedOKRTs sent');

          // 5. Load Groups
          console.log('[Progressive] Loading groups...');
          const allGroups = await all(`
            SELECT g.id, g.name, g.type, g.parent_group_id, g.thumbnail_url,
                   g.vision, g.mission, g.created_at, g.updated_at
            FROM groups g
            ORDER BY g.name ASC
          `);

          const userMemberships = await all(`
            SELECT group_id, is_admin
            FROM user_group
            WHERE user_id = ?
          `, [userId]);

          const membershipMap = new Map();
          userMemberships.forEach(membership => {
            membershipMap.set(membership.group_id, {
              is_member: true,
              is_admin: membership.is_admin
            });
          });

          const groupsWithDetails = await Promise.all(
            allGroups.map(async (group) => {
              const membership = membershipMap.get(group.id) || { is_member: false, is_admin: false };
              
              const members = await all(`
                SELECT u.id, u.display_name, u.email, u.first_name, u.last_name,
                       u.profile_picture_url, ug.is_admin
                FROM users u
                JOIN user_group ug ON u.id = ug.user_id
                WHERE ug.group_id = ?
                ORDER BY ug.is_admin DESC, u.display_name ASC
              `, [group.id]);

              let objectiveIds = [];
              let strategicObjectiveIds = [];
              
              if (membership.is_member) {
                const objectiveIdsResult = await all(`
                  SELECT DISTINCT s.okrt_id, o.updated_at
                  FROM share s
                  JOIN okrt o ON s.okrt_id = o.id
                  WHERE s.group_or_user_id = ? AND s.share_type = 'G' AND o.visibility = 'shared'
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
                members,
                objectiveIds,
                strategicObjectiveIds
              };
            })
          );
          
          sendSection('groups', groupsWithDetails);
          console.log('[Progressive] ✅ groups sent');

          // Signal completion
          controller.enqueue(encoder.encode(JSON.stringify({ complete: true }) + '\n'));
          controller.close();
          
        } catch (error) {
          console.error('[Progressive] Error:', error);
          controller.error(error);
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
    
  } catch (error) {
    console.error('Error in progressive loading:', error);
    return NextResponse.json(
      { error: 'Failed to load mainTree progressively' },
      { status: 500 }
    );
  }
}