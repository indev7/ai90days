import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  clearJiraSessionCookies,
  refreshJiraAccessToken,
  setJiraSessionCookies,
} from '@/lib/jiraOAuth';

/**
 * GET handler to check Jira authentication status
 * @param {Request} request - Next.js request object
 * @returns {Promise<NextResponse>} JSON response with authentication status
 */
export async function GET(request) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('jira_access_token')?.value;
    const cloudId = cookieStore.get('jira_cloud_id')?.value;
    const siteUrl = cookieStore.get('jira_site_url')?.value || null;
    const refreshToken = cookieStore.get('jira_refresh_token')?.value;

    if (!accessToken || !cloudId) {
      if (!refreshToken || !cloudId) {
        return NextResponse.json({
          authenticated: false,
          cloudId: null,
          siteUrl: null
        });
      }

      try {
        const tokenData = await refreshJiraAccessToken(refreshToken);

        setJiraSessionCookies(cookieStore, {
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token || refreshToken,
          cloudId,
          siteUrl,
        });

        return NextResponse.json({
          authenticated: true,
          cloudId,
          siteUrl,
          refreshed: true
        });
      } catch (error) {
        if (error.message === 'TOKEN_REFRESH_FAILED') {
          clearJiraSessionCookies(cookieStore);
          return NextResponse.json({
            authenticated: false,
            cloudId: null,
            siteUrl: null,
            requiresReauth: true
          }, { status: 401 });
        }
        throw error;
      }
    }

    return NextResponse.json({
      authenticated: true,
      cloudId: cloudId,
      siteUrl
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to check authentication status' },
      { status: 500 }
    );
  }
}
