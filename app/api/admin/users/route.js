// app/api/admin/users/route.js
import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/adminAuth';
import { getAllUsers } from '@/lib/db';

export async function GET(request) {
  // Check admin authentication
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json(
      { error: 'Unauthorized. Please login as admin.' },
      { status: 401 }
    );
  }

  try {
    // Fetch all users from database
    const users = await getAllUsers();
    
    return NextResponse.json({
      success: true,
      count: users.length,
      users: users
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Server error while fetching users' },
      { status: 500 }
    );
  }
}
