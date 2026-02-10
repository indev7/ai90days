import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getJiraOAuthConfig, setJiraReturnToCookie, setJiraStateCookie } from '@/lib/jiraOAuth';

/**
 * GET handler to initiate Jira OAuth 2.0 authentication flow
 * @param {Request} request - Next.js request object
 * @returns {Promise<NextResponse>} Redirect to Atlassian OAuth page
 */
export async function GET(request) {
  try {
    const { clientId, redirectUri } = getJiraOAuthConfig();
    const { searchParams } = new URL(request.url);
    const returnTo = searchParams.get('returnTo');

    // Generate a random state for CSRF protection
    const state = crypto.randomUUID();

    // Store state in cookie for verification
    const cookieStore = await cookies();
    setJiraStateCookie(cookieStore, state);
    if (returnTo) {
      setJiraReturnToCookie(cookieStore, returnTo);
    }

    // Jira OAuth 2.0 (3LO) authorization URL
    const authUrl = new URL('https://auth.atlassian.com/authorize');
    authUrl.searchParams.append('audience', 'api.atlassian.com');
    authUrl.searchParams.append('client_id', clientId);
    authUrl.searchParams.append('scope', 'read:jira-work write:jira-work read:jira-user offline_access');
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('state', state);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('prompt', 'consent');

    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error('Error initiating Jira OAuth:', error);
    if (error.message === 'Jira OAuth is not configured') {
      return NextResponse.json(
        { error: 'Jira OAuth not configured. Please set JIRA_CLIENT_ID and JIRA_CLIENT_SECRET.' },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to initiate Jira authentication' },
      { status: 500 }
    );
  }
}
