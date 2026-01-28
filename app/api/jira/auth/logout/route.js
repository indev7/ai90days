import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDatabase } from '@/lib/pgdb';
import { getSession } from '@/lib/auth';

/**
 * POST handler to logout from Jira - clears all auth tokens from database
 * @param {Request} request - Next.js request object
 * @returns {Promise<NextResponse>} JSON response with success message
 */
export async function POST(request) {
  try {
    const session = await getSession();
    if (!session || !session.sub) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const userId = parseInt(session.sub);
    const db = await getDatabase();

    // Clear all Jira tokens from database for this user
    await db.query(
      `UPDATE users 
       SET jira_access_token = NULL,
           jira_refresh_token = NULL,
           jira_cloud_id = NULL,
           jira_token_expires_at = NULL
       WHERE id = $1`,
      [userId]
    );

    const cookieStore = await cookies();
    // Clean up any legacy cookies
    cookieStore.delete('jira_oauth_state');

    return NextResponse.json({ success: true, message: 'Logged out from Jira' });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Failed to logout from Jira' },
      { status: 500 }
    );
  }
}
