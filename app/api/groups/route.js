import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  createGroup,
  getAllGroups,
  getRootGroups,
  getUserGroups,
  addUserToGroup
} from '@/lib/pgdb';
import { nanoid } from 'nanoid';
import { generateAvatarSVG } from '@/lib/avatarGenerator';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export async function GET(request) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const userId = searchParams.get('userId');
    const hierarchy = searchParams.get('hierarchy');

    // If hierarchy is requested, build the complete tree structure
    if (hierarchy === 'true') {
      const groups = await buildGroupHierarchy();
      return NextResponse.json({ groups });
    }

    let groups;
    if (type === 'root') {
      groups = await getRootGroups();
    } else if (userId) {
      groups = await getUserGroups(userId);
    } else {
      groups = await getAllGroups();
    }

    return NextResponse.json({ groups });
  } catch (error) {
    console.error('Error fetching groups:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Helper function to build group hierarchy with counts
async function buildGroupHierarchy() {
  const { all } = await import('@/lib/pgdb');
  
  // Get all groups
  const groups = await all(`
    SELECT
      g.id,
      g.name,
      g.type,
      g.parent_group_id,
      g.thumbnail_url
    FROM groups g
    ORDER BY g.name ASC
  `);

  // Get members for all groups
  const allMembers = await all(`
    SELECT
      ug.group_id,
      u.id,
      u.display_name,
      u.email,
      u.first_name,
      u.last_name,
      u.profile_picture_url,
      ug.is_admin
    FROM user_group ug
    JOIN users u ON ug.user_id = u.id
    ORDER BY ug.is_admin DESC, u.display_name ASC
  `);

  // Get objective IDs for all groups
  const allObjectives = await all(`
    SELECT DISTINCT
      s.group_or_user_id as group_id,
      s.okrt_id
    FROM share s
    JOIN okrt o ON s.okrt_id = o.id
    WHERE s.share_type = 'G' AND o.visibility = 'shared'
  `);

  // Build maps for members and objectives by group
  const membersByGroup = new Map();
  const objectivesByGroup = new Map();

  allMembers.forEach(member => {
    if (!membersByGroup.has(member.group_id)) {
      membersByGroup.set(member.group_id, []);
    }
    membersByGroup.get(member.group_id).push(member);
  });

  allObjectives.forEach(obj => {
    if (!objectivesByGroup.has(obj.group_id)) {
      objectivesByGroup.set(obj.group_id, []);
    }
    objectivesByGroup.get(obj.group_id).push(obj.okrt_id);
  });

  // Build a map for quick lookup with members and objectives
  const groupMap = new Map();
  groups.forEach(group => {
    groupMap.set(group.id, {
      ...group,
      members: membersByGroup.get(group.id) || [],
      objectiveIds: objectivesByGroup.get(group.id) || [],
      children: []
    });
  });

  // Build the tree structure
  const rootGroups = [];
  groups.forEach(group => {
    const groupNode = groupMap.get(group.id);
    if (group.parent_group_id) {
      const parent = groupMap.get(group.parent_group_id);
      if (parent) {
        parent.children.push(groupNode);
      }
    } else {
      rootGroups.push(groupNode);
    }
  });

  return rootGroups;
}

export async function POST(request) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, type, parent_group_id, thumbnail_data } = body;

    if (!name || !type) {
      return NextResponse.json({ error: 'Name and type are required' }, { status: 400 });
    }

    // Validate type
    const validTypes = ['Organisation', 'Department', 'Team', 'Chapter', 'Squad', 'Tribe', 'Group'];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: 'Invalid group type' }, { status: 400 });
    }

    const groupId = nanoid();
    let finalThumbnailUrl = null;
    
    // Handle uploaded file data
    if (thumbnail_data) {
      try {
        // Save uploaded image file
        const base64Data = thumbnail_data.split(',')[1]; // Remove data:image/...;base64, prefix
        const buffer = Buffer.from(base64Data, 'base64');
        
        // Determine file extension from data URL
        const mimeMatch = thumbnail_data.match(/data:image\/([^;]+)/);
        const extension = mimeMatch ? mimeMatch[1] : 'png';
        
        
        const publicDir = join(process.cwd(), 'public', 'groups');
        
        // Ensure directory exists
        if (!existsSync(publicDir)) {
          mkdirSync(publicDir, { recursive: true });
        }
        
        const filename = `${groupId}.${extension}`;
        const filepath = join(publicDir, filename);
        
        writeFileSync(filepath, buffer);
        finalThumbnailUrl = `/groups/${filename}`;
      } catch (error) {
        console.error('Error saving uploaded image:', error);
        // Fall back to generated avatar if file save fails
      }
    }
    
    // Generate avatar if no thumbnail was uploaded or upload failed
    if (!finalThumbnailUrl) {
      try {
        const publicDir = join(process.cwd(), 'public', 'groups');
        
        // Ensure directory exists
        if (!existsSync(publicDir)) {
          mkdirSync(publicDir, { recursive: true });
        }
        
        const svg = generateAvatarSVG(name);
        const filename = `${groupId}.svg`;
        const filepath = join(publicDir, filename);
        
        writeFileSync(filepath, svg);
        
        finalThumbnailUrl = `/groups/${filename}`;
      } catch (error) {
        console.error('Error saving group avatar:', error);
        // Continue without avatar if generation fails
      }
    }
    
    const groupData = {
      id: groupId,
      name,
      type,
      parent_group_id: parent_group_id || null,
      thumbnail_url: finalThumbnailUrl
    };

    const group = await createGroup(groupData);
    
    // Add the creator as an admin of the group
    await addUserToGroup(user.sub, groupId, true);

    // Collect all members including the creator
    const allMembers = [
      {
        id: user.sub,
        is_admin: true
      }
    ];

    // Add selected members to the group
    if (body.members && Array.isArray(body.members)) {
      for (const member of body.members) {
        try {
          await addUserToGroup(member.id, groupId, member.isAdmin || false);
          allMembers.push({
            id: member.id,
            is_admin: member.isAdmin || false
          });
        } catch (error) {
          console.error(`Error adding member ${member.id} to group:`, error);
          // Continue with other members even if one fails
        }
      }
    }

    // Fetch complete member details for cache
    const { all } = await import('@/lib/pgdb');
    const memberDetails = await all(`
      SELECT
        u.id,
        u.display_name,
        u.email,
        u.first_name,
        u.last_name,
        u.profile_picture_url,
        ug.is_admin
      FROM users u
      JOIN user_group ug ON u.id = ug.user_id
      WHERE ug.group_id = ?
      ORDER BY ug.is_admin DESC, u.display_name ASC
    `, [groupId]);

    // Return response with cache update instruction
    return NextResponse.json({
      group,
      _cacheUpdate: {
        action: 'addGroup',
        data: {
          ...group,
          is_member: true,
          is_admin: true,
          members: memberDetails,
          objectiveIds: []
        }
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating group:', error);
    if (error.message.includes('UNIQUE constraint failed')) {
      return NextResponse.json({ error: 'Group name already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}