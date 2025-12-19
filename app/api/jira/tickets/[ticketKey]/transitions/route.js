import { NextResponse } from 'next/server';
import { requireJiraAuth, jiraFetchWithRetry } from '@/lib/jiraAuth';

/**
 * GET handler to fetch available transitions for a Jira ticket
 * @param {Request} request - Next.js request object
 * @param {Object} params - Route parameters containing ticketKey
 * @returns {Promise<NextResponse>} JSON response with available transitions
 */
export async function GET(request, { params }) {
    try {
        const authCheck = await requireJiraAuth(request);
        if (!authCheck.authenticated) {
            return NextResponse.json({ error: authCheck.error }, { status: 401 });
        }

        const { ticketKey } = await params;

        const transitionsResponse = await jiraFetchWithRetry(
            `/rest/api/3/issue/${ticketKey}/transitions`
        );
        const transitionsData = await transitionsResponse.json();

        // Return available transitions with their IDs and target statuses
        const transitions = transitionsData.transitions.map(t => ({
            id: t.id,
            name: t.name,
            to: {
                id: t.to.id,
                name: t.to.name,
                statusCategory: t.to.statusCategory?.name
            }
        }));

        return NextResponse.json({ transitions });
    } catch (error) {
        if (error.message === 'Not authenticated with Jira') {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        return NextResponse.json(
            { error: 'Failed to fetch available transitions' },
            { status: 500 }
        );
    }
}
