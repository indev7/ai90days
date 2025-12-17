import { NextResponse } from 'next/server';
import { requireJiraAuth, jiraFetchWithRetry, parseJiraIssue } from '@/lib/jiraAuth';

/**
 * Sanitize JQL values to prevent injection attacks
 * @param {string} value - Input value to sanitize
 * @returns {string} Sanitized value
 */
function sanitizeJqlValue(value) {
  if (!value) return '';
  // Remove quotes, backslashes and other special chars that could break JQL
  return value.replace(/["'\\;()]/g, '').trim();
}

/**
 * GET handler to fetch and filter Jira tickets
 * @param {Request} request - Next.js request object with query parameters
 * @returns {Promise<NextResponse>} JSON response with tickets array
 */
export async function GET(request) {
  try {
    // Check authentication
    const authCheck = await requireJiraAuth(request);
    if (!authCheck.authenticated) {
      return NextResponse.json({ error: authCheck.error }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    // Sanitize inputs to prevent JQL injection
    const projectKey = sanitizeJqlValue(searchParams.get('project'));
    const status = sanitizeJqlValue(searchParams.get('status'));
    const assignee = searchParams.get('assignee');
    // Ensure numeric values are within safe limits (default 20 per page)
    const maxResults = Math.min(100, Math.max(1, parseInt(searchParams.get('maxResults') || '20')));
    const startAt = Math.max(0, parseInt(searchParams.get('startAt') || '0'));

    // Build JQL query with sanitized inputs
    let jql = '';
    const conditions = [];

    if (projectKey) {
      conditions.push(`project = ${projectKey}`);
    }
    if (status) {
      conditions.push(`status = "${status}"`);
    }
    if (assignee === 'currentUser()') {
      conditions.push('assignee = currentUser()');
    } else if (assignee) {
      conditions.push(`assignee = "${sanitizeJqlValue(assignee)}"`);
    }

    jql = conditions.length > 0 ? conditions.join(' AND ') : 'ORDER BY updated DESC';
    if (!jql.includes('ORDER BY')) {
      jql += ' ORDER BY updated DESC';
    }

    // The /search/jql endpoint has limitations, so we need to make multiple calls if needed
    let allIssues = [];
    let fetchedAll = false;
    let currentStart = 0;
    const batchSize = 100;

    // Fetch all issues in batches
    while (!fetchedAll && currentStart < 1000) {
      const params = new URLSearchParams({
        jql: jql,
        startAt: currentStart.toString(),
        maxResults: batchSize.toString(),
        fields: 'summary,status,assignee,reporter,priority,issuetype,project,created,updated,labels,description'
      });

      const response = await jiraFetchWithRetry(`/rest/api/3/search/jql?${params}`);
      const data = await response.json();
      const batch = data.issues || data.values || (Array.isArray(data) ? data : []);

      if (batch.length === 0) {
        fetchedAll = true;
      } else {
        allIssues = allIssues.concat(batch);
        currentStart += batch.length;

        // If we got fewer than requested, we've reached the end
        if (batch.length < batchSize) {
          fetchedAll = true;
        }
      }
    }

    // Parse all issues first
    const parsedIssues = allIssues.map(parseJiraIssue).filter(issue => issue !== null);

    // Apply pagination manually
    const totalCount = parsedIssues.length;
    const paginatedIssues = parsedIssues.slice(startAt, startAt + maxResults);

    return NextResponse.json({
      issues: paginatedIssues,
      total: totalCount,
      startAt: startAt,
      maxResults: maxResults,
    });
  } catch (error) {
    console.error('Error fetching Jira tickets:', error.message);

    if (error.message === 'Not authenticated with Jira') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Failed to fetch Jira tickets' },
      { status: 500 }
    );
  }
}
