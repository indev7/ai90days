// app/api/admin/logout/route.js
import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ ok: true, message: 'Logged out successfully' });
  
  // Clear the admin auth cookie
  response.cookies.set('admin_auth', '', {
    maxAge: 0,
    path: '/',
  });

  return response;
}
