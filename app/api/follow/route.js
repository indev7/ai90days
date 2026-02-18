import { NextResponse } from 'next/server';
import { getDatabase, get, run } from '../../../lib/pgdb';
import { getSession } from '../../../lib/auth';

export async function POST(request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { objective_id } = await request.json();
    if (!objective_id) {
      return NextResponse.json({ error: 'Objective ID is required' }, { status: 400 });
    }

    await getDatabase(); // Ensure database is initialized
    
    // Check if already following
    const existingFollow = await get(`
      SELECT id FROM follows WHERE user_id = ? AND objective_id = ?
    `, [session.sub, objective_id]);

    if (existingFollow) {
      return NextResponse.json({ error: 'Already following this objective' }, { status: 400 });
    }

    // Check if objective exists and is shared
    const objective = await get(`
      SELECT o.id, o.owner_id, s.group_or_user_id
      FROM okrt o
      JOIN share s ON o.id = s.okrt_id
      WHERE o.id = ? AND o.visibility = 'shared'
    `, [objective_id]);

    if (!objective) {
      return NextResponse.json({ error: 'Objective not found or not shared' }, { status: 404 });
    }

    // Don't allow users to follow their own objectives
    if (objective.owner_id.toString() === session.sub.toString()) {
      return NextResponse.json({ error: 'Cannot follow your own objective' }, { status: 400 });
    }

    // Check if user has access to this shared objective (either directly shared or through group membership)
    const hasAccess = await get(`
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
      SELECT 1 FROM share s
      WHERE s.okrt_id = ? AND (
        (s.share_type = 'U' AND s.group_or_user_id = ?) OR
        (s.share_type = 'G' AND s.group_or_user_id IN (
          SELECT id FROM related_groups
        ))
      )
    `, [session.sub, objective_id, session.sub]);

    if (!hasAccess) {
      return NextResponse.json({ error: 'You do not have access to this objective' }, { status: 403 });
    }

    // Create follow relationship
    const result = await run(`
      INSERT INTO follows (user_id, objective_id)
      VALUES (?, ?)
    `, [session.sub, objective_id]);

    return NextResponse.json({ 
      success: true, 
      followId: result.lastID
    });

  } catch (error) {
    console.error('Follow error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { objective_id } = await request.json();
    if (!objective_id) {
      return NextResponse.json({ error: 'Objective ID is required' }, { status: 400 });
    }

    await getDatabase(); // Ensure database is initialized
    
    // Remove follow relationship
    const result = await run(`
      DELETE FROM follows WHERE user_id = ? AND objective_id = ?
    `, [session.sub, objective_id]);

    if (result.changes === 0) {
      return NextResponse.json({ error: 'Follow relationship not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Unfollow error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
