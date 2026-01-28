import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * GET handler for OAuth callback - exchanges code for tokens
 * @param {Request} request - Next.js request object with OAuth code and state
 * @returns {Promise<NextResponse>} Redirect to Jira page with success/error status
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/jira?error=access_denied`);
    }

    if (!code) {
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/jira?error=missing_code`);
    }

    // Verify state to prevent CSRF
    const cookieStore = await cookies();
    const storedState = cookieStore.get('jira_oauth_state')?.value;

    if (!storedState || storedState !== state) {
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/jira?error=invalid_state`);
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://auth.atlassian.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: process.env.JIRA_CLIENT_ID,
        client_secret: process.env.JIRA_CLIENT_SECRET,
        code: code,
        redirect_uri: process.env.JIRA_REDIRECT_URI || `${process.env.NEXTAUTH_URL}/api/jira/auth/callback`,
      }),
    });

    if (!tokenResponse.ok) {
      console.error('Token exchange failed');
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/jira?error=token_exchange_failed`);
    }

    const tokenData = await tokenResponse.json();

    // Get accessible resources (Jira sites)
    const resourcesResponse = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: 'application/json',
      },
    });

    let cloudId = null;
    if (resourcesResponse.ok) {
      const resources = await resourcesResponse.json();
      if (resources.length > 0) {
        cloudId = resources[0].id;
      }
    }

    // Store tokens in cookies (set to 90 days to persist, refresh handles token renewal)
    cookieStore.set('jira_access_token', tokenData.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 90 * 24 * 60 * 60, // 90 days
      path: '/'
    });

    if (tokenData.refresh_token) {
      cookieStore.set('jira_refresh_token', tokenData.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 90 * 24 * 60 * 60, // 90 days
        path: '/'
      });
    }

    if (cloudId) {
      cookieStore.set('jira_cloud_id', cloudId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 90 * 24 * 60 * 60, // 90 days
        path: '/'
      });
    }

    // Clean up state cookie
    cookieStore.delete('jira_oauth_state');

    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/jira?success=true`);
  } catch (error) {
    console.error('Error in Jira OAuth callback:', error);
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/jira?error=callback_failed`);
  }
}
