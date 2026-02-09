import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import {
  getMicrosoftAccessToken,
  logMailboxTelemetry,
  mapGraphError
} from '../../../_utils';

export async function GET(request, { params }) {
  try {
    const session = await verifySession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.userId;
    const routeParams = await params;
    let messageId = routeParams?.id || '';
    if (messageId) {
      try {
        messageId = decodeURIComponent(messageId);
      } catch (error) {
        // Keep the raw route segment if decoding fails.
      }
    }

    if (!messageId) {
      return NextResponse.json({ error: 'Message ID is required' }, { status: 400 });
    }

    const { accessToken, error } = await getMicrosoftAccessToken(userId, {
      logPrefix: '[MS Mail API]'
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const graphResponse = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages/${messageId}?$select=id,subject,from,toRecipients,ccRecipients,receivedDateTime,isRead,body,bodyPreview,webLink`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );

    if (!graphResponse.ok) {
      let errorBody = null;
      try {
        errorBody = await graphResponse.json();
      } catch (parseError) {
        errorBody = null;
      }

      const mapped = mapGraphError(graphResponse, errorBody);
      return NextResponse.json({ error: mapped.message }, { status: mapped.status });
    }

    const message = await graphResponse.json();

    logMailboxTelemetry({
      endpoint: '/api/ms/mail/message/:id/body',
      userId,
      count: 1
    });

    return NextResponse.json({
      id: message.id,
      subject: message.subject || '(no subject)',
      fromName: message.from?.emailAddress?.name || '',
      fromEmail: message.from?.emailAddress?.address || '',
      toRecipients: (message.toRecipients || []).map((recipient) => ({
        name: recipient?.emailAddress?.name || '',
        email: recipient?.emailAddress?.address || ''
      })),
      ccRecipients: (message.ccRecipients || []).map((recipient) => ({
        name: recipient?.emailAddress?.name || '',
        email: recipient?.emailAddress?.address || ''
      })),
      receivedDateTime: message.receivedDateTime,
      isRead: message.isRead,
      bodyPreview: message.bodyPreview || '',
      bodyContentType: message.body?.contentType || 'text',
      body: message.body?.content || '',
      webLink: message.webLink
    });
  } catch (error) {
    console.error('[MS Mail API] ❌ Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
