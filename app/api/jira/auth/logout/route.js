import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { clearJiraSessionCookies, clearJiraStateCookie } from '@/lib/jiraOAuth';

/**
 * POST handler to logout from Jira - clears all auth cookies
 * @param {Request} request - Next.js request object
 * @returns {Promise<NextResponse>} JSON response with success message
 */
export async function POST(request) {
  try {
    const cookieStore = await cookies();

    // Clear all Jira-related cookies
    clearJiraSessionCookies(cookieStore);
    clearJiraStateCookie(cookieStore);

    return NextResponse.json({ success: true, message: 'Logged out from Jira' });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to logout from Jira' },
      { status: 500 }
    );
  }
}
