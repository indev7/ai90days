import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDatabase, get, all, getUserById, getOKRTShares, getGroupById } from '@/lib/pgdb';

export async function GET(request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const objectiveId = searchParams.get('id');
    
    if (!objectiveId) {
      return NextResponse.json({ error: 'Objective ID is required' }, { status: 400 });
    }

    await getDatabase(); // Ensure database is initialized
    const userId = session.sub;

    // Check if user has access to this shared objective
    // User has access if:
    // 1. The objective is shared with them directly (share_type = 'U')
    // 2. The objective is shared with a group in their ancestor/descendant chain (share_type = 'G')
    // 3. The objective visibility is not 'private'
    const accessQuery = `
      WITH RECURSIVE user_groups AS (
        SELECT group_id
        FROM user_group
        WHERE user_id = ?
      ),
      ancestor_groups AS (
        SELECT g.id, g.parent_group_id
        FROM groups g
        JOIN user_groups ug ON g.id = ug.group_id
        UNION
        SELECT g2.id, g2.parent_group_id
        FROM groups g2
        JOIN ancestor_groups ag ON g2.id = ag.parent_group_id
      ),
      descendant_groups AS (
        SELECT g.id, g.parent_group_id
        FROM groups g
        JOIN user_groups ug ON g.id = ug.group_id
        UNION
        SELECT g2.id, g2.parent_group_id
        FROM groups g2
        JOIN descendant_groups dg ON g2.parent_group_id = dg.id
      ),
      related_groups AS (
        SELECT id FROM ancestor_groups
        UNION
        SELECT id FROM descendant_groups
      )
      SELECT DISTINCT o.*
      FROM okrt o
      LEFT JOIN share s ON o.id = s.okrt_id
      WHERE o.id = ?
        AND o.visibility = 'shared'
        AND (
          -- Direct share to user
          (s.group_or_user_id = ? AND s.share_type = 'U')
          OR
          -- Share to group in user's ancestor/descendant chain
          (s.share_type = 'G' AND s.group_or_user_id IN (
            SELECT id FROM related_groups
          ))
        )
    `;

    const objective = await get(accessQuery, [userId, objectiveId, userId.toString()]);
    
    if (!objective) {
      return NextResponse.json({ error: 'Objective not found or access denied' }, { status: 404 });
    }

    // Enhance objective with owner and sharing information
    const owner = await getUserById(objective.owner_id);
    const shares = await getOKRTShares(objective.id);
    const groupShares = shares.filter(share => share.share_type === 'G');
    
    // Get group details for each group share
    const sharedGroups = await Promise.all(
      groupShares.map(async (share) => {
        try {
          const group = await getGroupById(share.group_or_user_id);
          return group;
        } catch (error) {
          console.error(`Error fetching group ${share.group_or_user_id}:`, error);
          return null;
        }
      })
    );
    
    const enhancedObjective = {
      ...objective,
      owner_name: owner ? `${owner.first_name || ''} ${owner.last_name || ''}`.trim() || owner.display_name : 'Unknown',
      shared_groups: sharedGroups.filter(group => group !== null && group.name)
    };

    // Get all key results and tasks for this objective
    const keyResultsQuery = `
      SELECT * FROM okrt
      WHERE parent_id = ? AND type = 'K'
      ORDER BY created_at ASC
    `;
    
    const tasksQuery = `
      SELECT * FROM okrt
      WHERE parent_id IN (
        SELECT id FROM okrt WHERE parent_id = ? AND type = 'K'
      ) AND type = 'T'
      ORDER BY created_at ASC
    `;

    const keyResults = await all(keyResultsQuery, [objectiveId]);
    const tasks = await all(tasksQuery, [objectiveId]);

    // Combine into the expected format
    const allItems = [enhancedObjective, ...keyResults, ...tasks];

    return NextResponse.json({ okrts: allItems });
  } catch (error) {
    console.error('Error fetching shared objective:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
