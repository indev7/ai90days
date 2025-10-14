// app/api/admin/login/route.js
import { NextResponse } from 'next/server';
import { verifyAdminPassword } from '@/lib/adminAuth';

export async function POST(request) {
  try {
    const body = await request.json();
    const { password } = body;

    // Check if ADMIN_PW is configured
    if (!process.env.ADMIN_PW) {
      return NextResponse.json(
        { error: 'Admin panel not configured. Please set ADMIN_PW environment variable.' },
        { status: 503 }
      );
    }

    // Validate password
    if (!password || !verifyAdminPassword(password)) {
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401 }
      );
    }

    // Create response with admin cookie
    const response = NextResponse.json({ ok: true, message: 'Login successful' });
    
    // Set secure HTTP-only cookie for admin session (1 hour TTL)
    response.cookies.set('admin_auth', '1', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60, // 1 hour
      sameSite: 'lax',
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Admin login error:', error);
    return NextResponse.json(
      { error: 'Server error during login' },
      { status: 500 }
    );
  }
}
