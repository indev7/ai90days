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

    // Find the transition that matches the desired status
    const transition = transitionsData.transitions.find(
      t => t.to.name.toLowerCase() === targetStatus.toLowerCase()
    );

    if (!transition) {
      return NextResponse.json(
        { error: `No valid transition found to status: ${targetStatus}. Available: ${transitionsData.transitions.map(t => t.to.name).join(', ')}` },
        { status: 400 }
      );
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

    return NextResponse.json({ success: true, newStatus: transition.to.name });
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
