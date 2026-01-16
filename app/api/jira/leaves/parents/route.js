import { NextResponse } from 'next/server';
import { requireJiraAuth, jiraFetchWithRetry } from '@/lib/jiraAuth';

/**
 * GET handler to fetch leave type parent issues from ILT project
 * Returns the actual parent issue keys for Medical, Casual, and Annual leaves
 * @param {Request} request - Next.js request object
 * @returns {Promise<NextResponse>} JSON response with leave parent mappings
 */
export async function GET(request) {
    try {
        const authCheck = await requireJiraAuth(request);
        if (!authCheck.authenticated) {
            return NextResponse.json({ error: authCheck.error }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const projectKey = searchParams.get('projectKey') || 'ILT';

        // Search for parent issues by summary
        // These are typically the main leave type issues
        const leaveTypes = [
            { type: 'Medical Leaves 2026', key: null },
            { type: 'Casual Leaves 2026', key: null },
            { type: 'Annual Leaves 2026', key: null }
        ];

        const results = {};

        for (const leave of leaveTypes) {
            try {
                // Search for issue by summary
                const jql = `project = "${projectKey}" AND summary ~ "${leave.type}" ORDER BY created DESC`;
                const response = await jiraFetchWithRetry(
                    `/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&maxResults=1&fields=key,summary,issuetype`
                );

                if (response.ok) {
                    const data = await response.json();
                    if (data.issues && data.issues.length > 0) {
                        const issue = data.issues[0];
                        results[leave.type] = {
                            key: issue.key,
                            summary: issue.fields.summary,
                            issueType: issue.fields.issuetype?.name
                        };
                    }
                }
            } catch (err) {
                console.error(`Error fetching ${leave.type}:`, err);
            }
        }

        // Also try to get all issues in ILT project to help debug
        const allJql = `project = "${projectKey}" AND summary ~ "Leaves 2026" ORDER BY key ASC`;
        const allResponse = await jiraFetchWithRetry(
            `/rest/api/3/search/jql?jql=${encodeURIComponent(allJql)}&maxResults=50&fields=key,summary,issuetype,subtasks`
        );

        let allLeaveIssues = [];
        if (allResponse.ok) {
            const allData = await allResponse.json();
            allLeaveIssues = allData.issues?.map(issue => ({
                key: issue.key,
                summary: issue.fields.summary,
                issueType: issue.fields.issuetype?.name,
                subtaskCount: issue.fields.subtasks?.length || 0
            })) || [];
        }

        return NextResponse.json({
            projectKey,
            mappings: results,
            allLeaveIssues,
            hint: 'Use the "key" field from mappings in your leave creation payload as parent: {"key": "ILT-XXXXX"}'
        });

    } catch (error) {
        console.error('Error fetching leave parents:', error);
        if (error.message === 'Not authenticated with Jira') {
            return NextResponse.json({ error: error.message }, { status: 401 });
        }

        return NextResponse.json(
            { error: 'Failed to fetch leave parent issues', message: error.message },
            { status: 500 }
        );
    }
}
