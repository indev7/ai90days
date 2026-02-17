import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  getOKRTById,
  updateOKRT,
  getOKRTShares,
  shareOKRTWithGroup,
  shareOKRTWithUser,
  unshareOKRT,
  getUserByEmail,
  getGroupById
} from '@/lib/pgdb';

export async function GET(request, { params }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    
    // Check if user owns this OKRT
    const okrt = await getOKRTById(id);
    if (!okrt) {
      return NextResponse.json({ error: 'OKRT not found' }, { status: 404 });
    }
    
    if (okrt.owner_id.toString() !== session.sub.toString()) {
      return NextResponse.json({ error: 'Forbidden: You can only view sharing settings for your own OKRTs' }, { status: 403 });
    }

    const shares = await getOKRTShares(id);
    return NextResponse.json({ shares, visibility: okrt.visibility });
  } catch (error) {
    console.error('Error fetching OKRT shares:', error);
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
    
    // Check if user owns this OKRT
    const okrt = await getOKRTById(id);
    if (!okrt) {
      return NextResponse.json({ error: 'OKRT not found' }, { status: 404 });
    }
    
    if (okrt.owner_id.toString() !== session.sub.toString()) {
      return NextResponse.json({ error: 'Forbidden: You can only share your own OKRTs' }, { status: 403 });
    }

    const body = await request.json();
    const { visibility, groups = [], users = [] } = body;

    // Validate visibility
    if (!['private', 'shared'].includes(visibility)) {
      return NextResponse.json({ error: 'Invalid visibility. Must be "private" or "shared"' }, { status: 400 });
    }

    // Update OKRT visibility
    await updateOKRT(id, { visibility });

    if (visibility === 'shared') {
      // Reconcile shares: add new shares and remove unchecked ones
      const existingShares = await getOKRTShares(id);
      const existingGroupIds = existingShares.filter(s => s.share_type === 'G').map(s => String(s.group_or_user_id));
      const existingUserIds = existingShares.filter(s => s.share_type === 'U').map(s => String(s.group_or_user_id));

      // Normalize requested group ids to strings
      const requestedGroupIds = (groups || []).map(g => String(g));

      // Groups to add
      const groupsToAdd = requestedGroupIds.filter(g => !existingGroupIds.includes(g));
      for (const groupId of groupsToAdd) {
        await shareOKRTWithGroup(id, groupId);
      }

      // Groups to remove
      const groupsToRemove = existingGroupIds.filter(g => !requestedGroupIds.includes(g));
      for (const groupId of groupsToRemove) {
        await unshareOKRT(id, groupId, 'G');
      }

      // Users: resolve provided emails to user ids
      const requestedUserEmails = users || [];
      const requestedUserIds = [];
      for (const email of requestedUserEmails) {
        const targetUser = await getUserByEmail(email);
        if (targetUser) requestedUserIds.push(String(targetUser.id));
      }

      // Users to add
      const usersToAdd = requestedUserIds.filter(u => !existingUserIds.includes(u));
      for (const userId of usersToAdd) {
        await shareOKRTWithUser(id, userId);
      }

      // Users to remove
      const usersToRemove = existingUserIds.filter(u => !requestedUserIds.includes(u));
      for (const userId of usersToRemove) {
        await unshareOKRT(id, userId, 'U');
      }
    } else {
      // If setting to private, remove all shares
      const existingShares = await getOKRTShares(id);
      for (const share of existingShares) {
        await unshareOKRT(id, share.group_or_user_id, share.share_type);
      }
    }

    // Return updated sharing info
    const shares = await getOKRTShares(id);
    const sharedGroups = await Promise.all(
      shares
        .filter((share) => share.share_type === 'G')
        .map(async (share) => {
          try {
            return await getGroupById(share.group_or_user_id);
          } catch (error) {
            console.error('Error fetching group for share:', share.group_or_user_id, error);
            return null;
          }
        })
    );
    const filteredSharedGroups = sharedGroups.filter((group) => group && group.name);

    return NextResponse.json({
      shares,
      visibility,
      shared_groups: filteredSharedGroups,
      _cacheUpdate: {
        action: 'updateMyOKRT',
        data: {
          id,
          updates: {
            visibility,
            shared_groups: visibility === 'shared' ? filteredSharedGroups : []
          }
        }
      }
    });
  } catch (error) {
    console.error('Error updating OKRT shares:', error);
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
    const { searchParams } = new URL(request.url);
    const groupOrUserId = searchParams.get('target');
    const shareType = searchParams.get('type');

    if (!groupOrUserId || !shareType) {
      return NextResponse.json({ error: 'Target ID and share type are required' }, { status: 400 });
    }

    // Check if user owns this OKRT
    const okrt = await getOKRTById(id);
    if (!okrt) {
      return NextResponse.json({ error: 'OKRT not found' }, { status: 404 });
    }
    
    if (okrt.owner_id.toString() !== session.sub.toString()) {
      return NextResponse.json({ error: 'Forbidden: You can only unshare your own OKRTs' }, { status: 403 });
    }

    await unshareOKRT(id, groupOrUserId, shareType);

    // Return updated sharing info
    const shares = await getOKRTShares(id);
    let visibility = okrt.visibility;
    let cacheUpdate = null;
    if (shares.length === 0 && okrt.visibility !== 'private') {
      visibility = 'private';
      await updateOKRT(id, { visibility });
      cacheUpdate = {
        action: 'updateMyOKRT',
        data: {
          id,
          updates: {
            visibility,
            shared_groups: []
          }
        }
      };
    }
    return NextResponse.json({
      shares,
      visibility,
      ...(cacheUpdate ? { _cacheUpdate: cacheUpdate } : {})
    });
  } catch (error) {
    console.error('Error removing OKRT share:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
