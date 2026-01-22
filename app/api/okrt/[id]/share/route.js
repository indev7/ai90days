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
      // Share with groups
      for (const groupId of groups) {
        await shareOKRTWithGroup(id, groupId);
      }

      // Share with users (by email)
      for (const email of users) {
        const targetUser = await getUserByEmail(email);
        if (targetUser) {
          await shareOKRTWithUser(id, targetUser.id);
        }
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
