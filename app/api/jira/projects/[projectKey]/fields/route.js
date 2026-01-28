import { NextResponse } from 'next/server';
import { requireJiraAuth, jiraFetchWithRetry } from '@/lib/jiraAuth';

/**
 * GET handler to fetch custom fields for a specific project and issue type
 * @param {Request} request - Next.js request object
 * @param {Object} context - Route context with params
 * @returns {Promise<NextResponse>} JSON response with custom fields
 */
export async function GET(request, { params }) {
    try {
        // Check authentication
        const authCheck = await requireJiraAuth(request);
        if (!authCheck.authenticated) {
            return NextResponse.json({ error: authCheck.error }, { status: 401 });
        }

        const { projectKey } = await params;
        const { searchParams } = new URL(request.url);
        const issueType = searchParams.get('issueType') || 'Leave-Request';

        // Fetch create metadata for the project
        const response = await jiraFetchWithRetry(
            `/rest/api/3/issue/createmeta?projectKeys=${projectKey}&expand=projects.issuetypes.fields`
        );
        const data = await response.json();

        if (!data.projects || data.projects.length === 0) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        const project = data.projects[0];
        const issueTypeData = project.issuetypes.find(
            it => it.name === issueType || it.name.toLowerCase() === issueType.toLowerCase()
        );

        if (!issueTypeData) {
            return NextResponse.json({
                error: 'Issue type not found',
                availableTypes: project.issuetypes.map(it => it.name)
            }, { status: 404 });
        }

        // Extract relevant custom fields
        const customFields = {};
        Object.entries(issueTypeData.fields).forEach(([key, field]) => {
            if (key.startsWith('customfield_')) {
                customFields[key] = {
                    id: key,
                    name: field.name,
                    required: field.required,
                    schema: field.schema,
                    allowedValues: field.allowedValues,
                };
            }
        });

        return NextResponse.json({
            projectKey,
            issueType: issueTypeData.name,
            issueTypeId: issueTypeData.id,
            subtask: issueTypeData.subtask,
            availableTypes: project.issuetypes.map(it => ({
                id: it.id,
                name: it.name,
                subtask: it.subtask
            })),
            fields: issueTypeData.fields,
            customFields,
        });
    } catch (error) {
        console.error('Error fetching project fields:', error);

        if (error.message === 'Not authenticated with Jira') {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        return NextResponse.json(
            { error: 'Failed to fetch project fields' },
            { status: 500 }
        );
    }
}
