const JIRA_AUTH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 1 week
const JIRA_STATE_COOKIE_MAX_AGE = 10 * 60; // 10 minutes
const JIRA_RETURN_TO_COOKIE = 'jira_oauth_return_to';

function getBaseCookieOptions(maxAge) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge,
    path: '/',
  };
}

export function getJiraRedirectUri() {
  return process.env.JIRA_REDIRECT_URI || `${process.env.NEXTAUTH_URL}/api/jira/auth/callback`;
}

export function getJiraOAuthConfig() {
  const clientId = process.env.JIRA_CLIENT_ID;
  const clientSecret = process.env.JIRA_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Jira OAuth is not configured');
  }

  return {
    clientId,
    clientSecret,
    redirectUri: getJiraRedirectUri(),
  };
}

export function setJiraStateCookie(cookieStore, state) {
  cookieStore.set('jira_oauth_state', state, getBaseCookieOptions(JIRA_STATE_COOKIE_MAX_AGE));
}

export function setJiraReturnToCookie(cookieStore, returnTo) {
  if (!returnTo) return;
  cookieStore.set(JIRA_RETURN_TO_COOKIE, returnTo, getBaseCookieOptions(JIRA_STATE_COOKIE_MAX_AGE));
}

export function clearJiraStateCookie(cookieStore) {
  cookieStore.delete('jira_oauth_state');
}

export function clearJiraReturnToCookie(cookieStore) {
  cookieStore.delete(JIRA_RETURN_TO_COOKIE);
}

export function clearJiraSessionCookies(cookieStore) {
  cookieStore.delete('jira_access_token');
  cookieStore.delete('jira_refresh_token');
  cookieStore.delete('jira_cloud_id');
  cookieStore.delete('jira_site_url');
}

export function setJiraSessionCookies(cookieStore, { accessToken, refreshToken, cloudId, siteUrl }) {
  const options = getBaseCookieOptions(JIRA_AUTH_COOKIE_MAX_AGE);

  if (accessToken) {
    cookieStore.set('jira_access_token', accessToken, options);
  }

  if (refreshToken) {
    cookieStore.set('jira_refresh_token', refreshToken, options);
  }

  if (cloudId) {
    cookieStore.set('jira_cloud_id', cloudId, options);
  }

  if (siteUrl) {
    cookieStore.set('jira_site_url', siteUrl, options);
  }
}

export async function exchangeJiraCodeForToken(code) {
  const { clientId, clientSecret, redirectUri } = getJiraOAuthConfig();

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

export async function refreshJiraAccessToken(refreshToken) {
  const { clientId, clientSecret } = getJiraOAuthConfig();

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
