import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  getConfluenceOAuthConfig,
  setConfluenceReturnToCookie,
  setConfluenceStateCookie
} from '@/lib/confluenceOAuth';

/**
 * GET handler to initiate Confluence OAuth 2.0 authentication flow
 * @param {Request} request - Next.js request object
 * @returns {Promise<NextResponse>} Redirect to Atlassian OAuth page
 */
export async function GET(request) {
  try {
    const { clientId, redirectUri } = getConfluenceOAuthConfig();
    const { searchParams } = new URL(request.url);
    const returnTo = searchParams.get('returnTo');

    const state = crypto.randomUUID();
    const cookieStore = await cookies();
    setConfluenceStateCookie(cookieStore, state);
    if (returnTo) {
      setConfluenceReturnToCookie(cookieStore, returnTo);
    }

    const authUrl = new URL('https://auth.atlassian.com/authorize');
    authUrl.searchParams.append('audience', 'api.atlassian.com');
    authUrl.searchParams.append('client_id', clientId);
    authUrl.searchParams.append(
      'scope',
      'search:confluence read:confluence-content.summary read:confluence-space.summary offline_access'
    );
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('state', state);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('prompt', 'consent');

    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error('Error initiating Confluence OAuth:', error);
    if (error.message === 'Confluence OAuth is not configured') {
      return NextResponse.json(
        {
          error:
            'Confluence OAuth not configured. Please set CONFLUENCE_CLIENT_ID and CONFLUENCE_CLIENT_SECRET.'
        },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to initiate Confluence authentication' },
      { status: 500 }
    );
  }
}
