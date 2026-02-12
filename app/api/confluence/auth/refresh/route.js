import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  clearConfluenceSessionCookies,
  refreshConfluenceAccessToken,
  setConfluenceSessionCookies,
} from '@/lib/confluenceOAuth';

/**
 * POST handler to refresh Confluence access token using refresh token
 * @param {Request} request - Next.js request object
 * @returns {Promise<NextResponse>} JSON response with success or error
 */
export async function POST(request) {
  const cookieStore = await cookies();
  try {
    const refreshToken = cookieStore.get('confluence_refresh_token')?.value;
    const cloudId = cookieStore.get('confluence_cloud_id')?.value || null;

    if (!refreshToken) {
      return NextResponse.json(
        { error: 'No refresh token available' },
        { status: 401 }
      );
    }

    const tokenData = await refreshConfluenceAccessToken(refreshToken);

    setConfluenceSessionCookies(cookieStore, {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || refreshToken,
      cloudId,
    });

    return NextResponse.json({ success: true, message: 'Token refreshed successfully' });
  } catch (error) {
    if (error.message === 'TOKEN_REFRESH_FAILED') {
      clearConfluenceSessionCookies(cookieStore);
      return NextResponse.json(
        { error: 'Token refresh failed', requiresReauth: true },
        { status: 401 }
      );
    }
    console.error('Error refreshing Confluence token:', error);
    return NextResponse.json(
      { error: 'Failed to refresh token' },
      { status: 500 }
    );
  }
}
