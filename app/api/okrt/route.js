import { NextResponse } from 'next/server';
import { getSession } from '../../../lib/auth';
import { createOKRT, getOKRTHierarchy } from '../../../lib/db';
import { v4 as uuidv4 } from 'uuid';

// GET /api/okrt - Get all OKRTs for the current user in hierarchical order
export async function GET(request) {
  try {
    const session = await getSession();
    if (!session?.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const okrts = await getOKRTHierarchy(session.sub);
    return NextResponse.json({ okrts });
  } catch (error) {
    console.error('Error fetching OKRTs:', error);
    return NextResponse.json({ error: 'Failed to fetch OKRTs' }, { status: 500 });
  }
}

// POST /api/okrt - Create a new OKRT
export async function POST(request) {
  try {
    const session = await getSession();
    if (!session?.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();
    const {
      type, parent_id, title, description, area, cycle_qtr,
      visibility = 'private', objective_kind, kr_target_number,
      kr_unit, kr_baseline_number, weight = 1.0, task_status,
      due_date, recurrence_json, blocked_by
    } = data;

    // Validate required fields based on type
    if (!type || !['O', 'K', 'T'].includes(type)) {
      return NextResponse.json({ error: 'Invalid type. Must be O, K, or T' }, { status: 400 });
    }

    if (type === 'O' && !title) {
      return NextResponse.json({ error: 'Title is required for Objectives' }, { status: 400 });
    }

    if (type === 'K' && (!kr_target_number || !kr_unit)) {
      return NextResponse.json({ error: 'Target number and unit are required for Key Results' }, { status: 400 });
    }

    // Generate UUID for the new OKRT
    const id = uuidv4();

    const okrtData = {
      id,
      type,
      owner_id: session.sub,
      parent_id: parent_id || null,
      title,
      description,
      area,
      cycle_qtr,
      visibility,
      objective_kind: type === 'O' ? objective_kind : null,
      kr_target_number: type === 'K' ? kr_target_number : null,
      kr_unit: type === 'K' ? kr_unit : null,
      kr_baseline_number: type === 'K' ? kr_baseline_number : null,
      weight: ['K', 'T'].includes(type) ? weight : null,
      task_status: type === 'T' ? (task_status || 'todo') : null,
      due_date: type === 'T' ? due_date : null,
      recurrence_json: type === 'T' ? recurrence_json : null,
      blocked_by: type === 'T' ? blocked_by : null
    };

    const newOKRT = await createOKRT(okrtData);
    return NextResponse.json({ okrt: newOKRT });
  } catch (error) {
    console.error('Error creating OKRT:', error);
    return NextResponse.json({ error: 'Failed to create OKRT' }, { status: 500 });
  }
}
