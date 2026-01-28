import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

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

    if (!accessToken) {
      return NextResponse.json({
        authenticated: false,
        cloudId: null
      });
    }

    // Optionally verify token with Jira API
    try {
      const response = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      });

      if (response.ok) {
        const resources = await response.json();
        return NextResponse.json({
          authenticated: true,
          cloudId: cloudId,
          resources: resources
        });
      }
    } catch (verifyError) {
      // Token verification failed, but continue with basic status
    }

    return NextResponse.json({
      authenticated: true,
      cloudId: cloudId
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to check authentication status' },
      { status: 500 }
    );
  }
}
