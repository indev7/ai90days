import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { all } from '@/lib/pgdb';

// GET /api/objectives/search - Search for objectives by title
export async function GET(request) {
  try {
    const session = await getSession();
    if (!session?.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    if (!query || query.trim().length < 2) {
      return NextResponse.json({ objectives: [] });
    }

    // Search for objectives (type 'O') that match the query
    // Include owner information for display
    const objectives = await all(`
      SELECT 
        o.id,
        o.title,
        o.owner_id,
        o.visibility,
        o.objective_kind,
        o.cycle_qtr,
        u.display_name as owner_name,
        u.first_name,
        u.last_name,
        u.profile_picture_url as owner_avatar
      FROM okrt o
      JOIN users u ON o.owner_id = u.id
      WHERE o.type = 'O'
        AND o.status = 'A'
        AND (
          o.title ILIKE $1
          OR o.description ILIKE $1
        )
      ORDER BY 
        CASE WHEN o.owner_id = $2 THEN 0 ELSE 1 END,
        o.title ASC
      LIMIT $3
    `, [`%${query.trim()}%`, session.sub, limit]);

    // Format the results
    const formattedObjectives = objectives.map(obj => ({
      id: obj.id,
      title: obj.title,
      owner_id: obj.owner_id,
      owner_name: obj.first_name && obj.last_name 
        ? `${obj.first_name} ${obj.last_name}`.trim()
        : obj.owner_name,
      owner_avatar: obj.owner_avatar,
      visibility: obj.visibility,
      objective_kind: obj.objective_kind,
      cycle_qtr: obj.cycle_qtr
    }));

    return NextResponse.json({ objectives: formattedObjectives });
  } catch (error) {
    console.error('Error searching objectives:', error);
    return NextResponse.json({ error: 'Failed to search objectives' }, { status: 500 });
  }
}