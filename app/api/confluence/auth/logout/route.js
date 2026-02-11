import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { clearConfluenceSessionCookies, clearConfluenceStateCookie, clearConfluenceReturnToCookie } from '@/lib/confluenceOAuth';

/**
 * POST handler to log out of Confluence and clear session cookies
 * @returns {Promise<NextResponse>} JSON response with success status
 */
export async function POST() {
  try {
    const cookieStore = await cookies();
    clearConfluenceSessionCookies(cookieStore);
    clearConfluenceStateCookie(cookieStore);
    clearConfluenceReturnToCookie(cookieStore);

    return NextResponse.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Error logging out of Confluence:', error);
    return NextResponse.json(
      { error: 'Failed to log out' },
      { status: 500 }
    );
  }
}
