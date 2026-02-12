import { cookies } from 'next/headers';
import {
  clearConfluenceSessionCookies,
  refreshConfluenceAccessToken,
  setConfluenceSessionCookies,
} from '@/lib/confluenceOAuth';

/**
 * Get Confluence authentication tokens from cookies
 * @returns {Promise<Object>} Auth object with accessToken, cloudId, refreshToken, isAuthenticated
 */
export async function getConfluenceAuth() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('confluence_access_token')?.value;
  const cloudId = cookieStore.get('confluence_cloud_id')?.value;
  const refreshToken = cookieStore.get('confluence_refresh_token')?.value;
  const siteUrl = cookieStore.get('confluence_site_url')?.value || null;

  return {
    accessToken,
    cloudId,
    refreshToken,
    siteUrl,
    isAuthenticated: !!accessToken && !!cloudId
  };
}

/**
 * Make an authenticated request to Confluence API
 * @param {string} endpoint - API endpoint path or full URL
 * @param {Object} options - Fetch options (method, headers, body, etc.)
 * @returns {Promise<Response>} Fetch response object
 * @throws {Error} If not authenticated or request fails
 */
export async function confluenceFetch(endpoint, options = {}) {
  const { accessToken, cloudId, isAuthenticated } = await getConfluenceAuth();

  if (!isAuthenticated) {
    throw new Error('Not authenticated with Confluence');
  }

  const baseUrl = `https://api.atlassian.com/ex/confluence/${cloudId}`;
  const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint}`;

  const timeout = (options.method === 'POST' || options.method === 'PUT') ? 30000 : 10000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    clearTimeout(timeoutId);

    if (response.status === 401) {
      throw new Error('UNAUTHORIZED');
    }

    if (!response.ok) {
      let errorText = '';
      let errorData = null;
      try {
        errorText = await response.text();
        try {
          errorData = JSON.parse(errorText);
        } catch {
          // ignore parse error
        }
      } catch (readError) {
        errorText = 'Unable to read error response';
      }

      console.error('Confluence API error:', response.status, response.statusText, errorText);

      const errorInfo = {
        status: response.status,
        statusText: response.statusText,
        errorMessages: errorData?.message ? [errorData.message] : [],
        errors: errorData?.errors || {},
        rawError: errorText.substring(0, 500)
      };

      const error = new Error(`Confluence API error: ${response.status} ${response.statusText}`);
      error.confluenceError = errorInfo;
      throw error;
    }

    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    throw error;
  }
}

/**
 * Attempt to refresh token if request fails with 401
 * @returns {Promise<boolean>} True if refresh successful, false otherwise
 */
export async function refreshConfluenceToken() {
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get('confluence_refresh_token')?.value;
    const cloudId = cookieStore.get('confluence_cloud_id')?.value || null;

    if (!refreshToken) {
      return false;
    }

    const tokenData = await refreshConfluenceAccessToken(refreshToken);
    setConfluenceSessionCookies(cookieStore, {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || refreshToken,
      cloudId,
    });

    return true;
  } catch (error) {
    if (error.message === 'TOKEN_REFRESH_FAILED') {
      const cookieStore = await cookies();
      clearConfluenceSessionCookies(cookieStore);
      return false;
    }
    console.error('Error refreshing Confluence token');
    return false;
  }
}

/**
 * Make a Confluence API request with automatic token refresh on 401
 * @param {string} endpoint - API endpoint path or full URL
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>} Fetch response object
 */
export async function confluenceFetchWithRetry(endpoint, options = {}) {
  try {
    return await confluenceFetch(endpoint, options);
  } catch (error) {
    if (error.message === 'UNAUTHORIZED') {
      const refreshed = await refreshConfluenceToken();
      if (refreshed) {
        return await confluenceFetch(endpoint, options);
      }
    }
    throw error;
  }
}

/**
 * Middleware to check Confluence authentication
 * @param {Request} request - Next.js request object
 * @returns {Promise<Object>} Object with authenticated status and optional error
 */
export async function requireConfluenceAuth(request) {
  const { isAuthenticated } = await getConfluenceAuth();

  if (!isAuthenticated) {
    return {
      authenticated: false,
      error: 'Not authenticated with Confluence. Please login first.',
    };
  }

  return { authenticated: true };
}
