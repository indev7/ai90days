import { NextResponse } from 'next/server';
import { getDatabase } from '../../../lib/db';
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

    const db = await getDatabase();
    
    // Check if already following
    const existingFollow = await db.get(`
      SELECT id FROM follows WHERE user_id = ? AND objective_id = ?
    `, [session.sub, objective_id]);

    if (existingFollow) {
      return NextResponse.json({ error: 'Already following this objective' }, { status: 400 });
    }

    // Check if objective exists and is shared
    const objective = await db.get(`
      SELECT o.id, o.owner_id, s.group_or_user_id
      FROM okrt o
      JOIN share s ON o.id = s.okrt_id
      WHERE o.id = ? AND o.visibility = 'shared'
    `, [objective_id]);

    if (!objective) {
      return NextResponse.json({ error: 'Objective not found or not shared' }, { status: 404 });
    }

    // Don't allow users to follow their own objectives
    if (objective.owner_id === session.sub) {
      return NextResponse.json({ error: 'Cannot follow your own objective' }, { status: 400 });
    }

    // Check if user has access to this shared objective (either directly shared or through group membership)
    const hasAccess = await db.get(`
      SELECT 1 FROM share s
      WHERE s.okrt_id = ? AND (
        (s.share_type = 'U' AND s.group_or_user_id = ?) OR
        (s.share_type = 'G' AND s.group_or_user_id IN (
          SELECT group_id FROM user_group WHERE user_id = ?
        ))
      )
    `, [objective_id, session.sub, session.sub]);

    if (!hasAccess) {
      return NextResponse.json({ error: 'You do not have access to this objective' }, { status: 403 });
    }

    // Create follow relationship
    const result = await db.run(`
      INSERT INTO follows (user_id, objective_id)
      VALUES (?, ?)
    `, [session.sub, objective_id]);

    return NextResponse.json({ 
      success: true, 
      followId: result.lastInsertRowid 
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

    const db = await getDatabase();
    
    // Remove follow relationship
    const result = await db.run(`
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