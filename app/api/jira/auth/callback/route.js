import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDatabase } from '@/lib/pgdb';
import { getSession } from '@/lib/auth';

/**
 * GET handler for OAuth callback - exchanges code for tokens
 * @param {Request} request - Next.js request object with OAuth code and state
 * @returns {Promise<NextResponse>} Redirect to Jira page with success/error status
 */
export async function GET(request) {
  try {
    // Check if user is logged in
    const session = await getSession();
    if (!session || !session.sub) {
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/login?error=not_authenticated`);
    }

    const userId = parseInt(session.sub);

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

    // Store tokens in database for this specific user
    const db = await getDatabase();
    const expiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000);

    await db.query(
      `UPDATE users 
       SET jira_access_token = $1,
           jira_refresh_token = $2,
           jira_cloud_id = $3,
           jira_token_expires_at = $4
       WHERE id = $5`,
      [
        tokenData.access_token,
        tokenData.refresh_token || null,
        cloudId,
        expiresAt,
        userId
      ]
    );

    // Clean up state cookie
    cookieStore.delete('jira_oauth_state');

    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/jira?success=true`);
  } catch (error) {
    console.error('Error in Jira OAuth callback:', error);
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/jira?error=callback_failed`);
  }
}
