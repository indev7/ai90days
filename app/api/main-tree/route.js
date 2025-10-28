import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { loadMainTreeForUser } from '@/lib/mainTreeLoader';

/**
 * GET /api/main-tree
 * Fetch the complete mainTree for the authenticated user
 * This includes: myOKRTs, sharedOKRTs, notifications, timeBlocks, and groups
 */
export async function GET(request) {
  try {
    // Verify authentication
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = user.id;

    // Load the complete mainTree for this user
    const mainTree = await loadMainTreeForUser(userId);

    return NextResponse.json({
      success: true,
      mainTree: mainTree
    });
  } catch (error) {
    console.error('Error fetching mainTree:', error);
    return NextResponse.json(
      { error: 'Failed to fetch mainTree data' },
      { status: 500 }
    );
  }
}