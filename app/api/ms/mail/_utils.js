import { get, run } from '@/lib/pgdb';

const TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const DEFAULT_SCOPES = 'openid profile email User.Read Mail.ReadBasic offline_access';

export async function getMicrosoftAccessToken(userId, options = {}) {
  const { scopes = DEFAULT_SCOPES, logPrefix = '[MS Mail API]' } = options;

  const user = await get(`
    SELECT microsoft_access_token, microsoft_refresh_token, microsoft_token_expires_at
    FROM users
    WHERE id = ?
  `, [userId]);

  if (!user || !user.microsoft_access_token) {
    return {
      error: {
        status: 400,
        message: 'Microsoft account not linked'
      }
    };
  }

  let accessToken = user.microsoft_access_token;
  const now = Date.now();
  const expiresAt = user.microsoft_token_expires_at
    ? new Date(user.microsoft_token_expires_at).getTime()
    : 0;

  if (expiresAt <= now && user.microsoft_refresh_token) {
    console.log(`${logPrefix} 🔄 Access token expired, refreshing...`);

    const tokenResponse = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET,
        refresh_token: user.microsoft_refresh_token,
        grant_type: 'refresh_token',
        scope: scopes,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error(`${logPrefix} ❌ Failed to refresh token:`, errorText);
      return {
        error: {
          status: 401,
          message: 'Microsoft consent required for Mail.ReadBasic; please re-login.'
        }
      };
    }

    const tokenData = await tokenResponse.json();
    accessToken = tokenData.access_token;

    const newExpiresAt = new Date(now + tokenData.expires_in * 1000).toISOString();
    await run(`
      UPDATE users
      SET microsoft_access_token = ?,
          microsoft_refresh_token = ?,
          microsoft_token_expires_at = ?
      WHERE id = ?
    `, [
      tokenData.access_token,
      tokenData.refresh_token || user.microsoft_refresh_token,
      newExpiresAt,
      userId
    ]);

    console.log(`${logPrefix} ✅ Token refreshed successfully`);
  }

  return { accessToken };
}

export function coerceTop(value, fallback = 25, max = 50) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

export function normalizeCursor(cursor) {
  if (!cursor) return null;
  try {
    return decodeURIComponent(cursor);
  } catch (error) {
    return cursor;
  }
}

export function validateNextLink(nextLink) {
  try {
    const url = new URL(nextLink);
    return url.hostname.endsWith('graph.microsoft.com');
  } catch (error) {
    return false;
  }
}

export function mapGraphError(graphResponse, errorBody) {
  if (graphResponse.status === 401) {
    return {
      status: 401,
      message: 'Microsoft consent required for Mail.ReadBasic; please re-login.'
    };
  }

  if (graphResponse.status === 403) {
    return {
      status: 403,
      message: 'Admin consent may be required in this tenant.'
    };
  }

  return {
    status: graphResponse.status,
    message: errorBody?.error?.message || 'Microsoft Graph request failed.'
  };
}

export function logMailboxTelemetry({ endpoint, userId, count }) {
  console.log('[MS Mail API] 📬 Telemetry', {
    endpoint,
    userId,
    count,
    timestamp: new Date().toISOString()
  });
}
