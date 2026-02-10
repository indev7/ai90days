import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  addJiraLink,
  removeJiraLink,
  getJiraLinksByOkrtId,
  getOKRTById
} from '@/lib/pgdb';

function normalizeJiraKey(value) {
  if (!value) return '';
  return String(value).trim().toUpperCase();
}

function isValidJiraKey(value) {
  return /^[A-Z][A-Z0-9]+-\d+$/.test(value);
}

async function requireOwner(okrtId, session) {
  const okrt = await getOKRTById(okrtId);
  if (!okrt) {
    return { okrt: null, error: NextResponse.json({ error: 'OKRT not found' }, { status: 404 }) };
  }
  if (okrt.owner_id.toString() !== session.sub.toString()) {
    return {
      okrt: null,
      error: NextResponse.json({ error: 'Forbidden: You can only link your own OKRTs' }, { status: 403 })
    };
  }
  return { okrt, error: null };
}

export async function GET(_request, { params }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { error } = await requireOwner(id, session);
    if (error) return error;

    const links = await getJiraLinksByOkrtId(id);
    return NextResponse.json({
      okrt_id: id,
      jira_links: links.map((link) => link.jira_ticket_id)
    });
  } catch (error) {
    console.error('Error fetching Jira links:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { error } = await requireOwner(id, session);
    if (error) return error;

    const body = await request.json();
    const jiraKey = normalizeJiraKey(body?.jira_ticket_id);
    if (!isValidJiraKey(jiraKey)) {
      return NextResponse.json({ error: 'Invalid Jira ticket key' }, { status: 400 });
    }

    await addJiraLink(id, jiraKey);
    const links = await getJiraLinksByOkrtId(id);
    const jiraLinks = links.map((link) => link.jira_ticket_id);

    return NextResponse.json({
      okrt_id: id,
      jira_links: jiraLinks,
      _cacheUpdate: {
        action: 'updateMyOKRT',
        data: {
          id,
          updates: { jira_links: jiraLinks }
        }
      }
    });
  } catch (error) {
    console.error('Error linking Jira ticket:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { error } = await requireOwner(id, session);
    if (error) return error;

    const body = await request.json().catch(() => ({}));
    const jiraKey = normalizeJiraKey(body?.jira_ticket_id);
    if (!isValidJiraKey(jiraKey)) {
      return NextResponse.json({ error: 'Invalid Jira ticket key' }, { status: 400 });
    }

    await removeJiraLink(id, jiraKey);
    const links = await getJiraLinksByOkrtId(id);
    const jiraLinks = links.map((link) => link.jira_ticket_id);

    return NextResponse.json({
      okrt_id: id,
      jira_links: jiraLinks,
      _cacheUpdate: {
        action: 'updateMyOKRT',
        data: {
          id,
          updates: { jira_links: jiraLinks }
        }
      }
    });
  } catch (error) {
    console.error('Error unlinking Jira ticket:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
