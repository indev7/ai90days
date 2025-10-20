import { NextResponse } from 'next/server';
import { getSession } from '../../../lib/auth';
import { createOKRT, getOKRTHierarchy, getOKRTsByParent, getUserById, getOKRTShares, getGroupById } from '../../../lib/db';
import { v4 as uuidv4 } from 'uuid';

// GET /api/okrt - Get all OKRTs for the current user in hierarchical order, or by parent_id
export async function GET(request) {
  try {
    const session = await getSession();
    if (!session?.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const parentId = searchParams.get('parent_id');

    if (parentId) {
      // Get children of specific parent
      const okrts = await getOKRTsByParent(parentId);
      // Filter to only return OKRTs owned by the current user
      const userOkrts = okrts.filter(okrt => okrt.owner_id.toString() === session.sub.toString());
      return NextResponse.json({ okrts: userOkrts });
    } else {
      // Get all OKRTs in hierarchical order with owner and sharing info
      const okrts = await getOKRTHierarchy(session.sub);
      
      // Enhance each OKRT with owner and sharing information
      const enhancedOkrts = await Promise.all(okrts.map(async (okrt) => {
        // Get owner information
        const owner = await getUserById(okrt.owner_id);
        
        // Get sharing information (groups this OKRT is shared with)
        const shares = await getOKRTShares(okrt.id);
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
        
        return {
          ...okrt,
          owner_name: owner ? `${owner.first_name || ''} ${owner.last_name || ''}`.trim() || owner.display_name : 'Unknown',
          shared_groups: sharedGroups.filter(group => group && group.name)
        };
      }));
      
      return NextResponse.json({ okrts: enhancedOkrts });
    }
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
      id: incomingId,
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

    // Use provided id if exists, else generate new UUID
    const id = incomingId || uuidv4();

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
      kr_target_number: type === 'K' ? (kr_target_number ? parseFloat(kr_target_number) : null) : null,
      kr_unit: type === 'K' ? kr_unit : null,
      kr_baseline_number: type === 'K' ? (kr_baseline_number ? parseFloat(kr_baseline_number) : null) : null,
      weight: weight ? parseFloat(weight) : 1.0,
      task_status: type === 'T' ? (task_status || 'todo') : null,
      due_date: (type === 'T' || type === 'K') && due_date ? due_date : null,
      recurrence_json: type === 'T' ? recurrence_json : null,
      blocked_by: type === 'T' ? blocked_by : null
    };

    console.log('=== Creating New OKRT ===');
    console.log('Type:', okrtData.type);
    console.log('Full payload:', {
      ...okrtData,
      owner_id: okrtData.owner_id || 'none',
      parent_id: okrtData.parent_id || 'none',
      due_date: okrtData.due_date || 'none',
      kr_target_number: okrtData.kr_target_number || 'none',
      kr_unit: okrtData.kr_unit || 'none',
      kr_baseline_number: okrtData.kr_baseline_number || 'none',
      weight: okrtData.weight || 'none'
    });
    console.log('==================');

    const newOKRT = await createOKRT(okrtData);
    return NextResponse.json({ okrt: newOKRT });
  } catch (error) {
    console.error('Error creating OKRT:', error);
    return NextResponse.json({ error: 'Failed to create OKRT' }, { status: 500 });
  }
}
