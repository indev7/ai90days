import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * GET handler to initiate Jira OAuth 2.0 authentication flow
 * @param {Request} request - Next.js request object
 * @returns {Promise<NextResponse>} Redirect to Atlassian OAuth page
 */
export async function GET(request) {
  try {
    const jiraClientId = process.env.JIRA_CLIENT_ID;
    const jiraRedirectUri = process.env.JIRA_REDIRECT_URI || `${process.env.NEXTAUTH_URL}/api/jira/auth/callback`;

    if (!jiraClientId) {
      return NextResponse.json(
        { error: 'Jira OAuth not configured. Please set JIRA_CLIENT_ID in environment variables.' },
        { status: 500 }
      );
    }

    // Generate a random state for CSRF protection
    const state = Math.random().toString(36).substring(7);

    // Store state in cookie for verification
    const cookieStore = await cookies();
    cookieStore.set('jira_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/'
    });

    // Jira OAuth 2.0 (3LO) authorization URL
    const authUrl = new URL('https://auth.atlassian.com/authorize');
    authUrl.searchParams.append('audience', 'api.atlassian.com');
    authUrl.searchParams.append('client_id', jiraClientId);
    authUrl.searchParams.append('scope', 'read:jira-work write:jira-work read:jira-user offline_access');
    authUrl.searchParams.append('redirect_uri', jiraRedirectUri);
    authUrl.searchParams.append('state', state);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('prompt', 'consent');

    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error('Error initiating Jira OAuth:', error);
    return NextResponse.json(
      { error: 'Failed to initiate Jira authentication' },
      { status: 500 }
    );
  }
}
