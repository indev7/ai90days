import { NextResponse } from 'next/server';
import { requireJiraAuth, jiraFetchWithRetry, parseJiraIssue, getJiraAuth } from '@/lib/jiraAuth';
import { getSession } from '@/lib/auth';
import rateLimiter from '@/lib/rateLimit';
import JIRA_CONFIG from '@/lib/jiraConfig';

// API paths
const SEARCH_API_PATH = '/rest/api/3/search/jql';
const APPROX_COUNT_API_PATH = '/rest/api/3/search/approximate-count';

// Use centralized configuration
const DEFAULT_FIELDS = JIRA_CONFIG.DEFAULT_FIELDS;
const ALLOWED_DISTINCT = new Set(JIRA_CONFIG.ALLOWED_DISTINCT_FIELDS);
const JIRA_MAX_RESULTS_MIN = JIRA_CONFIG.MAX_RESULTS_MIN;
const JIRA_MAX_RESULTS_MAX = JIRA_CONFIG.MAX_RESULTS_MAX;
const MAX_DISTINCT_PAGES = JIRA_CONFIG.MAX_DISTINCT_PAGES;

function tokenDigest(token) {
  if (typeof token !== 'string') return null;
  let hash = 0;
  for (let i = 0; i < token.length; i += 1) {
    hash = (hash * 31 + token.charCodeAt(i)) >>> 0;
  }
  return `${token.length}:${hash.toString(16)}`;
}

function logJiraRequestMeta({
  apiPath,
  jql,
  fields,
  distinct,
  countOnly,
  startAt,
  maxResults,
  expand,
  nextPageToken
}) {
  const jqlPreview = typeof jql === 'string' ? jql.slice(0, 120) : '';
  const tokenPreview =
    typeof nextPageToken === 'string' && nextPageToken.length > 12
      ? `${nextPageToken.slice(0, 6)}…${nextPageToken.slice(-6)}`
      : nextPageToken || null;
  const tokenHash = tokenDigest(nextPageToken);
  console.log('[JIRA REQUEST]', {
    apiPath: apiPath || null,
    jqlPreview,
    fields: typeof fields === 'string' ? fields : null,
    distinct: distinct || null,
    countOnly: Boolean(countOnly),
    startAt: Number.isFinite(startAt) ? startAt : null,
    maxResults: Number.isFinite(maxResults) ? maxResults : null,
    expand: expand || null,
    nextPageToken: tokenPreview,
    nextPageTokenHash: tokenHash
  });
}

function logJiraMeta(label, response, data) {
  try {
    const contentLength = response?.headers?.get('content-length');
    const payloadBytes = Number.isFinite(data?.length)
      ? data.length
      : Buffer.byteLength(JSON.stringify(data ?? {}), 'utf8');
    const issues = Array.isArray(data?.issues) ? data.issues.length : 0;
    const values = Array.isArray(data?.values) ? data.values.length : 0;
    const total = Number.isFinite(data?.total) ? data.total : null;
    const maxResults = Number.isFinite(data?.maxResults) ? data.maxResults : null;
    const startAt = Number.isFinite(data?.startAt) ? data.startAt : null;
    const nextPageToken = data?.nextPageToken || null;
    const tokenPreview =
      typeof nextPageToken === 'string' && nextPageToken.length > 12
        ? `${nextPageToken.slice(0, 6)}…${nextPageToken.slice(-6)}`
        : nextPageToken || null;
    const tokenHash = tokenDigest(nextPageToken);
    const firstKey = data?.issues?.[0]?.key || '';
    const lastKey = data?.issues?.[Array.isArray(data?.issues) ? data.issues.length - 1 : 0]?.key || '';

    console.log(`[JIRA META] ${label}`, {
      total,
      maxResults,
      startAt,
      issuesCount: issues,
      valuesCount: values,
      nextPageTokenPresent: Boolean(nextPageToken),
      nextPageToken: tokenPreview,
      nextPageTokenHash: tokenHash,
      firstKey: firstKey || null,
      lastKey: lastKey || null,
      contentLength: contentLength ? Number(contentLength) : null,
      payloadBytes
    });
  } catch (error) {
    console.log('[JIRA META] log error', error?.message || error);
  }
}

function extractNumericCount(data) {
  if (!data || typeof data !== 'object') return null;
  if (Number.isFinite(data.total)) return data.total;
  if (Number.isFinite(data.count)) return data.count;
  if (Number.isFinite(data.approximateCount)) return data.approximateCount;
  return null;
}

/**
 * Safely parse JSON response with error handling
 * @param {Response} response - Fetch response object
 * @returns {Promise<Object>} Parsed JSON data
 * @throws {Error} If JSON parsing fails
 */
async function safeJsonParse(response) {
  try {
    const text = await response.text();
    if (!text || text.trim() === '') {
      throw new Error('Empty response from Jira API');
    }
    return JSON.parse(text);
  } catch (error) {
    console.error('Failed to parse Jira response:', error.message);
    throw new Error(`Invalid JSON response from Jira: ${error.message}`);
  }
}

async function fetchApproximateCount(jql) {
  try {
    const response = await jiraFetchWithRetry(APPROX_COUNT_API_PATH, {
      method: 'POST',
      body: JSON.stringify({ jql }),
    });
    const data = await safeJsonParse(response);
    const count = extractNumericCount(data);
    return Number.isFinite(count) ? count : null;
  } catch (_error) {
    return null;
  }
}

function stripOrderBy(jql) {
  return jql.replace(/\s+ORDER\s+BY\s+[\s\S]*$/i, '').trim();
}

function sanitizeJqlInput(jql) {
  if (!jql || typeof jql !== 'string') return '';
  return jql.replace(/[;]/g, ' ').trim();
}

/**
 * Validate JQL complexity to prevent DoS attacks
 * @param {string} jql - JQL query string
 * @throws {Error} If JQL is too complex
 */
function validateJqlComplexity(jql) {
  if (!jql || typeof jql !== 'string') {
    throw new Error('Invalid JQL query');
  }

  // Check length
  if (jql.length > JIRA_CONFIG.MAX_JQL_LENGTH) {
    throw new Error(`JQL query too long (max ${JIRA_CONFIG.MAX_JQL_LENGTH} characters)`);
  }

  // Count AND/OR clauses
  const andOrCount = (jql.match(/\b(AND|OR)\b/gi) || []).length;
  if (andOrCount > JIRA_CONFIG.MAX_JQL_AND_OR_CLAUSES) {
    throw new Error(`JQL query too complex (max ${JIRA_CONFIG.MAX_JQL_AND_OR_CLAUSES} AND/OR clauses)`);
  }

  // Count IN clauses
  const inCount = (jql.match(/\bIN\b/gi) || []).length;
  if (inCount > JIRA_CONFIG.MAX_JQL_IN_CLAUSES) {
    throw new Error(`JQL query too complex (max ${JIRA_CONFIG.MAX_JQL_IN_CLAUSES} IN clauses)`);
  }

  return true;
}

/**
 * Validate and limit field selection
 * @param {string} fields - Comma-separated field list
 * @returns {string} Validated fields string
 * @throws {Error} If too many fields requested
 */
function validateFields(fields) {
  if (!fields || typeof fields !== 'string') {
    return DEFAULT_FIELDS;
  }

  const fieldArray = fields.split(',').map(f => f.trim()).filter(Boolean);
  
  if (fieldArray.length > JIRA_CONFIG.MAX_FIELDS_COUNT) {
    throw new Error(`Too many fields requested (max ${JIRA_CONFIG.MAX_FIELDS_COUNT})`);
  }

  return fields;
}

/**
 * Check response size and truncate if needed
 * @param {Array} issues - Array of issues
 * @returns {Object} { issues, truncated, originalCount }
 */
function limitResponseSize(issues) {
  if (!Array.isArray(issues)) {
    return { issues: [], truncated: false, originalCount: 0 };
  }

  const originalCount = issues.length;
  
  if (issues.length > JIRA_CONFIG.MAX_ISSUES_PER_REQUEST) {
    return {
      issues: issues.slice(0, JIRA_CONFIG.MAX_ISSUES_PER_REQUEST),
      truncated: true,
      originalCount
    };
  }

  return { issues, truncated: false, originalCount };
}

function parseFieldSet(fields) {
  return new Set(
    String(fields || '')
      .split(',')
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean)
  );
}

function toCompactIssue(issue, fieldSet, siteUrl = '') {
  const fields = issue?.fields || {};
  const includes = (name) => fieldSet.has(name.toLowerCase());
  const safeSiteUrl = typeof siteUrl === 'string' ? siteUrl.replace(/\/+$/, '') : '';
  const compact = {
    id: issue?.id || '',
    key: issue?.key || '',
    browseUrl: safeSiteUrl && issue?.key ? `${safeSiteUrl}/browse/${issue.key}` : '',
  };

  if (includes('summary')) compact.summary = fields.summary || '';
  if (includes('status')) compact.status = fields.status?.name || '';
  if (includes('project')) {
    compact.project = {
      key: fields.project?.key || '',
      name: fields.project?.name || '',
    };
  }
  if (includes('updated')) compact.updated = fields.updated || '';
  if (includes('created')) compact.created = fields.created || '';
  if (includes('issuetype')) compact.issueType = fields.issuetype?.name || '';
  if (includes('priority')) compact.priority = fields.priority?.name || '';
  if (includes('assignee')) compact.assignee = fields.assignee?.displayName || null;
  if (includes('reporter')) compact.reporter = fields.reporter?.displayName || null;
  if (includes('labels')) compact.labels = Array.isArray(fields.labels) ? fields.labels : [];
  if (includes('description')) compact.description = fields.description || '';

  // Preserve any returned Jira custom fields so toolMode does not truncate them.
  const customFields = Object.entries(fields).reduce((acc, [key, value]) => {
    if (!key.startsWith('customfield_')) return acc;
    acc[key] = value;
    return acc;
  }, {});
  if (Object.keys(customFields).length > 0) {
    compact.customFields = customFields;
  }

  return compact;
}

export async function GET(request) {
  try {
    // Check authentication first
    const authCheck = await requireJiraAuth(request);
    if (!authCheck.authenticated) {
      return NextResponse.json({
        error: authCheck.error,
        code: 'JIRA_AUTH_REQUIRED',
        action: 'Please login at /jira'
      }, { status: 401 });
    }

    // Rate limiting check
    const session = await getSession();
    const userId = session?.sub || 'anonymous';
    
    const allowed = await rateLimiter.check(
      userId,
      'jira-query',
      {
        max: JIRA_CONFIG.RATE_LIMIT_MAX_REQUESTS,
        window: JIRA_CONFIG.RATE_LIMIT_WINDOW
      }
    );

    if (!allowed) {
      const status = rateLimiter.getStatus(userId, 'jira-query');
      return NextResponse.json({
        error: 'Rate limit exceeded',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: status.resetAt,
        remaining: 0
      }, { status: 429 });
    }

    const { searchParams } = new URL(request.url);
    const auth = await getJiraAuth();
    const jiraSiteUrl = String(
      auth?.siteUrl ||
      process.env.JIRA_BASE_URL ||
      process.env.NEXT_PUBLIC_JIRA_BASE_URL ||
      ''
    ).replace(/\/+$/, '');
    const rawJql = sanitizeJqlInput(searchParams.get('jql'));
    if (!rawJql) {
      return NextResponse.json({
        error: 'jql is required',
        code: 'INVALID_REQUEST'
      }, { status: 400 });
    }

    // Validate JQL complexity
    try {
      validateJqlComplexity(rawJql);
    } catch (error) {
      return NextResponse.json({
        error: error.message,
        code: 'JQL_TOO_COMPLEX'
      }, { status: 400 });
    }

    const strippedJql = stripOrderBy(rawJql);
    if (!strippedJql || /^order\s+by\b/i.test(rawJql)) {
      return NextResponse.json({
        error: 'jql must include a search restriction before ORDER BY',
        code: 'INVALID_JQL'
      }, { status: 400 });
    }

    // Validate fields
    let fields;
    try {
      fields = validateFields(searchParams.get('fields') || DEFAULT_FIELDS);
    } catch (error) {
      return NextResponse.json({
        error: error.message,
        code: 'TOO_MANY_FIELDS'
      }, { status: 400 });
    }
    const expand = (searchParams.get('expand') || '').trim();
    const distinct = (searchParams.get('distinct') || '').trim().toLowerCase();
    const toolMode = (searchParams.get('toolMode') || '').trim().toLowerCase() === 'true';
    const startAt = Math.max(0, parseInt(searchParams.get('startAt') || '0', 10));
    const countOnly = (searchParams.get('countOnly') || '').trim().toLowerCase() === 'true';
    const requestNextPageToken = (searchParams.get('nextPageToken') || '').trim() || null;
    const rawMaxResults = searchParams.get('maxResults');
    const parsedMaxResults = rawMaxResults == null ? NaN : parseInt(rawMaxResults, 10);
    const hasMaxResults = Number.isFinite(parsedMaxResults) && parsedMaxResults > 0;
    const maxResults = hasMaxResults
      ? Math.min(JIRA_MAX_RESULTS_MAX, Math.max(JIRA_MAX_RESULTS_MIN, parsedMaxResults))
      : null;
    const rawScanLimit = searchParams.get('scanLimit');
    const parsedScanLimit = rawScanLimit == null ? NaN : parseInt(rawScanLimit, 10);
    const hasScanLimit = Number.isFinite(parsedScanLimit) && parsedScanLimit > 0;
    const scanLimit = hasScanLimit ? parsedScanLimit : null;

    if (distinct && !ALLOWED_DISTINCT.has(distinct)) {
      return NextResponse.json({
        error: `Invalid distinct value. Allowed: ${Array.from(ALLOWED_DISTINCT).join(', ')}`,
        code: 'INVALID_DISTINCT'
      }, { status: 400 });
    }
    if (countOnly && distinct) {
      return NextResponse.json({
        error: 'countOnly cannot be combined with distinct',
        code: 'INVALID_COMBINATION'
      }, { status: 400 });
    }

    logJiraRequestMeta({
      apiPath: SEARCH_API_PATH,
      jql: rawJql,
      fields,
      distinct,
      countOnly,
      startAt,
      maxResults,
      expand,
      nextPageToken: requestNextPageToken
    });

    if (!distinct) {
      const selectedFields = parseFieldSet(fields);
      const params = new URLSearchParams({
        jql: rawJql,
        fields: countOnly ? 'key' : fields,
      });
      if (!requestNextPageToken) {
        params.set('startAt', countOnly ? '0' : startAt.toString());
      } else {
        params.set('nextPageToken', requestNextPageToken);
      }
      if (countOnly) {
        // search/jql requires maxResults >= 1; rely on `total` for count-only.
        params.set('maxResults', '1');
      } else if (hasMaxResults) {
        params.set('maxResults', String(maxResults));
      }
      if (expand) params.set('expand', expand);

      const response = await jiraFetchWithRetry(`${SEARCH_API_PATH}?${params}`);
      const data = await safeJsonParse(response);
      logJiraMeta('search/jql', response, data);
      const rawIssues = data.issues || data.values || [];
      
      // Limit response size
      const { issues: limitedIssues, truncated, originalCount } = limitResponseSize(rawIssues);
      
      const parsedIssues = toolMode
        ? limitedIssues.map((issue) => toCompactIssue(issue, selectedFields, jiraSiteUrl))
        : limitedIssues.map((issue) => parseJiraIssue(issue, { siteUrl: jiraSiteUrl })).filter(issue => issue !== null);

      // Log warning if truncated
      if (truncated) {
        console.warn(`[JIRA] Response truncated: ${originalCount} issues -> ${parsedIssues.length} issues`);
      }

      if (countOnly) {
        let total = extractNumericCount(data);
        let countSource = Number.isFinite(total) ? 'search_total' : 'unknown';
        let exact = Number.isFinite(total);
        let partial = false;
        let hasMore = false;
        let scanned = 0;

        if (!Number.isFinite(total)) {
          const approximateCount = await fetchApproximateCount(rawJql);
          if (Number.isFinite(approximateCount)) {
            total = approximateCount;
            countSource = 'approximate_count';
            exact = false;
            partial = true;
          }
        }
        if (!Number.isFinite(total)) {
          return NextResponse.json(
            {
              error: 'Jira did not return a count for this query. Please refine filters and retry.',
              code: 'COUNT_UNAVAILABLE'
            },
            { status: 422 }
          );
        }

        return NextResponse.json({
          countOnly: true,
          total,
          exact,
          partial,
          hasMore,
          scanned,
          countSource,
          startAt: 0,
          maxResults: Number.isFinite(data?.maxResults) ? data.maxResults : 1,
          issues: [],
        });
      }

      const pageSize = rawIssues.length;
      const responseTotal = Number.isFinite(data?.total) ? data.total : null;
      const responseStartAt = Number.isFinite(data?.startAt) ? data.startAt : startAt;
      const responseMaxResults = Number.isFinite(data?.maxResults)
        ? data.maxResults
        : (hasMaxResults ? maxResults : null);
      const responseNextPageToken = data?.nextPageToken || null;
      const hasMore =
        Boolean(responseNextPageToken) ||
        (Number.isFinite(responseTotal) && responseStartAt + pageSize < responseTotal);

      return NextResponse.json({
        issues: parsedIssues,
        total: Number.isFinite(data.total) ? data.total : parsedIssues.length,
        startAt: responseStartAt,
        toolMode,
        maxResults: responseMaxResults ?? parsedIssues.length,
        pageSize,
        hasMore,
        nextPageToken: responseNextPageToken,
        truncated: truncated || false,
        ...(truncated && { originalCount })
      });
    }

    // Distinct mode scans pages and builds unique values for the requested field.
    const uniqueMap = new Map();
    const uniqueSet = new Set();
    const statusCounts = new Map();
    const issueTypeCounts = new Map();
    let currentStart = startAt;
    let scannedCount = 0;
    let responseTotal = null;
    let nextPageToken = requestNextPageToken;
    let stalled = false;
    let pagesScanned = 0;
    const seenPageSignatures = new Set();
    // FIX: Set default maxResults=100 for consistent pagination
    const batchSize = hasMaxResults ? maxResults : 100;
    const jqlWithoutOrder = stripOrderBy(rawJql);
    const fieldsForDistinct = distinct === 'project' ? 'project' : distinct;

    while (true) {
      const params = new URLSearchParams({
        jql: jqlWithoutOrder,
        fields: fieldsForDistinct,
      });
      if (nextPageToken) {
        params.set('nextPageToken', nextPageToken);
      } else {
        params.set('startAt', currentStart.toString());
      }
      if (batchSize != null) params.set('maxResults', batchSize.toString());

      const response = await jiraFetchWithRetry(`${SEARCH_API_PATH}?${params}`);
      const data = await safeJsonParse(response);
      logJiraMeta('search/jql distinct', response, data);
      const batch = data.issues || data.values || [];
      pagesScanned += 1;
      if (batch.length === 0) break;
      if (responseTotal == null && Number.isFinite(data?.total)) {
        responseTotal = data.total;
      }

      for (const issue of batch) {
        if (distinct === 'project') {
          const project = issue?.fields?.project;
          if (!project?.key || uniqueMap.has(project.key)) continue;
          uniqueMap.set(project.key, {
            key: project.key,
            name: project.name || project.key,
            id: project.id || null,
          });
        } else if (distinct === 'issuetype') {
          const issueTypeName = issue?.fields?.issuetype?.name;
          if (issueTypeName) {
            uniqueSet.add(issueTypeName);
            // FIX: Track counts for issue types
            issueTypeCounts.set(issueTypeName, (issueTypeCounts.get(issueTypeName) || 0) + 1);
          }
        } else if (distinct === 'status') {
          const statusName = issue?.fields?.status?.name;
          if (statusName) {
            uniqueSet.add(statusName);
            // FIX: Track counts for statuses
            statusCounts.set(statusName, (statusCounts.get(statusName) || 0) + 1);
          }
        }
      }

      const firstKey = batch[0]?.key || '';
      const lastKey = batch[batch.length - 1]?.key || '';
      const pageToken = String(data?.nextPageToken || '');
      const pageSignature = `${firstKey}|${lastKey}|${batch.length}|${pageToken}`;
      if (seenPageSignatures.has(pageSignature)) {
        stalled = true;
        break;
      }
      seenPageSignatures.add(pageSignature);

      nextPageToken = data?.nextPageToken || null;
      currentStart += batch.length;
      scannedCount += batch.length;
      if (data?.isLast === true || !nextPageToken) break;
      if (pagesScanned >= MAX_DISTINCT_PAGES) {
        stalled = true;
        break;
      }
      if (nextPageToken) continue;
      if (batchSize != null && batch.length < batchSize) break;
      if (hasScanLimit && scannedCount >= scanLimit) break;
      if (Number.isFinite(responseTotal) && currentStart >= responseTotal) break;
    }

    if (distinct === 'project') {
      return NextResponse.json({
        projects: Array.from(uniqueMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
        partial: Boolean(stalled || (hasScanLimit && scannedCount >= scanLimit)),
        pagesScanned,
      });
    }

    if (distinct === 'issuetype') {
      // FIX: Return counts with issue types
      return NextResponse.json({
        issueTypes: Array.from(issueTypeCounts.entries())
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => a.name.localeCompare(b.name)),
        total: scannedCount,
        partial: Boolean(stalled || (hasScanLimit && scannedCount >= scanLimit)),
        pagesScanned,
      });
    }

    // FIX: Return counts with statuses
    return NextResponse.json({
      statuses: Array.from(statusCounts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      total: scannedCount,
      partial: Boolean(stalled || (hasScanLimit && scannedCount >= scanLimit)),
      pagesScanned,
    });
  } catch (error) {
    console.error('Error querying Jira:', error.message, error.stack);

    // Specific error handling
    if (error.message === 'Not authenticated with Jira') {
      return NextResponse.json({
        error: 'Authentication required',
        code: 'JIRA_AUTH_REQUIRED',
        message: 'You need to authenticate with Jira before making queries.',
        action: 'Please login at /jira',
        userMessage: 'Please authenticate with Jira to continue.'
      }, { status: 401 });
    }

    if (error.message?.includes('timeout') || error.name === 'AbortError') {
      return NextResponse.json({
        error: 'Request timeout',
        code: 'TIMEOUT',
        message: 'The Jira request took too long to complete.',
        action: 'Please try again with a simpler query',
        userMessage: 'The request timed out. Please try a simpler query or filter.'
      }, { status: 504 });
    }

    // Handle structured Jira API errors
    if (error.jiraError) {
      const jiraError = error.jiraError;
      const errorMessages = Array.isArray(jiraError.errorMessages)
        ? jiraError.errorMessages
        : [];
      const errorDetails = jiraError.errors || {};
      
      // Create a user-friendly message
      let userMessage = 'Jira API error occurred.';
      if (errorMessages.length > 0) {
        userMessage = errorMessages[0]; // Use first error message
      } else if (Object.keys(errorDetails).length > 0) {
        const firstError = Object.values(errorDetails)[0];
        userMessage = typeof firstError === 'string' ? firstError : 'Jira API error occurred.';
      }

      return NextResponse.json({
        error: 'JIRA API error',
        code: 'JIRA_API_ERROR',
        status: jiraError.status,
        message: userMessage,
        errorMessages: errorMessages,
        errors: errorDetails,
        userMessage: `Jira error: ${userMessage}`,
        action: 'Please check your query syntax and try again'
      }, { status: jiraError.status >= 400 && jiraError.status < 600 ? jiraError.status : 502 });
    }

    // Legacy JIRA API error handling (fallback)
    if (error.message?.includes('Jira API error')) {
      return NextResponse.json({
        error: 'JIRA API error',
        code: 'JIRA_API_ERROR',
        message: error.message,
        userMessage: 'An error occurred while communicating with Jira.',
        action: 'Please check your query and try again'
      }, { status: 502 });
    }

    // JQL validation errors
    if (error.message?.includes('JQL')) {
      return NextResponse.json({
        error: 'Invalid JQL query',
        code: 'INVALID_JQL',
        message: error.message,
        userMessage: error.message,
        action: 'Please correct your JQL query syntax'
      }, { status: 400 });
    }

    // Generic error - ensure we always return a valid response
    return NextResponse.json(
      {
        error: 'Failed to query Jira',
        code: 'INTERNAL_ERROR',
        message: error.message || 'An unexpected error occurred',
        userMessage: 'An unexpected error occurred while querying Jira.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        action: 'Please try again or contact support if the issue persists'
      },
      { status: 500 }
    );
  }
}
