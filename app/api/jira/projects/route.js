import { NextResponse } from 'next/server';
import { requireJiraAuth, jiraFetchWithRetry } from '@/lib/jiraAuth';

/**
 * GET handler to fetch all accessible Jira projects
 * @param {Request} request - Next.js request object
 * @returns {Promise<NextResponse>} JSON response with projects array
 */
export async function GET(request) {
  try {
    // Check authentication
    const authCheck = await requireJiraAuth(request);
    if (!authCheck.authenticated) {
      return NextResponse.json({ error: authCheck.error }, { status: 401 });
    }

    // Fetch projects from Jira
    const response = await jiraFetchWithRetry('/rest/api/3/project/search');
    const data = await response.json();

    // Filter out spaces and only include actual projects
    // projectTypeKey: 'software', 'business', 'service_desk' are projects
    // projectTypeKey: 'product_discovery' are spaces (Jira Product Discovery)
    const projects = data.values
      .filter(project => project.projectTypeKey !== 'product_discovery')
      .map(project => ({
        id: project.id,
        key: project.key,
        name: project.name,
        projectTypeKey: project.projectTypeKey,
        avatarUrls: project.avatarUrls,
      }));

    return NextResponse.json({ projects });
  } catch (error) {
    if (error.message === 'Not authenticated with Jira') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Failed to fetch Jira projects' },
      { status: 500 }
    );
  }
}
