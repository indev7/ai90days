import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  clearJiraStateCookie,
  exchangeJiraCodeForToken,
  getAccessibleResources,
  setJiraSessionCookies,
} from '@/lib/jiraOAuth';

/**
 * GET handler for OAuth callback - exchanges code for tokens
 * @param {Request} request - Next.js request object with OAuth code and state
 * @returns {Promise<NextResponse>} Redirect to Jira page with success/error status
 */
export async function GET(request) {
  const cookieStore = await cookies();
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
    const storedState = cookieStore.get('jira_oauth_state')?.value;

    if (!storedState || storedState !== state) {
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/jira?error=invalid_state`);
    }

    // Exchange code for access token
    const tokenData = await exchangeJiraCodeForToken(code);

    // Get accessible resources (Jira sites)
    const resources = await getAccessibleResources(tokenData.access_token);
    const cloudId = resources.length > 0 ? resources[0].id : null;
    const siteUrl = resources.length > 0 ? resources[0].url : null;

    setJiraSessionCookies(cookieStore, {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      cloudId,
      siteUrl,
    });

    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/jira?success=true`);
  } catch (error) {
    console.error('Error in Jira OAuth callback:', error);
    if (error.message === 'TOKEN_EXCHANGE_FAILED') {
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/jira?error=token_exchange_failed`);
    }
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/jira?error=callback_failed`);
  } finally {
    clearJiraStateCookie(cookieStore);
  }
}
