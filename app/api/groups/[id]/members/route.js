import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  getGroupMembers,
  addUserToGroup,
  removeUserFromGroup,
  isUserGroupAdmin,
  getUserByEmail
} from '@/lib/pgdb';

export async function GET(request, { params }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const members = await getGroupMembers(id);

    return NextResponse.json({ members });
  } catch (error) {
    console.error('Error fetching group members:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    
    // Check if user is admin of this group
    const isAdmin = await isUserGroupAdmin(session.sub, id);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden: Only group admins can add members' }, { status: 403 });
    }

    const body = await request.json();
    const { email, isAdmin: makeAdmin = false } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Find user by email
    const targetUser = await getUserByEmail(email);
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Add user to group
    await addUserToGroup(targetUser.id, id, makeAdmin);

    // Return updated member list with cache update instruction
    const members = await getGroupMembers(id);
    return NextResponse.json({
      members,
      _cacheUpdate: {
        action: 'updateGroupMembership',
        data: {
          groupId: id,
          userId: targetUser.id,
          isMember: true,
          role: makeAdmin ? 'admin' : 'member'
        }
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Error adding group member:', error);
    if (error.message.includes('UNIQUE constraint failed')) {
      return NextResponse.json({ error: 'User is already a member of this group' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}