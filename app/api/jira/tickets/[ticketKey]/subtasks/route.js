import { NextResponse } from 'next/server';
import { requireJiraAuth, jiraFetchWithRetry, parseJiraIssue } from '@/lib/jiraAuth';

/**
 * GET handler to fetch subtasks of a Jira ticket
 * @param {Request} request - Next.js request object
 * @param {Object} params - Route parameters containing ticketKey
 * @returns {Promise<NextResponse>} JSON response with subtasks list
 */
export async function GET(request, { params }) {
  try {
    // Check authentication
    const authCheck = await requireJiraAuth(request);
    if (!authCheck.authenticated) {
      return NextResponse.json({ error: authCheck.error }, { status: 401 });
    }

    const { ticketKey } = await params;

    // Fetch parent issue with subtasks
    const response = await jiraFetchWithRetry(
      `/rest/api/3/issue/${ticketKey}?fields=subtasks`
    );
    const issue = await response.json();

    // Parse subtasks
    const subtasks = (issue.fields.subtasks || []).map(subtask => ({
      id: subtask.id,
      key: subtask.key,
      summary: subtask.fields.summary,
      status: subtask.fields.status?.name || 'Unknown',
      statusCategory: subtask.fields.status?.statusCategory?.name || 'unknown',
      issueType: subtask.fields.issuetype?.name || 'Subtask',
    }));

    return NextResponse.json({ subtasks });
  } catch (error) {
    console.error('Error fetching Jira subtasks:', error);

    if (error.message === 'Not authenticated with Jira') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Failed to fetch subtasks' },
      { status: 500 }
    );
  }
}

/**
 * POST handler to create a subtask for a Jira ticket
 * @param {Request} request - Next.js request object with subtask data in body
 * @param {Object} params - Route parameters containing ticketKey (parent)
 * @returns {Promise<NextResponse>} JSON response with created subtask
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

    // Validate required fields
    if (!body.summary) {
      return NextResponse.json({ error: 'Summary is required' }, { status: 400 });
    }

    // Get parent issue to extract project
    const parentResponse = await jiraFetchWithRetry(`/rest/api/3/issue/${ticketKey}`);
    const parentIssue = await parentResponse.json();
    const projectKey = parentIssue.fields.project.key;

    // Fetch available issue types for this project to find the subtask type
    const createMetaResponse = await jiraFetchWithRetry(
      `/rest/api/3/issue/createmeta?projectKeys=${projectKey}&expand=projects.issuetypes`
    );
    const createMeta = await createMetaResponse.json();
    
    // Find the subtask issue type
    const project = createMeta.projects?.[0];
    const subtaskType = project?.issuetypes?.find(
      type => type.subtask === true
    );

    if (!subtaskType) {
      return NextResponse.json(
        { error: 'Subtask issue type not found for this project' },
        { status: 400 }
      );
    }

    // Prepare subtask data
    const subtaskData = {
      fields: {
        project: {
          key: projectKey,
        },
        parent: {
          key: ticketKey,
        },
        summary: body.summary,
        issuetype: {
          id: subtaskType.id, // Use the actual subtask type ID
        },
      },
    };

    // Add optional description
    if (body.description) {
      subtaskData.fields.description = {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: body.description,
              },
            ],
          },
        ],
      };
    }

    // Add optional assignee
    if (body.assignee) {
      subtaskData.fields.assignee = { accountId: body.assignee };
    }

    // Add optional priority
    if (body.priority) {
      subtaskData.fields.priority = { name: body.priority };
    }

    // Create subtask
    const createResponse = await jiraFetchWithRetry('/rest/api/3/issue', {
      method: 'POST',
      body: JSON.stringify(subtaskData),
    });

    const createdIssue = await createResponse.json();

    // Fetch full subtask details
    const subtaskResponse = await jiraFetchWithRetry(`/rest/api/3/issue/${createdIssue.key}`);
    const subtask = await subtaskResponse.json();

    return NextResponse.json({
      success: true,
      subtask: parseJiraIssue(subtask),
    });
  } catch (error) {
    console.error('Error creating Jira subtask:', error);

    if (error.message === 'Not authenticated with Jira') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Failed to create subtask', details: error.message },
      { status: 500 }
    );
  }
}
