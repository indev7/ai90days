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

    // Add selected members to the group
    if (body.members && Array.isArray(body.members)) {
      for (const member of body.members) {
        try {
          await addUserToGroup(member.id, groupId, member.isAdmin || false); // Use member's admin status
        } catch (error) {
          console.error(`Error adding member ${member.id} to group:`, error);
          // Continue with other members even if one fails
        }
      }
    }

    return NextResponse.json({ group }, { status: 201 });
  } catch (error) {
    console.error('Error creating group:', error);
    if (error.message.includes('UNIQUE constraint failed')) {
      return NextResponse.json({ error: 'Group name already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}