import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * POST handler to refresh Jira access token using refresh token
 * @param {Request} request - Next.js request object
 * @returns {Promise<NextResponse>} JSON response with success or error
 */
export async function POST(request) {
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get('jira_refresh_token')?.value;

    if (!refreshToken) {
      return NextResponse.json(
        { error: 'No refresh token available' },
        { status: 401 }
      );
    }

    // Refresh the access token
    const tokenResponse = await fetch('https://auth.atlassian.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: process.env.JIRA_CLIENT_ID,
        client_secret: process.env.JIRA_CLIENT_SECRET,
        refresh_token: refreshToken,
      }),
    });

    if (!tokenResponse.ok) {
      console.error('Token refresh failed');

      // Clear invalid tokens
      cookieStore.delete('jira_access_token');
      cookieStore.delete('jira_refresh_token');
      cookieStore.delete('jira_cloud_id');

      return NextResponse.json(
        { error: 'Token refresh failed', requiresReauth: true },
        { status: 401 }
      );
    }

    const tokenData = await tokenResponse.json();

    // Update access token
    cookieStore.set('jira_access_token', tokenData.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: tokenData.expires_in || 3600,
      path: '/'
    });

    // Update refresh token if provided
    if (tokenData.refresh_token) {
      cookieStore.set('jira_refresh_token', tokenData.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 90 * 24 * 60 * 60,
        path: '/'
      });
    }

    return NextResponse.json({ success: true, message: 'Token refreshed successfully' });
  } catch (error) {
    console.error('Error refreshing Jira token:', error);
    return NextResponse.json(
      { error: 'Failed to refresh token' },
      { status: 500 }
    );
  }
}
