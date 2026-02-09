import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import {
  coerceTop,
  getMicrosoftAccessToken,
  logMailboxTelemetry,
  mapGraphError,
  normalizeCursor,
  validateNextLink
} from '../_utils';

export async function GET(request) {
  try {
    const session = await verifySession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.userId;
    const { searchParams } = new URL(request.url);
    const folderParam = searchParams.get('folder') || 'Inbox';
    const top = coerceTop(searchParams.get('top'));
    const cursor = normalizeCursor(searchParams.get('cursor'));
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');

    const { accessToken, error } = await getMicrosoftAccessToken(userId, {
      logPrefix: '[MS Mail API]'
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    let graphUrl = '';

    if (cursor) {
      if (!validateNextLink(cursor)) {
        return NextResponse.json({ error: 'Invalid cursor' }, { status: 400 });
      }
      graphUrl = cursor;
    } else {
      const encodedFolder = encodeURIComponent(folderParam);
      const url = new URL(`https://graph.microsoft.com/v1.0/me/mailFolders('${encodedFolder}')/messages`);
      url.searchParams.set(
        '$select',
        'id,subject,from,toRecipients,receivedDateTime,isRead,hasAttachments,importance,webLink'
      );
      url.searchParams.set('$orderby', 'receivedDateTime desc');
      url.searchParams.set('$top', String(top));

      const filters = [];
      if (unreadOnly) {
        filters.push('isRead eq false');
      }
      if (fromDate) {
        filters.push(`receivedDateTime ge ${fromDate}`);
      }
      if (toDate) {
        filters.push(`receivedDateTime le ${toDate}`);
      }

      if (filters.length > 0) {
        url.searchParams.set('$filter', filters.join(' and '));
      }

      graphUrl = url.toString();
    }

    const graphResponse = await fetch(graphUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!graphResponse.ok) {
      let errorBody = null;
      try {
        errorBody = await graphResponse.json();
      } catch (error) {
        errorBody = null;
      }

      const mapped = mapGraphError(graphResponse, errorBody);
      return NextResponse.json({ error: mapped.message }, { status: mapped.status });
    }

    const data = await graphResponse.json();
    const rows = (data.value || []).map((message) => ({
      id: message.id,
      subject: message.subject || '(no subject)',
      fromName: message.from?.emailAddress?.name || '',
      fromEmail: message.from?.emailAddress?.address || '',
      toRecipients: (message.toRecipients || []).map((recipient) => ({
        name: recipient?.emailAddress?.name || '',
        email: recipient?.emailAddress?.address || ''
      })),
      toEmails: (message.toRecipients || [])
        .map((recipient) => recipient?.emailAddress?.address || '')
        .filter(Boolean),
      receivedDateTime: message.receivedDateTime,
      isRead: message.isRead,
      hasAttachments: message.hasAttachments,
      importance: message.importance,
      webLink: message.webLink
    }));

    logMailboxTelemetry({
      endpoint: '/api/ms/mail/messages',
      userId,
      count: rows.length
    });

    return NextResponse.json({
      rows,
      cursor: data['@odata.nextLink'] || null
    });
  } catch (error) {
    console.error('[MS Mail API] ❌ Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
