import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { 
  getNotificationsByUser, 
  getUnreadNotificationCount,
  markAllNotificationsAsRead,
  createNotification 
} from '@/lib/pgdb';

export async function GET(request) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const countOnly = searchParams.get('count') === 'true';
    const limit = parseInt(searchParams.get('limit')) || 50;

    if (countOnly) {
      const count = await getUnreadNotificationCount(user.id);
      return NextResponse.json({ count });
    }

    const notifications = await getNotificationsByUser(user.id, limit);
    return NextResponse.json({ notifications });

  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    if (action === 'mark_all_read') {
      await markAllNotificationsAsRead(user.id);
      return NextResponse.json({ success: true });
    }

    // Create notification (for testing or admin purposes)
    if (action === 'create') {
      const { type, title, message, related_okrt_id, related_group_id, related_user_id } = body;
      
      const notification = await createNotification({
        user_id: user.id,
        type,
        title,
        message,
        related_okrt_id,
        related_group_id,
        related_user_id
      });

      return NextResponse.json({ notification });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Error processing notification request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}