import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { all, get } from '@/lib/pgdb';
import { getJiraAuth, jiraFetchWithRetry, parseJiraIssue } from '@/lib/jiraAuth';

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
    const { searchParams } = new URL(request.url);
    const skipInitiatives = searchParams.get('skipInitiatives') === 'true';

    // Create a readable stream for progressive loading
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Helper to send a section update
          const sendSection = (section, data, meta = null) => {
            const message = JSON.stringify({
              section,
              data,
              ...(meta ? { meta } : {}),
              _cacheUpdate: {
                action: `set${section.charAt(0).toUpperCase() + section.slice(1)}`,
                data
              }
            }) + '\n';
            controller.enqueue(encoder.encode(message));
          };

          // 0. Load user preferences first
          console.log('[Progressive] Loading preferences...');
          const preferencesRow = await get(
            `SELECT preferences, display_name, first_name, last_name, email
             FROM users
             WHERE id = ?`,
            [userId]
          );

          const defaultPreferences = {
            preferred_voice: 'alloy',
            preferred_home: 'dashboard',
            theme: 'purple'
          };

          let preferences = { ...defaultPreferences };

          if (preferencesRow?.preferences) {
            try {
              const parsed = typeof preferencesRow.preferences === 'string'
                ? JSON.parse(preferencesRow.preferences)
                : preferencesRow.preferences;

              if (parsed && typeof parsed === 'object') {
                preferences = {
                  ...defaultPreferences,
                  ...parsed
                };
              }
            } catch (e) {
              console.error('Failed to parse preferences in progressive loader', e);
              // Keep defaults if parsing fails
            }
          }

          const profileEmail = preferencesRow?.email || '';
          const profileDisplayName =
            preferencesRow?.display_name ||
            profileEmail.split('@')[0] ||
            '';

          preferences.user = {
            first_name: preferencesRow?.first_name || '',
            last_name: preferencesRow?.last_name || '',
            display_name: profileDisplayName,
            email: profileEmail
          };

          sendSection('preferences', preferences);
          console.log('[Progressive] ✅ preferences sent');

          // Preload groups so we can map shared objectives without extra queries
          console.log('[Progressive] Loading groups (preload)...');
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

          // Build lookup of shared groups per objective from the preloaded group data
          const sharedGroupsByObjective = new Map();
          groupsWithDetails.forEach((group) => {
            if (!Array.isArray(group.objectiveIds)) return;
            group.objectiveIds.forEach((objId) => {
              if (!sharedGroupsByObjective.has(objId)) {
                sharedGroupsByObjective.set(objId, []);
              }
              sharedGroupsByObjective.get(objId).push({
                id: group.id,
                name: group.name || `Group ${group.id}`
              });
            });
          });

          // 1. Load MyOKRTs
          console.log('[Progressive] Loading myOKRTs...');
          const myOKRTs = await all(`
            SELECT
              o.id, o.type, o.owner_id, o.parent_id, o.title, o.description,
              o.progress, o.status, o.area, o.cycle_qtr, o.order_index,
              o.visibility, o.objective_kind, o.kr_target_number, o.kr_unit,
              o.kr_baseline_number, o.weight, o.task_status, o.due_date,
              o.created_at, o.updated_at,
              COALESCE(u.display_name, NULLIF(CONCAT(u.first_name, ' ', u.last_name), ' '), 'You') as owner_name,
              u.first_name as owner_first_name,
              u.last_name as owner_last_name,
              u.profile_picture_url as owner_avatar
            FROM okrt o
            JOIN users u ON o.owner_id = u.id
            WHERE o.owner_id = ?
            ORDER BY CASE WHEN o.parent_id IS NULL THEN 0 ELSE 1 END, o.order_index ASC
          `, [userId]);

          const jiraLinksByOkrt = new Map();
          if (myOKRTs.length > 0) {
            const okrtIds = myOKRTs.map((okrt) => okrt.id);
            const placeholders = okrtIds.map(() => '?').join(', ');
            const jiraLinks = await all(
              `SELECT okrt_id, jira_ticket_id FROM jira_link WHERE okrt_id IN (${placeholders})`,
              okrtIds
            );
            jiraLinks.forEach((link) => {
              if (!jiraLinksByOkrt.has(link.okrt_id)) {
                jiraLinksByOkrt.set(link.okrt_id, []);
              }
              jiraLinksByOkrt.get(link.okrt_id).push(link.jira_ticket_id);
            });
          }

          // Fetch comments for objectives and attach sharing metadata
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

                return {
                  ...okrt,
                  comments,
                  shared_groups: sharedGroupsByObjective.get(okrt.id) || [],
                  jira_links: jiraLinksByOkrt.get(okrt.id) || []
                };
              }
              return {
                ...okrt,
                jira_links: jiraLinksByOkrt.get(okrt.id) || []
              };
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
              o.owner_id,
              COALESCE(u.display_name, NULLIF(CONCAT(u.first_name, ' ', u.last_name), ' ')) as owner_name,
              u.first_name as owner_first_name,
              u.last_name as owner_last_name,
              u.profile_picture_url as owner_avatar,
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

          const sharedGroupMap = new Map();
          if (sharedOKRTsRaw.length > 0) {
            const placeholders = sharedOKRTsRaw.map(() => '?').join(', ');
            const sharedGroups = await all(
              `
              SELECT s.okrt_id, g.id, g.name
              FROM share s
              JOIN groups g ON s.group_or_user_id = g.id
              WHERE s.share_type = 'G'
                AND s.okrt_id IN (${placeholders})
            `,
              sharedOKRTsRaw.map((okrt) => okrt.id)
            );

            sharedGroups.forEach((group) => {
              if (!sharedGroupMap.has(group.okrt_id)) {
                sharedGroupMap.set(group.okrt_id, []);
              }
              sharedGroupMap.get(group.okrt_id).push({
                id: group.id,
                name: group.name || `Group ${group.id}`,
              });
            });
          }

          const sharedJiraLinksByOkrt = new Map();
          if (sharedOKRTsRaw.length > 0) {
            const placeholders = sharedOKRTsRaw.map(() => '?').join(', ');
            const sharedJiraLinks = await all(
              `SELECT okrt_id, jira_ticket_id FROM jira_link WHERE okrt_id IN (${placeholders})`,
              sharedOKRTsRaw.map((okrt) => okrt.id)
            );
            sharedJiraLinks.forEach((link) => {
              if (!sharedJiraLinksByOkrt.has(link.okrt_id)) {
                sharedJiraLinksByOkrt.set(link.okrt_id, []);
              }
              sharedJiraLinksByOkrt.get(link.okrt_id).push(link.jira_ticket_id);
            });
          }

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

              // Fetch KRs (Key Results) for this objective with minimal fields for rendering
              const keyResults = await all(`
                SELECT o.id, o.parent_id, o.description, o.progress, o.due_date, o.task_status, o.order_index
                FROM okrt o
                WHERE o.parent_id = ? AND o.type = 'K'
                ORDER BY o.order_index ASC
              `, [okrt.id]);

              const krIds = keyResults.map((kr) => kr.id);
              const tasksByKr = new Map();

              if (krIds.length > 0) {
                const placeholders = krIds.map(() => '?').join(', ');
                const tasks = await all(
                  `
                  SELECT t.id, t.parent_id, t.title, t.description, t.progress, t.due_date, t.task_status, t.order_index
                  FROM okrt t
                  WHERE t.parent_id IN (${placeholders}) AND t.type = 'T'
                  ORDER BY t.order_index ASC
                `,
                  krIds
                );

                tasks.forEach((task) => {
                  const existing = tasksByKr.get(task.parent_id) || [];
                  existing.push({
                    id: task.id,
                    parent_id: task.parent_id,
                    title: task.title,
                    description: task.description,
                    progress: Math.round(task.progress || 0),
                    due_date: task.due_date,
                    task_status: task.task_status,
                    order_index: task.order_index,
                  });
                  tasksByKr.set(task.parent_id, existing);
                });
              }

              const krs = keyResults.map((kr) => ({
                id: kr.id,
                parent_id: kr.parent_id,
                description: kr.description,
                progress: Math.round(kr.progress || 0),
                due_date: kr.due_date,
                task_status: kr.task_status,
                order_index: kr.order_index,
                tasks: tasksByKr.get(kr.id) || [],
              }));

              return {
                ...okrt,
                comments,
                keyResults: krs,
                shared_groups: sharedGroupMap.get(okrt.id) || [],
                jira_links: sharedJiraLinksByOkrt.get(okrt.id) || [],
              };
            })
          );
          
          sendSection('sharedOKRTs', sharedOKRTs);
          console.log('[Progressive] ✅ sharedOKRTs sent');

          // 5. Load Groups (send preloaded data)
          console.log('[Progressive] Sending groups...');
          sendSection('groups', groupsWithDetails);
          console.log('[Progressive] ✅ groups sent');

          // 6. Load Initiatives from Jira (if authenticated)
          if (!skipInitiatives) {
            console.log('[Progressive] Loading initiatives from Jira...');
            const jiraAuth = await getJiraAuth();

            if (!jiraAuth?.isAuthenticated) {
              sendSection('initiatives', [], { unavailable: true });
              console.log('[Progressive] ⚠️ Jira not authenticated, initiatives unavailable');
            } else {
              try {
                const JQL = 'project = PM AND issuetype = "Initiative"';
                const fields = [
                  'summary',
                  'status',
                  'priority',
                  'duedate',
                  'customfield_11331'
                ];
                const initiatives = [];
                let startAt = 0;
                let nextPageToken = null;
                let hasMore = true;
                const maxResults = 100;
                const maxTotal = 300;

                while (hasMore && initiatives.length < maxTotal) {
                  const params = new URLSearchParams({
                    jql: JQL,
                    fields: fields.join(','),
                    maxResults: String(maxResults)
                  });
                  if (nextPageToken) {
                    params.set('nextPageToken', nextPageToken);
                  } else {
                    params.set('startAt', String(startAt));
                  }

                  const response = await jiraFetchWithRetry(`/rest/api/3/search/jql?${params.toString()}`);
                  const data = await response.json();
                  const issues = Array.isArray(data?.issues) ? data.issues : [];
                  const parsed = issues
                    .map((issue) => parseJiraIssue(issue))
                    .filter((issue) => issue);

                  initiatives.push(...parsed);

                  const total = Number.isFinite(data?.total) ? data.total : null;
                  nextPageToken = data?.nextPageToken || null;
                  startAt += issues.length;
                  hasMore =
                    issues.length > 0 &&
                    (Boolean(nextPageToken) || total == null || startAt < total);
                }

                const deduped = [];
                const seenKeys = new Set();
                for (const issue of initiatives) {
                  const key = issue?.key;
                  if (!key || seenKeys.has(key)) continue;
                  seenKeys.add(key);
                  deduped.push(issue);
                }

                sendSection('initiatives', deduped.slice(0, maxTotal));
                console.log('[Progressive] ✅ initiatives sent');
              } catch (error) {
                console.error('[Progressive] Failed to load initiatives from Jira:', error?.message || error);
                sendSection('initiatives', [], { unavailable: true });
              }
            }
          }

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
