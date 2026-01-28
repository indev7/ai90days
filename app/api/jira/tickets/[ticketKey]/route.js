import { NextResponse } from 'next/server';
import { requireJiraAuth, jiraFetchWithRetry, parseJiraIssue } from '@/lib/jiraAuth';

/**
 * GET handler to fetch a single Jira ticket by key
 * @param {Request} request - Next.js request object
 * @param {Object} params - Route parameters containing ticketKey
 * @returns {Promise<NextResponse>} JSON response with ticket details
 */
export async function GET(request, { params }) {
  try {
    // Check authentication
    const authCheck = await requireJiraAuth(request);
    if (!authCheck.authenticated) {
      return NextResponse.json({ error: authCheck.error }, { status: 401 });
    }

    const { ticketKey } = await params;

    // Fetch issue details from Jira with expand parameters for permissions and metadata
    const response = await jiraFetchWithRetry(`/rest/api/3/issue/${ticketKey}?expand=changelog,operations,editmeta`);
    const issue = await response.json();

    // Parse issue to simplified format
    const parsedIssue = parseJiraIssue(issue);

    return NextResponse.json(parsedIssue);
  } catch (error) {
    console.error('Error fetching Jira ticket:', error);

    if (error.message === 'Not authenticated with Jira') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Failed to fetch Jira ticket' },
      { status: 500 }
    );
  }
}

/**
 * PUT handler to update a Jira ticket
 * @param {Request} request - Next.js request object with update data in body
 * @param {Object} params - Route parameters containing ticketKey
 * @returns {Promise<NextResponse>} JSON response with updated ticket
 */
export async function PUT(request, { params }) {
  try {
    // Check authentication
    const authCheck = await requireJiraAuth(request);
    if (!authCheck.authenticated) {
      return NextResponse.json({ error: authCheck.error }, { status: 401 });
    }

    const { ticketKey } = await params;
    const body = await request.json();

    // Prepare update fields
    const updateFields = {};

    if (body.summary !== undefined && String(body.summary).trim() !== '') {
      updateFields.summary = body.summary;
    }
    if (body.description !== undefined) {
      updateFields.description = {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: body.description
              }
            ]
          }
        ]
      };
    }
    if (body.assignee !== undefined) {
      updateFields.assignee = body.assignee ? { accountId: body.assignee } : null;
    }
    if (body.priority !== undefined) {
      updateFields.priority = { name: body.priority };
    }
    if (body.labels !== undefined) {
      updateFields.labels = body.labels;
    }

    // Handle custom fields
    if (body.customFields) {
      Object.entries(body.customFields).forEach(([key, value]) => {
        updateFields[key] = value;
      });
    }

    // Update issue in Jira
    await jiraFetchWithRetry(`/rest/api/3/issue/${ticketKey}`, {
      method: 'PUT',
      body: JSON.stringify({ fields: updateFields }),
    });

    // Fetch updated issue
    const response = await jiraFetchWithRetry(`/rest/api/3/issue/${ticketKey}`);
    const updatedIssue = await response.json();

    return NextResponse.json(parseJiraIssue(updatedIssue));
  } catch (error) {
    console.error('Error updating Jira ticket:', error);

    if (error.message === 'Not authenticated with Jira') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Failed to update Jira ticket' },
      { status: 500 }
    );
  }
}
