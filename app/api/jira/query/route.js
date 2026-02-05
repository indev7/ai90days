import { NextResponse } from 'next/server';
import { requireJiraAuth, jiraFetchWithRetry, parseJiraIssue, getJiraAuth } from '@/lib/jiraAuth';

// Keep default payload lightweight if caller forgets to pass fields.
const DEFAULT_FIELDS = 'summary,status,project,updated,issuetype,priority';
const ALLOWED_DISTINCT = new Set(['project', 'issuetype', 'status']);
const SEARCH_API_PATH = '/rest/api/3/search/jql';
const APPROX_COUNT_API_PATH = '/rest/api/3/search/approximate-count';
const JIRA_MAX_RESULTS_MIN = 1;
const JIRA_MAX_RESULTS_MAX = 5000;

function extractNumericCount(data) {
  if (!data || typeof data !== 'object') return null;
  if (Number.isFinite(data.total)) return data.total;
  if (Number.isFinite(data.count)) return data.count;
  if (Number.isFinite(data.approximateCount)) return data.approximateCount;
  return null;
}

async function fetchApproximateCount(jql) {
  try {
    const response = await jiraFetchWithRetry(APPROX_COUNT_API_PATH, {
      method: 'POST',
      body: JSON.stringify({ jql }),
    });
    const data = await response.json();
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
    const authCheck = await requireJiraAuth(request);
    if (!authCheck.authenticated) {
      return NextResponse.json({ error: authCheck.error }, { status: 401 });
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
      return NextResponse.json({ error: 'jql is required' }, { status: 400 });
    }

    const fields = (searchParams.get('fields') || DEFAULT_FIELDS).trim();
    const expand = (searchParams.get('expand') || '').trim();
    const distinct = (searchParams.get('distinct') || '').trim().toLowerCase();
    const toolMode = (searchParams.get('toolMode') || '').trim().toLowerCase() === 'true';
    const startAt = Math.max(0, parseInt(searchParams.get('startAt') || '0', 10));
    const countOnly = (searchParams.get('countOnly') || '').trim().toLowerCase() === 'true';
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
      return NextResponse.json({ error: 'Invalid distinct value' }, { status: 400 });
    }
    if (countOnly && distinct) {
      return NextResponse.json({ error: 'countOnly cannot be combined with distinct' }, { status: 400 });
    }

    if (!distinct) {
      const selectedFields = parseFieldSet(fields);
      const params = new URLSearchParams({
        jql: rawJql,
        startAt: countOnly ? '0' : startAt.toString(),
        fields: countOnly ? 'key' : fields,
      });
      if (countOnly) {
        // search/jql requires maxResults >= 1; rely on `total` for count-only.
        params.set('maxResults', '1');
      } else if (hasMaxResults) {
        params.set('maxResults', String(maxResults));
      }
      if (expand) params.set('expand', expand);

      const response = await jiraFetchWithRetry(`${SEARCH_API_PATH}?${params}`);
      const data = await response.json();
      const rawIssues = data.issues || data.values || [];
      const parsedIssues = toolMode
        ? rawIssues.map((issue) => toCompactIssue(issue, selectedFields, jiraSiteUrl))
        : rawIssues.map((issue) => parseJiraIssue(issue, { siteUrl: jiraSiteUrl })).filter(issue => issue !== null);

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
            { error: 'Jira did not return a count for this query. Please refine filters and retry.' },
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

      return NextResponse.json({
        issues: parsedIssues,
        total: Number.isFinite(data.total) ? data.total : parsedIssues.length,
        startAt,
        toolMode,
        maxResults: Number.isFinite(data?.maxResults)
          ? data.maxResults
          : (hasMaxResults ? maxResults : parsedIssues.length),
      });
    }

    // Distinct mode scans pages and builds unique values for the requested field.
    const uniqueMap = new Map();
    const uniqueSet = new Set();
    let currentStart = startAt;
    let scannedCount = 0;
    let responseTotal = null;
    let nextPageToken = null;
    let stalled = false;
    const seenPageSignatures = new Set();
    const batchSize = hasMaxResults ? maxResults : null;
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
      const data = await response.json();
      const batch = data.issues || data.values || [];
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
          if (issueTypeName) uniqueSet.add(issueTypeName);
        } else if (distinct === 'status') {
          const statusName = issue?.fields?.status?.name;
          if (statusName) uniqueSet.add(statusName);
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
      if (nextPageToken) continue;
      if (batchSize != null && batch.length < batchSize) break;
      if (hasScanLimit && scannedCount >= scanLimit) break;
      if (Number.isFinite(responseTotal) && currentStart >= responseTotal) break;
    }

    if (distinct === 'project') {
      return NextResponse.json({
        projects: Array.from(uniqueMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
        partial: Boolean(stalled || (hasScanLimit && scannedCount >= scanLimit) || nextPageToken),
      });
    }

    if (distinct === 'issuetype') {
      return NextResponse.json({
        issueTypes: Array.from(uniqueSet).sort((a, b) => a.localeCompare(b)),
        partial: Boolean(stalled || (hasScanLimit && scannedCount >= scanLimit) || nextPageToken),
      });
    }

    return NextResponse.json({
      statuses: Array.from(uniqueSet).sort((a, b) => a.localeCompare(b)),
      partial: Boolean(stalled || (hasScanLimit && scannedCount >= scanLimit) || nextPageToken),
    });
  } catch (error) {
    console.error('Error querying Jira:', error.message);

    if (error.message === 'Not authenticated with Jira') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Failed to query Jira' },
      { status: 500 }
    );
  }
}
