const CONFLUENCE_AUTH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 1 week
const CONFLUENCE_STATE_COOKIE_MAX_AGE = 10 * 60; // 10 minutes
const CONFLUENCE_RETURN_TO_COOKIE = 'confluence_oauth_return_to';

function getBaseCookieOptions(maxAge) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge,
    path: '/',
  };
}

export function getConfluenceRedirectUri() {
  return process.env.CONFLUENCE_REDIRECT_URI || `${process.env.NEXTAUTH_URL}/api/confluence/auth/callback`;
}

export function getConfluenceOAuthConfig() {
  const clientId = process.env.CONFLUENCE_CLIENT_ID;
  const clientSecret = process.env.CONFLUENCE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Confluence OAuth is not configured');
  }

  return {
    clientId,
    clientSecret,
    redirectUri: getConfluenceRedirectUri(),
  };
}

export function setConfluenceStateCookie(cookieStore, state) {
  cookieStore.set('confluence_oauth_state', state, getBaseCookieOptions(CONFLUENCE_STATE_COOKIE_MAX_AGE));
}

export function setConfluenceReturnToCookie(cookieStore, returnTo) {
  if (!returnTo) return;
  cookieStore.set(CONFLUENCE_RETURN_TO_COOKIE, returnTo, getBaseCookieOptions(CONFLUENCE_STATE_COOKIE_MAX_AGE));
}

export function clearConfluenceStateCookie(cookieStore) {
  cookieStore.delete('confluence_oauth_state');
}

export function clearConfluenceReturnToCookie(cookieStore) {
  cookieStore.delete(CONFLUENCE_RETURN_TO_COOKIE);
}

export function clearConfluenceSessionCookies(cookieStore) {
  cookieStore.delete('confluence_access_token');
  cookieStore.delete('confluence_refresh_token');
  cookieStore.delete('confluence_cloud_id');
  cookieStore.delete('confluence_site_url');
}

export function setConfluenceSessionCookies(cookieStore, { accessToken, refreshToken, cloudId, siteUrl }) {
  const options = getBaseCookieOptions(CONFLUENCE_AUTH_COOKIE_MAX_AGE);

  if (accessToken) {
    cookieStore.set('confluence_access_token', accessToken, options);
  }

  if (refreshToken) {
    cookieStore.set('confluence_refresh_token', refreshToken, options);
  }

  if (cloudId) {
    cookieStore.set('confluence_cloud_id', cloudId, options);
  }

  if (siteUrl) {
    cookieStore.set('confluence_site_url', siteUrl, options);
  }
}

export async function exchangeConfluenceCodeForToken(code) {
  const { clientId, clientSecret, redirectUri } = getConfluenceOAuthConfig();

  const tokenResponse = await fetch('https://auth.atlassian.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error('TOKEN_EXCHANGE_FAILED');
  }

  return tokenResponse.json();
}

export async function refreshConfluenceAccessToken(refreshToken) {
  const { clientId, clientSecret } = getConfluenceOAuthConfig();

  const tokenResponse = await fetch('https://auth.atlassian.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error('TOKEN_REFRESH_FAILED');
  }

  return tokenResponse.json();
}

export async function getAccessibleResources(accessToken) {
  const response = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    return [];
  }

  return response.json();
}

export function selectConfluenceResource(resources) {
  if (!Array.isArray(resources) || resources.length === 0) return null;
  const scopesToMatch = new Set([
    'search:confluence',
    'read:confluence-content.summary',
    'read:confluence-space.summary',
    'read:content-details:confluence'
  ]);

  const match = resources.find((resource) =>
    Array.isArray(resource?.scopes) && resource.scopes.some((scope) => scopesToMatch.has(scope))
  );
  return match || resources[0] || null;
}
