import { cookies } from 'next/headers';
import { getDatabase } from './pgdb';
import { getSession } from './auth';

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
 * Get Jira authentication tokens from database for current user
 * @returns {Promise<Object>} Auth object with accessToken, cloudId, refreshToken, isAuthenticated, userId
 */
export async function getJiraAuth() {
  try {
    const session = await getSession();
    if (!session || !session.sub) {
      return {
        accessToken: null,
        cloudId: null,
        refreshToken: null,
        isAuthenticated: false,
        userId: null
      };
    }

    const userId = parseInt(session.sub);
    const db = await getDatabase();

    const result = await db.query(
      'SELECT jira_access_token, jira_cloud_id, jira_refresh_token FROM users WHERE id = $1',
      [userId]
    );

    if (!result.rows || result.rows.length === 0) {
      return {
        accessToken: null,
        cloudId: null,
        refreshToken: null,
        isAuthenticated: false,
        userId
      };
    }

    const user = result.rows[0];
    const accessToken = user.jira_access_token;
    const cloudId = user.jira_cloud_id;
    const refreshToken = user.jira_refresh_token;

    return {
      accessToken,
      cloudId,
      refreshToken,
      isAuthenticated: !!accessToken && !!cloudId,
      userId
    };
  } catch (error) {
    console.error('Error getting Jira auth:', error);
    return {
      accessToken: null,
      cloudId: null,
      refreshToken: null,
      isAuthenticated: false,
      userId: null
    };
  }
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

  // Set longer timeout for POST/PUT requests (30 seconds) vs GET (10 seconds)
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
      const errorText = await response.text();
      console.error('Jira API error:', response.status, response.statusText, errorText);
      throw new Error(`Jira API error: ${response.status} - ${errorText}`);
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
export async function refreshJiraToken() {
  try {
    const { refreshToken, userId } = await getJiraAuth();

    if (!refreshToken || !userId) {
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

      // Clear invalid tokens from database
      const db = await getDatabase();
      await db.query(
        `UPDATE users 
         SET jira_access_token = NULL, 
             jira_refresh_token = NULL, 
             jira_cloud_id = NULL,
             jira_token_expires_at = NULL
         WHERE id = $1`,
        [userId]
      );

      return false;
    }

    const tokenData = await tokenResponse.json();

    // Update tokens in database
    const db = await getDatabase();
    const expiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000);

    await db.query(
      `UPDATE users 
       SET jira_access_token = $1,
           jira_refresh_token = COALESCE($2, jira_refresh_token),
           jira_token_expires_at = $3
       WHERE id = $4`,
      [
        tokenData.access_token,
        tokenData.refresh_token || null,
        expiresAt,
        userId
      ]
    );

    return true;
  } catch (error) {
    console.error('Error refreshing token:', error);
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
    // Extract custom fields
    const customFields = {};
    Object.entries(issue.fields).forEach(([key, value]) => {
      if (key.startsWith('customfield_') && value !== null) {
        customFields[key] = value;
      }
    });

    // Extract permissions if available
    const permissions = issue.changelog ? {} : {};
    if (issue.operations && Array.isArray(issue.operations)) {
      // Check if 'edit' operation is available
      permissions.canEdit = issue.operations.some(op => op.id === 'edit');
    }
    if (issue.editmeta) {
      permissions.canEdit = true;
    }

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
      customFields,
      permissions,
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
