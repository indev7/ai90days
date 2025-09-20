import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { searchUsers } from '@/lib/db';

export async function GET(request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '10');

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