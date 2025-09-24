import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSharedOKRTsForUser, getUserById, getOKRTShares, getGroupById } from '@/lib/db';

export async function GET(request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sharedOKRTs = await getSharedOKRTsForUser(session.sub);
    
    // Enhance each OKRT with group sharing information
    const enhancedOkrts = await Promise.all(sharedOKRTs.map(async (okrt) => {
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
        shared_groups: sharedGroups.filter(group => group && group.name)
      };
    }));
    
    return NextResponse.json({ okrts: enhancedOkrts });
  } catch (error) {
    console.error('Error fetching shared OKRTs:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}