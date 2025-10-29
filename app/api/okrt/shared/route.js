import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDatabase, getUserById, getOKRTShares, getGroupById } from '@/lib/pgdb';

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

    const db = await getDatabase();
    const userId = session.sub;

    // Check if user has access to this shared objective
    // User has access if:
    // 1. The objective is shared with them directly (share_type = 'U')
    // 2. The objective is shared with a group they belong to (share_type = 'G')
    // 3. The objective visibility is not 'private'
    const accessQuery = `
      SELECT DISTINCT o.*
      FROM okrt o
      LEFT JOIN share s ON o.id = s.okrt_id
      LEFT JOIN user_group ug ON s.group_or_user_id = ug.group_id AND s.share_type = 'G'
      WHERE o.id = ?
        AND o.visibility = 'shared'
        AND (
          -- Direct share to user
          (s.group_or_user_id = ? AND s.share_type = 'U')
          OR
          -- Share to group where user is member
          (s.share_type = 'G' AND ug.user_id = ?)
        )
    `;

    const objective = await db.get(accessQuery, [objectiveId, userId.toString(), userId]);
    
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

    const keyResults = await db.all(keyResultsQuery, [objectiveId]);
    const tasks = await db.all(tasksQuery, [objectiveId]);

    // Combine into the expected format
    const allItems = [enhancedObjective, ...keyResults, ...tasks];

    return NextResponse.json({ okrts: allItems });
  } catch (error) {
    console.error('Error fetching shared objective:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
