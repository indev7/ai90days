import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * GET handler to check Confluence authentication status
 * @param {Request} request - Next.js request object
 * @returns {Promise<NextResponse>} JSON response with authentication status
 */
export async function GET(request) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('confluence_access_token')?.value;
    const cloudId = cookieStore.get('confluence_cloud_id')?.value;
    const siteUrl = cookieStore.get('confluence_site_url')?.value || null;

    if (!accessToken || !cloudId) {
      return NextResponse.json({
        authenticated: false,
        cloudId: null,
        siteUrl: null
      });
    }

    return NextResponse.json({
      authenticated: true,
      cloudId,
      siteUrl
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to check authentication status' },
      { status: 500 }
    );
  }
}
