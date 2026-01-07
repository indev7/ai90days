import { NextResponse } from 'next/server';
import { requireJiraAuth, jiraFetchWithRetry } from '@/lib/jiraAuth';

/**
 * POST handler to add a comment to a Jira ticket
 * @param {Request} request - Next.js request object with comment in body
 * @param {Object} params - Route parameters containing ticketKey
 * @returns {Promise<NextResponse>} JSON response with created comment
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

    if (!body.comment) {
      return NextResponse.json({ error: 'Comment text is required' }, { status: 400 });
    }

    // Prepare comment data in Atlassian Document Format
    const commentData = {
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

    // Add comment to Jira
    const response = await jiraFetchWithRetry(
      `/rest/api/3/issue/${ticketKey}/comment`,
      {
        method: 'POST',
        body: JSON.stringify(commentData),
      }
    );

    const createdComment = await response.json();

    return NextResponse.json({
      success: true,
      comment: {
        id: createdComment.id,
        created: createdComment.created,
        author: createdComment.author?.displayName,
      },
    });
  } catch (error) {
    console.error('Error adding Jira comment:', error);

    if (error.message === 'Not authenticated with Jira') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Failed to add comment to Jira ticket' },
      { status: 500 }
    );
  }
}

/**
 * GET handler to fetch comments for a Jira ticket
 * @param {Request} request - Next.js request object
 * @param {Object} params - Route parameters containing ticketKey
 * @returns {Promise<NextResponse>} JSON response with comments list
 */
export async function GET(request, { params }) {
  try {
    // Check authentication
    const authCheck = await requireJiraAuth(request);
    if (!authCheck.authenticated) {
      return NextResponse.json({ error: authCheck.error }, { status: 401 });
    }

    const { ticketKey } = await params;

    // Fetch comments from Jira
    const response = await jiraFetchWithRetry(
      `/rest/api/3/issue/${ticketKey}/comment`
    );

    const data = await response.json();

    // Parse and simplify comment data
    const comments = (data.comments || []).map(comment => ({
      id: comment.id,
      author: comment.author?.displayName || 'Unknown',
      created: comment.created,
      updated: comment.updated,
      body: extractTextFromADF(comment.body),
    }));

    return NextResponse.json({ comments });
  } catch (error) {
    console.error('Error fetching Jira comments:', error);

    if (error.message === 'Not authenticated with Jira') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Failed to fetch comments' },
      { status: 500 }
    );
  }
}

/**
 * Helper function to extract plain text from Atlassian Document Format
 * @param {Object} adf - Atlassian Document Format object
 * @returns {string} Plain text content
 */
function extractTextFromADF(adf) {
  if (!adf || !adf.content) return '';
  
  let text = '';
  for (const node of adf.content) {
    if (node.type === 'paragraph' && node.content) {
      for (const textNode of node.content) {
        if (textNode.type === 'text') {
          text += textNode.text;
        }
      }
      text += '\n';
    }
  }
  return text.trim();
}
