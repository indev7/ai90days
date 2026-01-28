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

    console.log('Received Jira create request body:', JSON.stringify(body, null, 2));

    // Validate required fields
    if (!body.project || !body.summary || !body.issueType) {
      console.log('Validation failed - project:', body.project, 'summary:', body.summary, 'issueType:', body.issueType);
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

    console.log('Sending to Jira API - issueData:', JSON.stringify(issueData, null, 2));

    // Add parent issue for subtasks and leave requests
    if (body.parent) {
      // Handle both string and object formats for parent
      if (typeof body.parent === 'string') {
        console.log('📎 Using string parent:', body.parent);
        issueData.fields.parent = {
          key: body.parent,
        };
      } else if (typeof body.parent === 'object' && body.parent.key) {
        console.log('📎 Using object parent:', body.parent.key);
        issueData.fields.parent = {
          key: body.parent.key,
        };
      } else {
        console.warn('⚠️ Invalid parent format:', body.parent);
      }
    } else {
      console.log('📎 No parent provided - creating standalone issue');
    }

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

    // Set assignee only if provided (assignee field might not be available for all issue types)
    if (body.assignee) {
      issueData.fields.assignee = { accountId: body.assignee };
    }

    if (body.priority) {
      issueData.fields.priority = { name: body.priority };
    }

    if (body.labels && body.labels.length > 0) {
      issueData.fields.labels = body.labels;
    }

    if (body.duedate) {
      issueData.fields.duedate = body.duedate;
    }

    // Add leave-specific custom fields if provided
    if (body.customFields && typeof body.customFields === 'object') {
      // Map custom fields to Jira format
      for (const [fieldId, value] of Object.entries(body.customFields)) {
        if (value !== null && value !== undefined && value !== '') {
          // Handle different field types
          if (typeof value === 'number') {
            // Number fields
            issueData.fields[fieldId] = value;
          } else if (typeof value === 'object' && value.value) {
            // Select fields with allowedValues
            issueData.fields[fieldId] = { value: value.value };
          } else if (typeof value === 'string') {
            // String fields (including dates) - send as plain string
            issueData.fields[fieldId] = value;
          } else {
            issueData.fields[fieldId] = value;
          }
        }
      }
    }

    // Legacy support: Add leave info to description if leaveType provided without customFields
    if (body.leaveType && !body.customFields) {
      const leaveInfo = `Leave Type: ${body.leaveType}\n`;
      const dateInfo = body.startDate
        ? `Start Date: ${body.startDate}\n`
        : '';
      const daysInfo = body.days
        ? `Days: ${body.days}\n\n`
        : '';

      if (issueData.fields.description) {
        const existingText = issueData.fields.description.content[0].content[0].text;
        issueData.fields.description.content[0].content[0].text =
          `${leaveInfo}${dateInfo}${daysInfo}${existingText}`;
      } else {
        issueData.fields.description = {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: `${leaveInfo}${dateInfo}${daysInfo}`,
                },
              ],
            },
          ],
        };
      }

      // Add leave type as a label
      if (!issueData.fields.labels) {
        issueData.fields.labels = [];
      }
      issueData.fields.labels.push(body.leaveType.replace(/ /g, '-'));
    }

    // Create issue in Jira
    const response = await jiraFetchWithRetry('/rest/api/3/issue', {
      method: 'POST',
      body: JSON.stringify(issueData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Jira API error:', response.status, errorText);
      throw new Error(`Jira API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (!data.key) {
      console.error('No issue key in response:', data);
      throw new Error('Failed to create issue - no key returned');
    }

    // Fetch the created issue to get full details
    const issueResponse = await jiraFetchWithRetry(`/rest/api/3/issue/${data.key}`);
    const issue = await issueResponse.json();

    return NextResponse.json(parseJiraIssue(issue), { status: 201 });
  } catch (error) {
    console.error('Error creating Jira ticket:', error);
    console.error('Error details:', error.message, error.stack);

    if (error.message === 'Not authenticated with Jira') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    // Return more detailed error information
    const errorMessage = error.message || 'Failed to create Jira ticket';
    const errorDetails = error.response ? await error.response.text() : null;

    return NextResponse.json(
      {
        error: errorMessage,
        details: errorDetails,
        message: 'Failed to create Jira ticket. Check server logs for details.'
      },
      { status: 500 }
    );
  }
}
