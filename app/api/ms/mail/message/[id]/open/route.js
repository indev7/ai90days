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
    const messageId = params?.id;

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
      `https://graph.microsoft.com/v1.0/me/messages/${messageId}?$select=webLink`,
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
      } catch (error) {
        errorBody = null;
      }

      const mapped = mapGraphError(graphResponse, errorBody);
      return NextResponse.json({ error: mapped.message }, { status: mapped.status });
    }

    const message = await graphResponse.json();

    if (!message?.webLink) {
      return NextResponse.json({ error: 'Message link not available' }, { status: 404 });
    }

    logMailboxTelemetry({
      endpoint: '/api/ms/mail/message/:id/open',
      userId,
      count: 1
    });

    return NextResponse.redirect(message.webLink, { status: 302 });
  } catch (error) {
    console.error('[MS Mail API] ❌ Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
