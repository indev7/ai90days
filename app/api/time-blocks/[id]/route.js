import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/auth';
import { 
  getTimeBlockById,
  updateTimeBlock,
  deleteTimeBlock
} from '../../../../lib/db';

// GET /api/time-blocks/[id] - Get specific time block
export async function GET(request, { params }) {
  try {
    const session = await getSession();
    if (!session?.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const timeBlock = await getTimeBlockById(id);

    if (!timeBlock) {
      return NextResponse.json({ error: 'Time block not found' }, { status: 404 });
    }

    // Security check: user can only access their own time blocks
    if (timeBlock.user_id !== parseInt(session.sub)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ timeBlock });
  } catch (error) {
    console.error('Error fetching time block:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/time-blocks/[id] - Update time block
export async function PUT(request, { params }) {
  try {
    const session = await getSession();
    if (!session?.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();

    // Get existing time block to check ownership
    const existingTimeBlock = await getTimeBlockById(id);
    if (!existingTimeBlock) {
      return NextResponse.json({ error: 'Time block not found' }, { status: 404 });
    }

    // Security check: user can only update their own time blocks
    if (existingTimeBlock.user_id !== parseInt(session.sub)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Validate duration if provided
    if (body.duration !== undefined) {
      if (!Number.isInteger(body.duration) || body.duration <= 0) {
        return NextResponse.json(
          { error: 'Duration must be a positive integer (minutes)' },
          { status: 400 }
        );
      }
    }

    const updateData = {};
    if (body.start_time !== undefined) updateData.start_time = body.start_time;
    if (body.duration !== undefined) updateData.duration = body.duration;
    if (body.task_id !== undefined) updateData.task_id = body.task_id;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const updatedTimeBlock = await updateTimeBlock(id, updateData);

    return NextResponse.json({ timeBlock: updatedTimeBlock });
  } catch (error) {
    console.error('Error updating time block:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/time-blocks/[id] - Delete time block
export async function DELETE(request, { params }) {
  try {
    const session = await getSession();
    if (!session?.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;

    // Get existing time block to check ownership
    const existingTimeBlock = await getTimeBlockById(id);
    if (!existingTimeBlock) {
      return NextResponse.json({ error: 'Time block not found' }, { status: 404 });
    }

    // Security check: user can only delete their own time blocks
    if (existingTimeBlock.user_id !== parseInt(session.sub)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await deleteTimeBlock(id);

    return NextResponse.json({ message: 'Time block deleted successfully' });
  } catch (error) {
    console.error('Error deleting time block:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}