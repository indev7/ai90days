import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import rateLimiter from '@/lib/rateLimit';
import { requireConfluenceAuth, confluenceFetchWithRetry, getConfluenceAuth } from '@/lib/confluenceAuth';

const SEARCH_API_PATH = '/wiki/rest/api/content/search';
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;

function toInt(value, fallback) {
  const num = Number.parseInt(value, 10);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeCql(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function extractCursor(nextLink) {
  if (typeof nextLink !== 'string' || !nextLink) return null;
  try {
    const url = new URL(nextLink, 'https://example.atlassian.net');
    return url.searchParams.get('cursor');
  } catch {
    return null;
  }
}

function getResultContent(result) {
  if (result?.content && typeof result.content === 'object') {
    return result.content;
  }
  return result || {};
}

function buildResultItem(result, siteUrl) {
  const content = getResultContent(result);
  const space = content.space || result.space || null;
  const webui = content?._links?.webui || result?._links?.webui || '';
  const safeSiteUrl = typeof siteUrl === 'string' ? siteUrl.replace(/\/+$/, '') : '';
  const url = safeSiteUrl && webui ? `${safeSiteUrl}${webui}` : (content?._links?.self || result?._links?.self || '');

  return {
    id: content.id || result.id || '',
    type: content.type || result.type || result.entityType || '',
    title: content.title || result.title || 'Untitled',
    excerpt: result.excerpt || result.excerptText || '',
    space: space ? { key: space.key || '', name: space.name || '' } : null,
    lastUpdated:
      content.version?.when ||
      content.history?.lastUpdated?.when ||
      result.lastModified ||
      '',
    url
  };
}

export async function GET(request) {
  try {
    const authCheck = await requireConfluenceAuth(request);
    if (!authCheck.authenticated) {
      return NextResponse.json(
        { error: authCheck.error, action: 'Please login at /confluence' },
        { status: 401 }
      );
    }

    const session = await getSession();
    const userId = String(session?.sub || 'anonymous');
    const allowed = await rateLimiter.check(userId, 'confluence-search', { max: 120, window: '1h' });
    if (!allowed) {
      const status = rateLimiter.getStatus(userId, 'confluence-search');
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          rateLimit: status
        },
        { status: 429 }
      );
    }

    const { searchParams } = new URL(request.url);
    const cql = normalizeCql(searchParams.get('cql'));
    if (!cql) {
      return NextResponse.json({ error: 'Missing required cql parameter' }, { status: 400 });
    }

    const limit = Math.min(
      Math.max(toInt(searchParams.get('limit'), DEFAULT_LIMIT), 1),
      MAX_LIMIT
    );
    const cursor = searchParams.get('cursor');
    const expand = searchParams.get('expand');
    const toolMode = searchParams.get('toolMode') === 'true';

    const apiParams = new URLSearchParams();
    apiParams.append('cql', cql);
    apiParams.append('limit', String(limit));
    if (cursor) apiParams.append('cursor', cursor);
    if (expand) apiParams.append('expand', expand);

    const response = await confluenceFetchWithRetry(`${SEARCH_API_PATH}?${apiParams.toString()}`);
    const data = await response.json();
    const { siteUrl } = await getConfluenceAuth();

    if (toolMode) {
      const results = Array.isArray(data?.results)
        ? data.results.map((result) => buildResultItem(result, siteUrl))
        : [];
      const nextLink = data?._links?.next || null;
      const nextCursor = extractCursor(nextLink);
      return NextResponse.json({
        results,
        limit,
        hasMore: Boolean(nextLink || nextCursor),
        nextCursor: nextCursor || null
      });
    }

    return NextResponse.json(data);
  } catch (error) {
    if (error.confluenceError) {
      return NextResponse.json(
        {
          error: error.message,
          details: error.confluenceError
        },
        { status: error.confluenceError?.status || 502 }
      );
    }
    console.error('Confluence search error:', error);
    return NextResponse.json({ error: 'Failed to fetch Confluence data' }, { status: 500 });
  }
}
