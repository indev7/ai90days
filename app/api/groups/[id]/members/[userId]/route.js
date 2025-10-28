import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  removeUserFromGroup,
  addUserToGroup,
  isUserGroupAdmin,
  getGroupMembers
} from '@/lib/db';

export async function PUT(request, { params }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: groupId, userId } = params;
    
    // Check if user is admin of this group
    const isAdmin = await isUserGroupAdmin(session.sub, groupId);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden: Only group admins can update member status' }, { status: 403 });
    }

    const body = await request.json();
    const { isAdmin: makeAdmin } = body;

    if (makeAdmin === undefined) {
      return NextResponse.json({ error: 'isAdmin field is required' }, { status: 400 });
    }

    // Update user's admin status by re-adding them with new status
    await addUserToGroup(parseInt(userId), groupId, makeAdmin);

    // Return updated member list
    const members = await getGroupMembers(groupId);
    return NextResponse.json({ members });
  } catch (error) {
    console.error('Error updating group member:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: groupId, userId } = params;
    
    // Check if user is admin of this group or removing themselves
    const isAdmin = await isUserGroupAdmin(session.sub, groupId);
    const isSelf = session.sub === parseInt(userId);
    
    if (!isAdmin && !isSelf) {
      return NextResponse.json({ 
        error: 'Forbidden: Only group admins can remove members, or users can remove themselves' 
      }, { status: 403 });
    }

    // Remove user from group
    const result = await removeUserFromGroup(parseInt(userId), groupId);
    
    if (result.changes === 0) {
      return NextResponse.json({ error: 'User is not a member of this group' }, { status: 404 });
    }

    // Return updated member list with cache update instruction
    const members = await getGroupMembers(groupId);
    return NextResponse.json({
      members,
      _cacheUpdate: {
        action: 'updateGroupMembership',
        data: {
          groupId,
          userId: parseInt(userId),
          isMember: false,
          role: null
        }
      }
    });
  } catch (error) {
    console.error('Error removing group member:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}