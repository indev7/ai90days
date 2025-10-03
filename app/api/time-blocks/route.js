import { NextResponse } from 'next/server';
import { getSession } from '../../../lib/auth';
import { 
  createTimeBlock, 
  getTimeBlocksByUserAndDate, 
  getTimeBlocksByUser
} from '../../../lib/db';

// GET /api/time-blocks - Get time blocks for current user by date or all
export async function GET(request) {
  try {
    const session = await getSession();
    if (!session?.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date'); // Format: YYYY-MM-DD

    let timeBlocks;
    if (date) {
      // Get time blocks for specific date
      timeBlocks = await getTimeBlocksByUserAndDate(session.sub, date);
    } else {
      // Get all time blocks for user
      timeBlocks = await getTimeBlocksByUser(session.sub);
    }

    return NextResponse.json({ timeBlocks });
  } catch (error) {
    console.error('Error fetching time blocks:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/time-blocks - Create a new time block
export async function POST(request) {
  try {
    const session = await getSession();
    if (!session?.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { task_id, start_time, duration, objective_id } = body;

    // Validate required fields
    if (!task_id || !start_time || !duration) {
      return NextResponse.json(
        { error: 'Missing required fields: task_id, start_time, duration' },
        { status: 400 }
      );
    }

    // Validate duration is a positive number
    if (!Number.isInteger(duration) || duration <= 0) {
      return NextResponse.json(
        { error: 'Duration must be a positive integer (minutes)' },
        { status: 400 }
      );
    }

    // Create time block with current user as owner
    const timeBlockData = {
      task_id,
      user_id: session.sub,
      start_time,
      duration,
      objective_id // Optional field for tasks that belong to objectives
    };

    const timeBlock = await createTimeBlock(timeBlockData);

    return NextResponse.json({ timeBlock }, { status: 201 });
  } catch (error) {
    console.error('Error creating time block:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}