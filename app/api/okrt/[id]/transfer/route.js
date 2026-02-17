import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { all, getOKRTById, getUserById } from '@/lib/pgdb';

// POST /api/okrt/[id]/transfer - Transfer ownership of an objective and its descendants
export async function POST(request, { params }) {
  try {
    const session = await getSession();
    if (!session?.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const okrt = await getOKRTById(id);

    if (!okrt) {
      return NextResponse.json({ error: 'OKRT not found' }, { status: 404 });
    }

    if (okrt.type !== 'O') {
      return NextResponse.json({ error: 'Only objectives can be transferred' }, { status: 400 });
    }

    if (okrt.owner_id.toString() !== session.sub.toString()) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const targetUserId = Number(body?.target_user_id);

    if (!Number.isFinite(targetUserId)) {
      return NextResponse.json({ error: 'Target user is required' }, { status: 400 });
    }

    if (String(targetUserId) === String(okrt.owner_id)) {
      return NextResponse.json({ error: 'Target user is already the owner' }, { status: 400 });
    }

    const targetUser = await getUserById(targetUserId);
    if (!targetUser) {
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 });
    }

    const updatedAt = new Date().toISOString();
    const updatedRows = await all(
      `
      WITH RECURSIVE descendants AS (
        SELECT id
        FROM okrt
        WHERE id = ?
        UNION ALL
        SELECT o.id
        FROM okrt o
        JOIN descendants d ON o.parent_id = d.id
      )
      UPDATE okrt
      SET owner_id = ?, updated_at = ?
      WHERE id IN (SELECT id FROM descendants)
      RETURNING id
      `,
      [id, targetUserId, updatedAt]
    );

    const transferredIds = updatedRows.map((row) => row.id);

    return NextResponse.json({
      message: 'Ownership transferred',
      transferredIds,
      target_user_id: targetUserId,
      _cacheUpdate: {
        action: 'removeMyOKRTs',
        data: { ids: transferredIds }
      }
    });
  } catch (error) {
    console.error('Error transferring OKRT ownership:', error);
    return NextResponse.json({ error: 'Failed to transfer ownership' }, { status: 500 });
  }
}
