import { NextResponse } from 'next/server';
import { requireJiraAuth, jiraFetchWithRetry } from '@/lib/jiraAuth';

/**
 * POST handler to transition a Jira ticket to a new status
 * @param {Request} request - Next.js request object with status in body
 * @param {Object} params - Route parameters containing ticketKey
 * @returns {Promise<NextResponse>} JSON response with success message
 */
export async function POST(request, { params }) {
  try {
    // Check authentication
    const authCheck = await requireJiraAuth(request);
    if (!authCheck.authenticated) {
      return NextResponse.json({ error: authCheck.error }, { status: 401 });
    }

    const { ticketKey } = await params;
    const body = await request.json();

    // Accept both 'status' and 'transitionName' for backwards compatibility
    const targetStatus = body.transitionName || body.status;

    if (!targetStatus) {
      return NextResponse.json({ error: 'Status or transitionName is required' }, { status: 400 });
    }

    // Get available transitions for the issue
    const transitionsResponse = await jiraFetchWithRetry(
      `/rest/api/3/issue/${ticketKey}/transitions`
    );
    const transitionsData = await transitionsResponse.json();

    // Get current status for better error messaging
    const currentTicketResponse = await jiraFetchWithRetry(
      `/rest/api/3/issue/${ticketKey}?fields=status`
    );
    const currentTicket = await currentTicketResponse.json();
    const currentStatus = currentTicket.fields.status.name;

    // Find matching transition (case-insensitive search for both transition name and destination status)
    const transition = transitionsData.transitions.find(t => {
      const nameMatch = t.name.toLowerCase() === targetStatus.toLowerCase();
      const statusMatch = t.to.name.toLowerCase() === targetStatus.toLowerCase();
      return nameMatch || statusMatch;
    });

    if (!transition) {
      const availableTransitions = transitionsData.transitions.map(t => ({
        name: t.name,
        toStatus: t.to.name,
        statusCategory: t.to.statusCategory.name
      }));

      return NextResponse.json({
        error: `Transition "${targetStatus}" not available`,
        ticketKey,
        currentStatus,
        availableTransitions
      }, { status: 400 });
    }

    // Execute the transition
    await jiraFetchWithRetry(`/rest/api/3/issue/${ticketKey}/transitions`, {
      method: 'POST',
      body: JSON.stringify({
        transition: {
          id: transition.id,
        },
      }),
    });

    return NextResponse.json({
      success: true,
      ticketKey,
      oldStatus: currentStatus,
      newStatus: transition.to.name,
      transitionUsed: transition.name
    });
  } catch (error) {
    if (error.message === 'Not authenticated with Jira') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Failed to update ticket status' },
      { status: 500 }
    );
  }
}
