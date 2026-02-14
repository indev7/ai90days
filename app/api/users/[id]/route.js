import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUserById, updateUser } from '@/lib/pgdb';

export async function PUT(request, { params }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if current user is Admin
    const currentUser = await getUserById(parseInt(session.sub));
    if (!currentUser || currentUser.role !== 'Admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Await params before accessing properties (Next.js 15+)
    const resolvedParams = await params;
    const userId = parseInt(resolvedParams.id);
    const body = await request.json();

    // Validate role if provided
    const validRoles = ['Admin', 'Owner', 'Leader', 'User'];
    if (body.role && !validRoles.includes(body.role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Prepare update data (only allow specific fields to be updated)
    const updateData = {};
    if (body.display_name !== undefined) updateData.display_name = body.display_name;
    if (body.first_name !== undefined) updateData.first_name = body.first_name;
    if (body.last_name !== undefined) updateData.last_name = body.last_name;
    if (body.role !== undefined) updateData.role = body.role;
    if (body.email !== undefined) updateData.email = body.email;

    // Update user
    const updatedUser = await updateUser(userId, updateData);

    // Remove sensitive information
    const safeUser = {
      id: updatedUser.id,
      username: updatedUser.username,
      display_name: updatedUser.display_name,
      email: updatedUser.email,
      first_name: updatedUser.first_name,
      last_name: updatedUser.last_name,
      profile_picture_url: updatedUser.profile_picture_url,
      role: updatedUser.role,
      auth_provider: updatedUser.auth_provider,
      created_at: updatedUser.created_at
    };

    return NextResponse.json({ user: safeUser });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}