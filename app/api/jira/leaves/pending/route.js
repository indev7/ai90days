import { NextResponse } from 'next/server';
import { requireJiraAuth, jiraFetchWithRetry } from '@/lib/jiraAuth';

/**
 * GET handler to fetch pending leave count for a project
 * Calculates pending as: Allocation (from parent issue) - Done subtasks
 * @param {Request} request - Next.js request object with projectKey and parentKey in query params
 * @returns {Promise<NextResponse>} JSON response with pending count
 */
export async function GET(request) {
    try {
        const authCheck = await requireJiraAuth(request);
        if (!authCheck.authenticated) {
            return NextResponse.json({ error: authCheck.error }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const projectKey = searchParams.get('projectKey');
        const parentKey = searchParams.get('parentKey');

        if (!projectKey) {
            return NextResponse.json(
                { error: 'Project key is required' },
                { status: 400 }
            );
        }

        if (parentKey) {
            // Get parent issue to find allocation
            const parentResponse = await jiraFetchWithRetry(
                `/rest/api/3/issue/${parentKey}`
            );
            const parentData = await parentResponse.json();

            // Find allocation from custom fields (number field)
            let allocation = 0;
            for (const [key, value] of Object.entries(parentData.fields || {})) {
                if (key.startsWith('customfield_') && typeof value === 'number' && value > 0) {
                    allocation = value;
                    break;
                }
            }

            // Count subtasks with Done status
            const doneJql = `project = "${projectKey}" AND parent = "${parentKey}" AND status IN ("Done", "Closed", "Resolved")`;
            const doneResponse = await jiraFetchWithRetry(
                `/rest/api/3/search/jql?jql=${encodeURIComponent(doneJql)}&maxResults=1000`
            );
            const doneData = await doneResponse.json();
            const doneCount = doneData.issues?.length || 0;

            // Calculate pending: Allocation - Done
            const count = Math.max(0, allocation - doneCount);

            return NextResponse.json({
                count,
                projectKey,
                allocation,
                doneCount
            });
        }

        // Fallback: count non-done issues without parent filter
        const jql = `project = "${projectKey}" AND status NOT IN ("Done", "Closed", "Resolved")`;
        const response = await jiraFetchWithRetry(
            `/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&maxResults=1000`
        );

        if (!response.ok) {
            throw new Error(`Jira API error: ${response.status}`);
        }

        const data = await response.json();
        const count = data.issues?.length || data.total || 0;

        return NextResponse.json({ count, projectKey });
    } catch (error) {
        if (error.message === 'Not authenticated with Jira') {
            return NextResponse.json({ error: error.message }, { status: 401 });
        }

        return NextResponse.json(
            { error: 'Failed to fetch pending leaves', message: error.message },
            { status: 500 }
        );
    }
}
