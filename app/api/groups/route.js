import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { 
  createGroup, 
  getAllGroups, 
  getRootGroups,
  getUserGroups,
  addUserToGroup
} from '@/lib/db';
import { nanoid } from 'nanoid';
import { saveGroupAvatar } from '@/lib/avatarGenerator';

export async function GET(request) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const userId = searchParams.get('userId');

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

export async function POST(request) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, type, parent_group_id, thumbnail_url } = body;

    if (!name || !type) {
      return NextResponse.json({ error: 'Name and type are required' }, { status: 400 });
    }

    // Validate type
    const validTypes = ['Organisation', 'Department', 'Team', 'Chapter', 'Squad', 'Tribe', 'Group'];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: 'Invalid group type' }, { status: 400 });
    }

    const groupId = nanoid();
    
    // Generate avatar if no thumbnail URL provided
    let finalThumbnailUrl = thumbnail_url;
    if (!thumbnail_url) {
      const generatedAvatarPath = saveGroupAvatar(groupId, name);
      if (generatedAvatarPath) {
        finalThumbnailUrl = generatedAvatarPath;
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

    return NextResponse.json({ group }, { status: 201 });
  } catch (error) {
    console.error('Error creating group:', error);
    if (error.message.includes('UNIQUE constraint failed')) {
      return NextResponse.json({ error: 'Group name already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}