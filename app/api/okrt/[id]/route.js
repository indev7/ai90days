import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/auth';
import { getOKRTById, updateOKRT, deleteOKRTCascade, getOKRTFollowers, getUserById } from '../../../../lib/pgdb';
import { notifyProgressUpdate } from '../../../../lib/notifications';

// GET /api/okrt/[id] - Get a specific OKRT by ID
export async function GET(request, { params }) {
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

    // Check if user owns the OKRT or if it's publicly visible
    if (okrt.owner_id.toString() !== session.sub.toString() && okrt.visibility === 'private') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ okrt });
  } catch (error) {
    console.error('Error fetching OKRT:', error);
    return NextResponse.json({ error: 'Failed to fetch OKRT' }, { status: 500 });
  }
}

// PUT /api/okrt/[id] - Update a specific OKRT
export async function PUT(request, { params }) {
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

    // Check if user owns the OKRT
    if (okrt.owner_id.toString() !== session.sub.toString()) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updateData = await request.json();
    
    // Store original progress for comparison
    const originalProgress = okrt.progress;
    
    // Validate type-specific fields
    if (updateData.type && !['O', 'K', 'T'].includes(updateData.type)) {
      return NextResponse.json({ error: 'Invalid type. Must be O, K, or T' }, { status: 400 });
    }

    // Clean up type-specific fields based on the OKRT type
    const type = updateData.type || okrt.type;
    
    if (type === 'O') {
      // Objectives don't have KR or Task specific fields
      delete updateData.kr_target_number;
      delete updateData.kr_unit;
      delete updateData.kr_baseline_number;
      delete updateData.weight;
      delete updateData.task_status;
      delete updateData.due_date;
      delete updateData.recurrence_json;
      delete updateData.blocked_by;
    } else if (type === 'K') {
      // Key Results don't have Objective or Task specific fields
      delete updateData.objective_kind;
      delete updateData.task_status;
      delete updateData.recurrence_json;
      delete updateData.blocked_by;
    } else if (type === 'T') {
      // Tasks don't have Objective or KR specific fields
      delete updateData.objective_kind;
      delete updateData.kr_target_number;
      delete updateData.kr_unit;
      delete updateData.kr_baseline_number;
    }

    console.log('=== Updating OKRT ===');
    console.log('OKRT ID:', id);
    console.log('Type:', type);
    console.log('Update payload:', {
      ...updateData,
      due_date: updateData.due_date || 'none',
      kr_target_number: updateData.kr_target_number || 'none',
      kr_unit: updateData.kr_unit || 'none',
      kr_baseline_number: updateData.kr_baseline_number || 'none',
      weight: updateData.weight || 'none'
    });
    console.log('==================');

    const updatedOKRT = await updateOKRT(id, updateData);
    
    // Check if progress changed and send notifications to followers
    if (updateData.progress !== undefined && updateData.progress !== originalProgress) {
      try {
        const followers = await getOKRTFollowers(id);
        if (followers.length > 0) {
          const owner = await getUserById(session.sub);
          const followerIds = followers.map(f => f.user_id);
          
          await notifyProgressUpdate(
            followerIds,
            owner.display_name,
            okrt.title,
            id,
            updateData.progress
          );
        }
      } catch (notificationError) {
        console.error('Error sending progress notifications:', notificationError);
        // Don't fail the update if notifications fail
      }
    }
    
    // Return response with cache update instruction
    return NextResponse.json({
      okrt: updatedOKRT,
      _cacheUpdate: {
        action: 'updateMyOKRT',
        data: { id: updatedOKRT.id, updates: updatedOKRT }
      }
    });
  } catch (error) {
    console.error('Error updating OKRT:', error);
    return NextResponse.json({ error: 'Failed to update OKRT' }, { status: 500 });
  }
}

// DELETE /api/okrt/[id] - Delete a specific OKRT
export async function DELETE(request, { params }) {
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

    // Check if user owns the OKRT
    if (okrt.owner_id.toString() !== session.sub.toString()) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await deleteOKRTCascade(id);
    
    // Return response with cache update instruction
    return NextResponse.json({
      message: 'OKRT (and its children) deleted successfully',
      _cacheUpdate: {
        action: 'removeMyOKRT',
        data: { id }
      }
    });
  } catch (error) {
    console.error('Error deleting OKRT:', error);
    return NextResponse.json({ error: 'Failed to delete OKRT' }, { status: 500 });
  }
}
