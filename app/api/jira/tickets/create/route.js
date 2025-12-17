import { NextResponse } from 'next/server';
import { requireJiraAuth, jiraFetchWithRetry, parseJiraIssue } from '@/lib/jiraAuth';

/**
 * POST handler to create a new Jira ticket
 * @param {Request} request - Next.js request object with ticket data in body
 * @returns {Promise<NextResponse>} JSON response with created ticket
 */
export async function POST(request) {
  try {
    // Check authentication
    const authCheck = await requireJiraAuth(request);
    if (!authCheck.authenticated) {
      return NextResponse.json({ error: authCheck.error }, { status: 401 });
    }

    const body = await request.json();

    // Validate required fields
    if (!body.project || !body.summary || !body.issueType) {
      return NextResponse.json(
        { error: 'Project, summary, and issue type are required' },
        { status: 400 }
      );
    }

    // Prepare issue data
    const issueData = {
      fields: {
        project: {
          key: body.project,
        },
        summary: body.summary,
        issuetype: {
          name: body.issueType,
        },
      },
    };

    // Add optional fields
    if (body.description) {
      issueData.fields.description = {
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

    if (body.assignee) {
      issueData.fields.assignee = { accountId: body.assignee };
    }

    if (body.priority) {
      issueData.fields.priority = { name: body.priority };
    }

    if (body.labels && body.labels.length > 0) {
      issueData.fields.labels = body.labels;
    }

    // Create issue in Jira
    const response = await jiraFetchWithRetry('/rest/api/3/issue', {
      method: 'POST',
      body: JSON.stringify(issueData),
    });

    const data = await response.json();

    // Fetch the created issue to get full details
    const issueResponse = await jiraFetchWithRetry(`/rest/api/3/issue/${data.key}`);
    const issue = await issueResponse.json();

    return NextResponse.json(parseJiraIssue(issue), { status: 201 });
  } catch (error) {
    console.error('Error creating Jira ticket:', error);

    if (error.message === 'Not authenticated with Jira') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Failed to create Jira ticket' },
      { status: 500 }
    );
  }
}
