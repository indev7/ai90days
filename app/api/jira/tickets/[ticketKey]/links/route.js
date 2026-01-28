import { NextResponse } from 'next/server';
import { requireJiraAuth, jiraFetchWithRetry } from '@/lib/jiraAuth';

/**
 * GET handler to fetch linked issues of a Jira ticket
 * @param {Request} request - Next.js request object
 * @param {Object} params - Route parameters containing ticketKey
 * @returns {Promise<NextResponse>} JSON response with linked issues
 */
export async function GET(request, { params }) {
  try {
    // Check authentication
    const authCheck = await requireJiraAuth(request);
    if (!authCheck.authenticated) {
      return NextResponse.json({ error: authCheck.error }, { status: 401 });
    }

    const { ticketKey } = await params;

    // Fetch issue with issuelinks
    const response = await jiraFetchWithRetry(
      `/rest/api/3/issue/${ticketKey}?fields=issuelinks`
    );
    const issue = await response.json();

    // Parse issue links
    const links = (issue.fields.issuelinks || []).map(link => {
      // Links can be inward or outward
      const linkedIssue = link.inwardIssue || link.outwardIssue;
      const linkType = link.type.name;
      const direction = link.inwardIssue ? 'inward' : 'outward';
      const relationship = link.inwardIssue ? link.type.inward : link.type.outward;

      return {
        id: link.id,
        linkType,
        direction,
        relationship,
        linkedIssue: linkedIssue ? {
          key: linkedIssue.key,
          summary: linkedIssue.fields.summary,
          status: linkedIssue.fields.status?.name || 'Unknown',
          issueType: linkedIssue.fields.issuetype?.name || 'Unknown',
        } : null,
      };
    });

    return NextResponse.json({ links });
  } catch (error) {
    console.error('Error fetching Jira links:', error);

    if (error.message === 'Not authenticated with Jira') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Failed to fetch linked issues' },
      { status: 500 }
    );
  }
}

/**
 * POST handler to create a link between two Jira tickets
 * @param {Request} request - Next.js request object with link data in body
 * @param {Object} params - Route parameters containing ticketKey
 * @returns {Promise<NextResponse>} JSON response with success status
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
    if (!body.targetKey || !body.linkType) {
      return NextResponse.json(
        { error: 'Target ticket key and link type are required' },
        { status: 400 }
      );
    }

    // Common link types in Jira
    const linkTypeMap = {
      'blocks': 'Blocks',
      'is blocked by': 'Blocks',
      'relates to': 'Relates',
      'duplicates': 'Duplicate',
      'is duplicated by': 'Duplicate',
      'clones': 'Cloners',
      'is cloned by': 'Cloners',
    };

    const linkTypeName = linkTypeMap[body.linkType.toLowerCase()] || 'Relates';

    // Prepare link data
    const linkData = {
      type: {
        name: linkTypeName,
      },
      inwardIssue: {
        key: body.linkType.toLowerCase().includes('by') ? ticketKey : body.targetKey,
      },
      outwardIssue: {
        key: body.linkType.toLowerCase().includes('by') ? body.targetKey : ticketKey,
      },
    };

    // Add optional comment
    if (body.comment) {
      linkData.comment = {
        body: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: body.comment,
                },
              ],
            },
          ],
        },
      };
    }

    // Create link
    await jiraFetchWithRetry('/rest/api/3/issueLink', {
      method: 'POST',
      body: JSON.stringify(linkData),
    });

    return NextResponse.json({
      success: true,
      message: `Successfully linked ${ticketKey} to ${body.targetKey}`,
    });
  } catch (error) {
    console.error('Error creating Jira link:', error);

    if (error.message === 'Not authenticated with Jira') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Failed to create link', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE handler to remove a link between Jira tickets
 * @param {Request} request - Next.js request object
 * @param {Object} params - Route parameters containing ticketKey
 * @returns {Promise<NextResponse>} JSON response with success status
 */
export async function DELETE(request, { params }) {
  try {
    // Check authentication
    const authCheck = await requireJiraAuth(request);
    if (!authCheck.authenticated) {
      return NextResponse.json({ error: authCheck.error }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const linkId = searchParams.get('linkId');

    if (!linkId) {
      return NextResponse.json({ error: 'Link ID is required' }, { status: 400 });
    }

    // Delete link
    await jiraFetchWithRetry(`/rest/api/3/issueLink/${linkId}`, {
      method: 'DELETE',
    });

    return NextResponse.json({
      success: true,
      message: 'Link removed successfully',
    });
  } catch (error) {
    console.error('Error deleting Jira link:', error);

    if (error.message === 'Not authenticated with Jira') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Failed to remove link' },
      { status: 500 }
    );
  }
}
