import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { searchUsers, all, getUserById } from '@/lib/pgdb';

export async function GET(request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const listAll = searchParams.get('all') === 'true';
    const limit = parseInt(searchParams.get('limit') || '10');

    // If requesting all users, check if user is Admin
    if (listAll) {
      const currentUser = await getUserById(parseInt(session.sub));
      if (!currentUser || currentUser.role !== 'Admin') {
        return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
      }

      // Fetch all users for Admin
      const allUsers = await all(`
        SELECT id, username, display_name, email, first_name, last_name,
               profile_picture_url, role, auth_provider, created_at
        FROM users
        ORDER BY created_at DESC
      `);

      return NextResponse.json({ users: allUsers });
    }

    // Regular user search
    if (!query || query.trim().length < 2) {
      return NextResponse.json({ users: [] });
    }

    const users = await searchUsers(query.trim(), limit);
    
    // Remove sensitive information and return safe user data
    const safeUsers = users.map(user => ({
      id: user.id,
      display_name: user.display_name,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      profile_picture_url: user.profile_picture_url
    }));

    return NextResponse.json({ users: safeUsers });
  } catch (error) {
    console.error('Error searching users:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}