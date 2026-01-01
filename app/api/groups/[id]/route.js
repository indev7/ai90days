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
  addUserToGroup,
  getAllGroups
} from '@/lib/pgdb';

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
    const requesterId = parseInt(session.sub);
    
    // Get the group to check its type
    const group = await getGroupById(id);
    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }
    
    // Get current user to check role
    const { getUserById } = await import('@/lib/pgdb');
    const currentUser = await getUserById(requesterId);
    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    const isGroupAdmin = await isUserGroupAdmin(requesterId, id);
    const isRoleAdmin = currentUser.role === 'Admin';

    // Require the user to be an admin of this specific group unless they are a platform Admin
    if (!isGroupAdmin && !isRoleAdmin) {
      return NextResponse.json({
        error: 'Forbidden: Only admins of this group can update it'
      }, { status: 403 });
    }

    // Additional guardrails based on user role and group type
    const userRole = currentUser.role;
    const allowedRoles = ['Admin', 'Owner', 'Leader'];
    
    // For Organisation type groups, only Admin can edit
    if (group.type === 'Organisation') {
      if (userRole !== 'Admin') {
        return NextResponse.json({
          error: 'Forbidden: Only Admin users can update Organisation groups'
        }, { status: 403 });
      }
    } else {
      // For other group types, Admin, Owner, or Leader can edit
      if (!allowedRoles.includes(userRole)) {
        // If not one of the allowed roles, check if user is group admin
        const isGroupAdmin = await isUserGroupAdmin(session.sub, id);
        if (!isGroupAdmin) {
          return NextResponse.json({
            error: 'Forbidden: Only Admin, Owner, Leader, or group admins can update groups'
          }, { status: 403 });
        }
      }
    }

    const body = await request.json();
    const { name, type, parent_group_id, thumbnail_url, members, strategic_objectives, vision, mission } = body;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (vision !== undefined) updateData.vision = vision;
    if (mission !== undefined) updateData.mission = mission;
    if (type !== undefined) {
      const validTypes = ['Organisation', 'Department', 'Team', 'Chapter', 'Squad', 'Tribe', 'Group'];
      if (!validTypes.includes(type)) {
        return NextResponse.json({ error: 'Invalid group type' }, { status: 400 });
      }
      
      // Check if user is Admin when changing to Organisation type
      if (type === 'Organisation' && currentUser.role !== 'Admin') {
        return NextResponse.json({ error: 'Only Admin users can create Organisation groups' }, { status: 403 });
      }
      
      // Check for existing Organisation group when changing type to Organisation
      if (type === 'Organisation') {
        const allGroups = await getAllGroups();
        const existingOrgGroup = allGroups.find(g => g.type === 'Organisation' && g.id !== id);
        if (existingOrgGroup) {
          return NextResponse.json({
            error: 'An Organisation already exists. There can be only one group of type Organisation'
          }, { status: 409 });
        }
      }
      
      updateData.type = type;
    }
    if (parent_group_id !== undefined) updateData.parent_group_id = parent_group_id;
    if (thumbnail_url !== undefined) updateData.thumbnail_url = thumbnail_url;

    const updatedGroup = await updateGroup(id, updateData);
    if (!updatedGroup) {
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

    // Update strategic objectives if provided
    const { all, run } = await import('@/lib/pgdb');
    if (strategic_objectives !== undefined && Array.isArray(strategic_objectives)) {
      // Remove all existing strategic objectives for this group
      await run(`DELETE FROM strategic_objectives WHERE group_id = $1`, [id]);
      
      // Add new strategic objectives (max 5)
      const objectivesToAdd = strategic_objectives.slice(0, 5);
      for (const objectiveId of objectivesToAdd) {
        try {
          await run(`
            INSERT INTO strategic_objectives (group_id, okrt_id)
            VALUES ($1, $2)
            ON CONFLICT (group_id, okrt_id) DO NOTHING
          `, [id, objectiveId]);
        } catch (error) {
          console.error(`Error adding strategic objective ${objectiveId} to group:`, error);
        }
      }
    }

    // Fetch updated member details and objectives for cache
    const memberDetails = await getGroupMembers(id);
    const objectiveIds = await getGroupSharedOKRTs(id);
    
    // Fetch strategic objectives for cache
    const strategicObjectives = await all(`
      SELECT okrt_id
      FROM strategic_objectives
      WHERE group_id = $1
    `, [id]);
    
    // Check if current user is a member
    const isMember = memberDetails.some(m => m.id === session.sub);
    const isAdminUser = memberDetails.find(m => m.id === session.sub)?.is_admin || false;

    // Return response with cache update instruction
    return NextResponse.json({
      group: updatedGroup,
      _cacheUpdate: {
        action: 'updateGroup',
        data: {
          id,
          updates: {
            ...updatedGroup,
            is_member: isMember,
            is_admin: isGroupAdmin || isAdminUser,
            members: memberDetails,
            objectiveIds: isMember ? objectiveIds.map(o => o.id) : [],
            strategicObjectiveIds: strategicObjectives.map(so => so.okrt_id)
          }
        }
      }
    });
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
    
    const requesterId = parseInt(session.sub);
    const { getUserById } = await import('@/lib/pgdb');
    const currentUser = await getUserById(requesterId);
    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user is admin of this group or a platform Admin
    const isAdmin = await isUserGroupAdmin(requesterId, id);
    const isRoleAdmin = currentUser.role === 'Admin';
    if (!isAdmin && !isRoleAdmin) {
      return NextResponse.json({ error: 'Forbidden: Only group admins or Admin role can delete groups' }, { status: 403 });
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

    // Return response with cache update instruction
    return NextResponse.json({
      message: 'Group deleted successfully',
      _cacheUpdate: {
        action: 'removeGroup',
        data: { id }
      }
    });
  } catch (error) {
    console.error('Error deleting group:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
