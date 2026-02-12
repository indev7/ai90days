import { cookies } from 'next/headers';
import {
  clearJiraSessionCookies,
  refreshJiraAccessToken,
  setJiraSessionCookies,
} from '@/lib/jiraOAuth';

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
  let accessToken = cookieStore.get('jira_access_token')?.value;
  const cloudId = cookieStore.get('jira_cloud_id')?.value;
  const refreshToken = cookieStore.get('jira_refresh_token')?.value;
  const siteUrl = cookieStore.get('jira_site_url')?.value || null;

  if (!accessToken && refreshToken) {
    try {
      const tokenData = await refreshJiraAccessToken(refreshToken);
      accessToken = tokenData.access_token;
      setJiraSessionCookies(cookieStore, {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || refreshToken,
        cloudId,
        siteUrl,
      });
    } catch (error) {
      if (error.message === 'TOKEN_REFRESH_FAILED') {
        clearJiraSessionCookies(cookieStore);
      } else {
        console.error('Error refreshing Jira access token in getJiraAuth');
      }
    }
  }

  return {
    accessToken,
    cloudId,
    refreshToken,
    siteUrl,
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
      let errorText = '';
      let errorData = null;
      
      try {
        errorText = await response.text();
        // Try to parse as JSON for structured error
        try {
          errorData = JSON.parse(errorText);
        } catch {
          // Not JSON, use text as-is
        }
      } catch (readError) {
        errorText = 'Unable to read error response';
      }

      console.error('Jira API error:', response.status, response.statusText, errorText);
      
      // Create a structured error object
      const errorInfo = {
        status: response.status,
        statusText: response.statusText,
        errorMessages: errorData?.errorMessages || [],
        errors: errorData?.errors || {},
        rawError: errorText.substring(0, 500) // Limit error text length
      };
      
      // Throw with structured error that can be caught and formatted
      const error = new Error(`Jira API error: ${response.status} ${response.statusText}`);
      error.jiraError = errorInfo;
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
export async function refreshJiraToken() {
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get('jira_refresh_token')?.value;
    const cloudId = cookieStore.get('jira_cloud_id')?.value || null;

    if (!refreshToken) {
      return false;
    }

    const tokenData = await refreshJiraAccessToken(refreshToken);
    setJiraSessionCookies(cookieStore, {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || refreshToken,
      cloudId,
    });

    return true;
  } catch (error) {
    if (error.message === 'TOKEN_REFRESH_FAILED') {
      const cookieStore = await cookies();
      clearJiraSessionCookies(cookieStore);
      return false;
    }
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
export function parseJiraIssue(issue, options = {}) {
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

    const safeSiteUrl = typeof options?.siteUrl === 'string'
      ? options.siteUrl.replace(/\/+$/, '')
      : '';
    const browseUrl = safeSiteUrl && issue.key ? `${safeSiteUrl}/browse/${issue.key}` : '';

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
      dueDate: issue.fields.duedate || '',
      created: issue.fields.created || '',
      updated: issue.fields.updated || '',
      labels: issue.fields.labels || [],
      url: issue.self || '',
      browseUrl,
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
