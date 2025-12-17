import { cookies } from 'next/headers';

/**
 * Convert Atlassian Document Format (ADF) to plain text
 * @param {Object|string} adf - ADF object or plain string
 * @returns {string} Plain text representation
 */
function adfToText(adf) {
  if (!adf || typeof adf === 'string') {
    return adf || '';
  }

  if (adf.type === 'doc' && adf.content) {
    return adf.content.map(node => {
      if (node.type === 'paragraph' && node.content) {
        return node.content.map(item => item.text || '').join('');
      }
      if (node.type === 'text') {
        return node.text || '';
      }
      return '';
    }).filter(text => text).join('\n');
  }

  return '';
}

/**
 * Get Jira authentication tokens from cookies
 * @returns {Promise<Object>} Auth object with accessToken, cloudId, refreshToken, isAuthenticated
 */
export async function getJiraAuth() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('jira_access_token')?.value;
  const cloudId = cookieStore.get('jira_cloud_id')?.value;
  const refreshToken = cookieStore.get('jira_refresh_token')?.value;

  return {
    accessToken,
    cloudId,
    refreshToken,
    isAuthenticated: !!accessToken && !!cloudId
  };
}

/**
 * Make an authenticated request to Jira API
 * @param {string} endpoint - API endpoint path or full URL
 * @param {Object} options - Fetch options (method, headers, body, etc.)
 * @returns {Promise<Response>} Fetch response object
 * @throws {Error} If not authenticated or request fails
 */
export async function jiraFetch(endpoint, options = {}) {
  const { accessToken, cloudId, isAuthenticated } = await getJiraAuth();

  if (!isAuthenticated) {
    throw new Error('Not authenticated with Jira');
  }

  const baseUrl = `https://api.atlassian.com/ex/jira/${cloudId}`;
  const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (response.status === 401) {
    throw new Error('UNAUTHORIZED');
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Jira API error:', response.status, response.statusText);
    throw new Error(`Jira API error: ${response.status}`);
  }

  return response;
}

/**
 * Attempt to refresh token if request fails with 401
 * @returns {Promise<boolean>} True if refresh successful, false otherwise
 */
export async function refreshJiraToken() {
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get('jira_refresh_token')?.value;

    if (!refreshToken) {
      return false;
    }

    // Refresh the access token
    const tokenResponse = await fetch('https://auth.atlassian.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: process.env.JIRA_CLIENT_ID,
        client_secret: process.env.JIRA_CLIENT_SECRET,
        refresh_token: refreshToken,
      }),
    });

    if (!tokenResponse.ok) {
      console.error('Token refresh failed');

      // Clear invalid tokens
      cookieStore.delete('jira_access_token');
      cookieStore.delete('jira_refresh_token');
      cookieStore.delete('jira_cloud_id');

      return false;
    }

    const tokenData = await tokenResponse.json();

    // Update access token (set to 90 days to persist)
    cookieStore.set('jira_access_token', tokenData.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 90 * 24 * 60 * 60, // 90 days
      path: '/'
    });

    // Update refresh token if provided
    if (tokenData.refresh_token) {
      cookieStore.set('jira_refresh_token', tokenData.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 90 * 24 * 60 * 60,
        path: '/'
      });
    }

    return true;
  } catch (error) {
    console.error('Error refreshing token');
    return false;
  }
}

/**
 * Make a Jira API request with automatic token refresh on 401
 * @param {string} endpoint - API endpoint path or full URL
 * @param {Object} options - Fetch options (method, headers, body, etc.)
 * @returns {Promise<Response>} Fetch response object
 * @throws {Error} If authentication fails or request fails after retry
 */
export async function jiraFetchWithRetry(endpoint, options = {}) {
  try {
    return await jiraFetch(endpoint, options);
  } catch (error) {
    if (error.message === 'UNAUTHORIZED') {
      // Try to refresh token
      const refreshed = await refreshJiraToken();
      if (refreshed) {
        // Retry the request
        return await jiraFetch(endpoint, options);
      }
    }
    throw error;
  }
}

/**
 * Parse Jira issue to a simplified format
 * @param {Object} issue - Raw Jira issue object from API
 * @returns {Object|null} Simplified issue object or null if parsing fails
 */
export function parseJiraIssue(issue) {
  // Safety check for undefined or malformed issue
  if (!issue || !issue.fields) {
    console.error('Invalid issue format');
    return null;
  }

  try {
    return {
      id: issue.id || '',
      key: issue.key || '',
      summary: issue.fields.summary || 'No summary',
      description: adfToText(issue.fields.description),
      status: issue.fields.status?.name || 'Unknown',
      statusCategory: issue.fields.status?.statusCategory?.name || 'unknown',
      priority: issue.fields.priority?.name || 'None',
      assignee: issue.fields.assignee ? {
        displayName: issue.fields.assignee.displayName || 'Unknown',
        accountId: issue.fields.assignee.accountId || '',
        avatarUrls: issue.fields.assignee.avatarUrls || {},
      } : null,
      reporter: issue.fields.reporter ? {
        displayName: issue.fields.reporter.displayName || 'Unknown',
        accountId: issue.fields.reporter.accountId || '',
        avatarUrls: issue.fields.reporter.avatarUrls || {},
      } : null,
      issueType: issue.fields.issuetype?.name || 'Unknown',
      issueTypeIconUrl: issue.fields.issuetype?.iconUrl || '',
      project: {
        key: issue.fields.project?.key || '',
        name: issue.fields.project?.name || 'Unknown Project',
      },
      created: issue.fields.created || '',
      updated: issue.fields.updated || '',
      labels: issue.fields.labels || [],
      url: issue.self || '',
    };
  } catch (error) {
    console.error('Error parsing issue');
    return null;
  }
}

/**
 * Middleware to check Jira authentication
 * @param {Request} request - Next.js request object
 * @returns {Promise<Object>} Object with authenticated status and optional error
 */
export async function requireJiraAuth(request) {
  const { isAuthenticated } = await getJiraAuth();

  if (!isAuthenticated) {
    return {
      authenticated: false,
      error: 'Not authenticated with Jira. Please login first.',
    };
  }

  return { authenticated: true };
}
