import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  clearConfluenceStateCookie,
  clearConfluenceReturnToCookie,
  exchangeConfluenceCodeForToken,
  getAccessibleResources,
  selectConfluenceResource,
  setConfluenceSessionCookies,
} from '@/lib/confluenceOAuth';

/**
 * GET handler for OAuth callback - exchanges code for tokens
 * @param {Request} request - Next.js request object with OAuth code and state
 * @returns {Promise<NextResponse>} Redirect to Confluence page with success/error status
 */
export async function GET(request) {
  const cookieStore = await cookies();
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/confluence?error=access_denied`);
    }

    if (!code) {
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/confluence?error=missing_code`);
    }

    const storedState = cookieStore.get('confluence_oauth_state')?.value;
    if (!storedState || storedState !== state) {
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/confluence?error=invalid_state`);
    }

    const tokenData = await exchangeConfluenceCodeForToken(code);
    const resources = await getAccessibleResources(tokenData.access_token);
    const resource = selectConfluenceResource(resources);
    const cloudId = resource?.id || null;
    const siteUrl = resource?.url || null;

    setConfluenceSessionCookies(cookieStore, {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      cloudId,
      siteUrl,
    });

    const returnTo = cookieStore.get('confluence_oauth_return_to')?.value;
    const safeReturnTo =
      returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')
        ? returnTo
        : '/confluence';
    const redirectUrl = `${process.env.NEXTAUTH_URL}${safeReturnTo}${
      safeReturnTo.includes('?') ? '&' : '?'
    }success=true`;
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error('Error in Confluence OAuth callback:', error);
    if (error.message === 'TOKEN_EXCHANGE_FAILED') {
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/confluence?error=token_exchange_failed`);
    }
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/confluence?error=callback_failed`);
  } finally {
    clearConfluenceStateCookie(cookieStore);
    clearConfluenceReturnToCookie(cookieStore);
  }
}
