import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * POST handler to logout from Jira - clears all auth cookies
 * @param {Request} request - Next.js request object
 * @returns {Promise<NextResponse>} JSON response with success message
 */
export async function POST(request) {
  try {
    const cookieStore = await cookies();

    // Clear all Jira-related cookies
    cookieStore.delete('jira_access_token');
    cookieStore.delete('jira_refresh_token');
    cookieStore.delete('jira_cloud_id');
    cookieStore.delete('jira_oauth_state');

    return NextResponse.json({ success: true, message: 'Logged out from Jira' });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to logout from Jira' },
      { status: 500 }
    );
  }
}
