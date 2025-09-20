import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  getGroupById,
  updateGroup,
  deleteGroup,
  getGroupsByParent,
  getGroupMembers,
  getGroupSharedOKRTs,
  getGroupSharedOKRTCount,
  isUserGroupAdmin,
  addUserToGroup
} from '@/lib/db';

export async function GET(request, { params }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const include = searchParams.get('include');

    const group = await getGroupById(id);
    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    const result = { group };

    // Include additional data based on query parameters
    if (include) {
      const includes = include.split(',');
      
      if (includes.includes('children')) {
        result.children = await getGroupsByParent(id);
      }
      
      if (includes.includes('members')) {
        result.members = await getGroupMembers(id);
      }
      
      if (includes.includes('objectives')) {
        result.objectives = await getGroupSharedOKRTs(id);
        result.objectiveCount = await getGroupSharedOKRTCount(id);
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching group:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    
    // Check if user is admin of this group
    const isAdmin = await isUserGroupAdmin(session.sub, id);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden: Only group admins can update groups' }, { status: 403 });
    }

    const body = await request.json();
    const { name, type, parent_group_id, thumbnail_url, members } = body;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (type !== undefined) {
      const validTypes = ['Organisation', 'Department', 'Team', 'Chapter', 'Squad', 'Tribe', 'Group'];
      if (!validTypes.includes(type)) {
        return NextResponse.json({ error: 'Invalid group type' }, { status: 400 });
      }
      updateData.type = type;
    }
    if (parent_group_id !== undefined) updateData.parent_group_id = parent_group_id;
    if (thumbnail_url !== undefined) updateData.thumbnail_url = thumbnail_url;

    const group = await updateGroup(id, updateData);
    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    // Add selected members to the group (only for edit mode)
    if (members && Array.isArray(members)) {
      for (const member of members) {
        try {
          await addUserToGroup(member.id, id, member.isAdmin || false); // Use member's admin status
        } catch (error) {
          console.error(`Error adding member ${member.id} to group:`, error);
          // Continue with other members even if one fails
        }
      }
    }

    return NextResponse.json({ group });
  } catch (error) {
    console.error('Error updating group:', error);
    if (error.message.includes('UNIQUE constraint failed')) {
      return NextResponse.json({ error: 'Group name already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    
    // Check if user is admin of this group
    const isAdmin = await isUserGroupAdmin(session.sub, id);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden: Only group admins can delete groups' }, { status: 403 });
    }

    // Check if group has children
    const children = await getGroupsByParent(id);
    if (children.length > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete group with child groups. Please delete or reassign child groups first.' 
      }, { status: 400 });
    }

    const result = await deleteGroup(id);
    if (result.changes === 0) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Group deleted successfully' });
  } catch (error) {
    console.error('Error deleting group:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}