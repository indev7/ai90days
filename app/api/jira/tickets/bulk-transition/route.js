import { NextResponse } from 'next/server';
import { requireJiraAuth, jiraFetchWithRetry } from '@/lib/jiraAuth';

export const maxDuration = 300;

export async function POST(req) {
  try {
    await requireJiraAuth();

    const { ticketKeys, transitionName } = await req.json();

    if (!ticketKeys || !Array.isArray(ticketKeys) || !transitionName) {
      return NextResponse.json(
        { error: 'ticketKeys array and transitionName are required' },
        { status: 400 }
      );
    }

    const results = [];
    let successCount = 0;
    let failedCount = 0;

    for (const ticketKey of ticketKeys) {
      try {
        console.log(`Processing transition for ${ticketKey} to ${transitionName}...`);

        // Get current ticket status
        const ticketResponse = await jiraFetchWithRetry(
          `/rest/api/3/issue/${ticketKey}?fields=status`,
          { method: 'GET' }
        );

        if (!ticketResponse.ok) {
          results.push({
            ticketKey,
            error: `Failed to get ticket info: ${ticketResponse.status}`,
            success: false
          });
          failedCount++;
          continue;
        }

        const ticket = await ticketResponse.json();
        const currentStatus = ticket.fields.status.name;

        // Get available transitions
        const transitionsResponse = await jiraFetchWithRetry(
          `/rest/api/3/issue/${ticketKey}/transitions`,
          { method: 'GET' }
        );

        if (!transitionsResponse.ok) {
          results.push({
            ticketKey,
            currentStatus,
            error: `Failed to get transitions: ${transitionsResponse.status}`,
            success: false
          });
          failedCount++;
          continue;
        }

        const transitionsData = await transitionsResponse.json();
        const availableTransitions = transitionsData.transitions.map(t => ({
          name: t.name,
          toStatus: t.to.name,
          statusCategory: t.to.statusCategory.name
        }));

        // Find matching transition (case-insensitive search for both transition name and destination status)
        const transition = transitionsData.transitions.find(t => {
          const nameMatch = t.name.toLowerCase() === transitionName.toLowerCase();
          const statusMatch = t.to.name.toLowerCase() === transitionName.toLowerCase();
          return nameMatch || statusMatch;
        });

        if (!transition) {
          results.push({
            ticketKey,
            currentStatus,
            error: `Transition "${transitionName}" not found`,
            availableTransitions,
            success: false
          });
          failedCount++;
          continue;
        }

        // Execute the transition
        const transitionResponse = await jiraFetchWithRetry(
          `/rest/api/3/issue/${ticketKey}/transitions`,
          {
            method: 'POST',
            body: JSON.stringify({
              transition: {
                id: transition.id,
              },
            }),
          }
        );

        if (!transitionResponse.ok) {
          results.push({
            ticketKey,
            currentStatus,
            error: `Transition failed: ${transitionResponse.status}`,
            availableTransitions,
            success: false
          });
          failedCount++;
          continue;
        }

        results.push({
          ticketKey,
          oldStatus: currentStatus,
          newStatus: transition.to.name,
          actualTransitionUsed: transition.name,
          success: true
        });

        successCount++;

      } catch (error) {
        console.error(`Error processing ${ticketKey}:`, error);
        results.push({
          ticketKey,
          error: error.message,
          success: false
        });
        failedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        total: ticketKeys.length,
        success: successCount,
        failed: failedCount,
        transitionName
      },
      results
    });

  } catch (error) {
    console.error('Bulk transition failed:', error);
    return NextResponse.json(
      { error: 'Not authenticated with Jira. Please login first.' },
      { status: 401 }
    );
  }
}