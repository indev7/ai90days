import { NextResponse } from 'next/server';
import { requireJiraAuth, jiraFetchWithRetry, parseJiraIssue } from '@/lib/jiraAuth';

const DEFAULT_FIELDS = 'summary,status,assignee,reporter,priority,issuetype,project,created,updated,labels,description';
const ALLOWED_DISTINCT = new Set(['project', 'issuetype', 'status']);

function stripOrderBy(jql) {
  return jql.replace(/\s+ORDER\s+BY\s+[\s\S]*$/i, '').trim();
}

function sanitizeJqlInput(jql) {
  if (!jql || typeof jql !== 'string') return '';
  return jql.replace(/[;]/g, ' ').trim();
}

export async function GET(request) {
  try {
    const authCheck = await requireJiraAuth(request);
    if (!authCheck.authenticated) {
      return NextResponse.json({ error: authCheck.error }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const rawJql = sanitizeJqlInput(searchParams.get('jql'));
    if (!rawJql) {
      return NextResponse.json({ error: 'jql is required' }, { status: 400 });
    }

    const fields = (searchParams.get('fields') || DEFAULT_FIELDS).trim();
    const expand = (searchParams.get('expand') || '').trim();
    const distinct = (searchParams.get('distinct') || '').trim().toLowerCase();
    const startAt = Math.max(0, parseInt(searchParams.get('startAt') || '0', 10));
    const maxResults = Math.min(100, Math.max(1, parseInt(searchParams.get('maxResults') || '20', 10)));

    if (distinct && !ALLOWED_DISTINCT.has(distinct)) {
      return NextResponse.json({ error: 'Invalid distinct value' }, { status: 400 });
    }

    if (!distinct) {
      const params = new URLSearchParams({
        jql: rawJql,
        startAt: startAt.toString(),
        maxResults: maxResults.toString(),
        fields,
      });
      if (expand) params.set('expand', expand);

      const response = await jiraFetchWithRetry(`/rest/api/3/search/jql?${params}`);
      const data = await response.json();
      const rawIssues = data.issues || data.values || [];
      const parsedIssues = rawIssues.map(parseJiraIssue).filter(issue => issue !== null);

      return NextResponse.json({
        issues: parsedIssues,
        total: Number.isFinite(data.total) ? data.total : parsedIssues.length,
        startAt,
        maxResults,
      });
    }

    // Distinct mode scans pages and builds unique values for the requested field.
    const uniqueMap = new Map();
    const uniqueSet = new Set();
    let currentStart = 0;
    const batchSize = 100;
    const maxScan = Math.max(batchSize, Math.min(2000, parseInt(searchParams.get('scanLimit') || '800', 10)));
    const jqlWithoutOrder = stripOrderBy(rawJql);
    const fieldsForDistinct = distinct === 'project' ? 'project' : distinct;

    while (currentStart < maxScan) {
      const params = new URLSearchParams({
        jql: jqlWithoutOrder,
        startAt: currentStart.toString(),
        maxResults: batchSize.toString(),
        fields: fieldsForDistinct,
      });

      const response = await jiraFetchWithRetry(`/rest/api/3/search/jql?${params}`);
      const data = await response.json();
      const batch = data.issues || data.values || [];
      if (batch.length === 0) break;

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

      currentStart += batch.length;
      if (batch.length < batchSize) break;
    }

    if (distinct === 'project') {
      return NextResponse.json({
        projects: Array.from(uniqueMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
      });
    }

    if (distinct === 'issuetype') {
      return NextResponse.json({
        issueTypes: Array.from(uniqueSet).sort((a, b) => a.localeCompare(b)),
      });
    }

    return NextResponse.json({
      statuses: Array.from(uniqueSet).sort((a, b) => a.localeCompare(b)),
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
