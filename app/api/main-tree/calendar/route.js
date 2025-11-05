import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { loadCalendarForUser } from '@/lib/mainTreeLoader';

/**
 * GET /api/main-tree/calendar
 * Fetch calendar events for the authenticated user
 * This is loaded separately after the main tree for better performance
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

    // Load calendar events for this user
    const calendar = await loadCalendarForUser(userId);

    return NextResponse.json({
      success: true,
      calendar: calendar,
      _cacheUpdate: {
        action: 'setCalendar',
        data: calendar
      }
    });
  } catch (error) {
    console.error('Error fetching calendar:', error);
    return NextResponse.json(
      { error: 'Failed to fetch calendar data' },
      { status: 500 }
    );
  }
}