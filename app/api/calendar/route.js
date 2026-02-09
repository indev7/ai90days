import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { get, run } from '@/lib/pgdb';

export async function GET(request) {
  try {
    const session = await verifySession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.userId;

    // Get user's Microsoft access token from database
    const user = await get(`
      SELECT microsoft_access_token, microsoft_refresh_token, microsoft_token_expires_at
      FROM users
      WHERE id = ?
    `, [userId]);

    if (!user || !user.microsoft_access_token) {
      return NextResponse.json({ error: 'Microsoft account not linked' }, { status: 400 });
    }

    // Check if token is expired and refresh if needed
    let accessToken = user.microsoft_access_token;
    const now = Date.now();
    const expiresAt = user.microsoft_token_expires_at ? new Date(user.microsoft_token_expires_at).getTime() : 0;

    if (expiresAt <= now && user.microsoft_refresh_token) {
      console.log('[Calendar API] 🔄 Access token expired, refreshing...');
      
      const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: process.env.MICROSOFT_CLIENT_ID,
          client_secret: process.env.MICROSOFT_CLIENT_SECRET,
          refresh_token: user.microsoft_refresh_token,
          grant_type: 'refresh_token',
          scope: 'openid profile email User.Read Calendars.Read Mail.ReadBasic Mail.Read offline_access',
        }),
      });

      if (!tokenResponse.ok) {
        console.error('[Calendar API] ❌ Failed to refresh token:', await tokenResponse.text());
        return NextResponse.json({ error: 'Failed to refresh access token' }, { status: 401 });
      }

      const tokenData = await tokenResponse.json();
      accessToken = tokenData.access_token;

      // Update tokens in database
      const newExpiresAt = new Date(now + tokenData.expires_in * 1000).toISOString();
      await run(`
        UPDATE users
        SET microsoft_access_token = ?,
            microsoft_refresh_token = ?,
            microsoft_token_expires_at = ?
        WHERE id = ?
      `, [tokenData.access_token, tokenData.refresh_token || user.microsoft_refresh_token, newExpiresAt, userId]);

      console.log('[Calendar API] ✅ Token refreshed successfully');
    }

    // Calculate date range for current quarter
    const now_date = new Date();
    const currentMonth = now_date.getMonth();
    const currentYear = now_date.getFullYear();
    const quarterStartMonth = Math.floor(currentMonth / 3) * 3;
    
    const startDate = new Date(currentYear, quarterStartMonth, 1);
    const endDate = new Date(currentYear, quarterStartMonth + 3, 0, 23, 59, 59);

    const startDateTime = startDate.toISOString();
    const endDateTime = endDate.toISOString();

    console.log(`[Calendar API] 🗓️  Fetching calendar events for user ${userId} from ${startDateTime} to ${endDateTime}`);

    // Fetch calendar events from Microsoft Graph API
    const calendarResponse = await fetch(
      `https://graph.microsoft.com/v1.0/me/calendarview?startDateTime=${startDateTime}&endDateTime=${endDateTime}&$select=subject,start,end&$orderby=start/dateTime&$top=100`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Prefer': 'outlook.timezone="UTC"',
        },
      }
    );

    if (!calendarResponse.ok) {
      const errorText = await calendarResponse.text();
      console.error('[Calendar API] ❌ Failed to fetch calendar events:', errorText);
      return NextResponse.json({ error: 'Failed to fetch calendar events' }, { status: calendarResponse.status });
    }

    const calendarData = await calendarResponse.json();
    console.log(`[Calendar API] ✅ Successfully fetched ${calendarData.value?.length || 0} calendar events from Microsoft Graph API`);

    // Transform the data to only include title, start time, and end time
    const events = calendarData.value.map(event => ({
      title: event.subject,
      startTime: event.start.dateTime,
      endTime: event.end.dateTime,
      timeZone: event.start.timeZone || 'UTC',
    }));

    return NextResponse.json({ 
      events,
      quarter: {
        start: startDateTime,
        end: endDateTime
      }
    });
  } catch (error) {
    console.error('[Calendar API] ❌ Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
