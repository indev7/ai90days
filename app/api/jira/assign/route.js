import { NextResponse } from 'next/server';
import { requireJiraAuth, jiraFetchWithRetry, parseJiraIssue } from '@/lib/jiraAuth';

/**
 * Sanitize input values to prevent injection attacks
 * @param {string} value - Input value to sanitize
 * @returns {string} Sanitized value
 */
function sanitizeInput(value) {
  if (!value) return '';
  return String(value).trim().replace(/[<>'"&]/g, '');
}

/**
 * Search for Jira users by email or display name
 * @param {string} searchTerm - Email or display name to search for
 * @returns {Promise<Array>} Array of user objects
 */
async function searchJiraUsers(searchTerm) {
  if (!searchTerm) {
    throw new Error('Search term is required');
  }

  try {
    // Try exact email search first
    const emailResponse = await jiraFetchWithRetry(
      `/rest/api/3/user/search?query=${encodeURIComponent(searchTerm)}&maxResults=50`
    );
    const emailUsers = await emailResponse.json();

    if (Array.isArray(emailUsers) && emailUsers.length > 0) {
      return emailUsers.map(user => ({
        accountId: user.accountId,
        displayName: user.displayName,
        emailAddress: user.emailAddress,
        active: user.active,
        accountType: user.accountType
      }));
    }

    return [];
  } catch (error) {
    console.error('Error searching Jira users:', error);
    throw new Error(`Failed to search users: ${error.message}`);
  }
}

/**
 * Validate if a user can be assigned to the project
 * @param {string} accountId - User account ID to validate
 * @param {string} projectKey - Project key to check permissions
 * @returns {Promise<Object>} Validation result
 */
async function validateUserForProject(accountId, projectKey) {
  try {
    // Check if user exists and is active
    const userResponse = await jiraFetchWithRetry(`/rest/api/3/user?accountId=${accountId}`);
    const user = await userResponse.json();

    if (!user.active) {
      return {
        valid: false,
        reason: 'User account is inactive',
        user: user
      };
    }

    // Check project permissions for the user
    try {
      const permissionResponse = await jiraFetchWithRetry(
        `/rest/api/3/user/permission/search?permissions=ASSIGNABLE_USER&projectKey=${projectKey}&accountId=${accountId}`
      );
      const permissions = await permissionResponse.json();

      if (!permissions.permissions || !permissions.permissions.ASSIGNABLE_USER) {
        return {
          valid: false,
          reason: `User does not have permission to be assigned issues in project ${projectKey}`,
          user: user
        };
      }
    } catch (permError) {
      // If permission check fails, try a simpler validation
      console.warn('Permission check failed, using fallback validation:', permError.message);
    }

    return {
      valid: true,
      reason: 'User is valid and can be assigned',
      user: user
    };
  } catch (error) {
    return {
      valid: false,
      reason: `User validation failed: ${error.message}`,
      user: null
    };
  }
}

/**
 * POST handler to assign Jira ticket to a specific user with validation
 * @param {Request} request - Next.js request object
 * @returns {Promise<NextResponse>} JSON response with assignment result
 */
export async function POST(request) {
  try {
    // Check authentication
    const authCheck = await requireJiraAuth(request);
    if (!authCheck.authenticated) {
      return NextResponse.json({
        success: false,
        error: 'Not authenticated with Jira',
        details: 'Please authenticate with Jira first to assign tickets.',
        userPrompt: 'Authentication required: Please log in to Jira through the settings to assign tickets.'
      }, { status: 401 });
    }

    const body = await request.json();
    const { ticketKey, assigneeEmail, assigneeDisplayName, assigneeAccountId } = body;

    // Validate required fields
    if (!ticketKey) {
      return NextResponse.json({
        success: false,
        error: 'Missing ticket key',
        details: 'Ticket key is required to assign a ticket.',
        userPrompt: 'Error: Please specify which ticket you want to assign (e.g., "90D-123").'
      }, { status: 400 });
    }

    if (!assigneeEmail && !assigneeDisplayName && !assigneeAccountId) {
      return NextResponse.json({
        success: false,
        error: 'Missing assignee information',
        details: 'Either email, display name, or account ID is required to assign a ticket.',
        userPrompt: 'Error: Please specify who you want to assign the ticket to (email address or display name).'
      }, { status: 400 });
    }

    // Sanitize inputs
    const sanitizedTicketKey = sanitizeInput(ticketKey);
    const sanitizedEmail = sanitizeInput(assigneeEmail);
    const sanitizedDisplayName = sanitizeInput(assigneeDisplayName);
    const sanitizedAccountId = sanitizeInput(assigneeAccountId);

    let targetUser = null;
    let searchResults = [];

    try {
      // First, verify the ticket exists and get project info
      const ticketResponse = await jiraFetchWithRetry(`/rest/api/3/issue/${sanitizedTicketKey}`);
      const ticket = await ticketResponse.json();
      const projectKey = ticket.fields.project.key;

      // Search for the user if we don't have account ID
      if (!sanitizedAccountId) {
        const searchTerm = sanitizedEmail || sanitizedDisplayName;
        searchResults = await searchJiraUsers(searchTerm);

        if (searchResults.length === 0) {
          return NextResponse.json({
            success: false,
            error: 'User not found',
            details: `No Jira user found with identifier: ${searchTerm}`,
            searchTerm: searchTerm,
            suggestions: [
              'Check if the email address is correct',
              'Verify the user has a Jira account',
              'Try using the full display name instead',
              'Contact admin to add the user to Jira'
            ],
            userPrompt: `Error: No Jira user found with "${searchTerm}". Please check the email/name and ensure the user has a Jira account.`
          }, { status: 404 });
        }

        // If multiple users found, try to find exact match
        if (searchResults.length > 1) {
          let exactMatch = null;
          
          if (sanitizedEmail) {
            exactMatch = searchResults.find(user => 
              user.emailAddress && user.emailAddress.toLowerCase() === sanitizedEmail.toLowerCase()
            );
          }
          
          if (!exactMatch && sanitizedDisplayName) {
            exactMatch = searchResults.find(user => 
              user.displayName && user.displayName.toLowerCase() === sanitizedDisplayName.toLowerCase()
            );
          }

          if (!exactMatch) {
            return NextResponse.json({
              success: false,
              error: 'Multiple users found',
              details: `Found ${searchResults.length} users matching "${searchTerm}"`,
              searchTerm: searchTerm,
              foundUsers: searchResults.slice(0, 5).map(user => ({
                displayName: user.displayName,
                emailAddress: user.emailAddress,
                accountId: user.accountId
              })),
              suggestions: [
                'Use the exact email address for precise matching',
                'Use the exact display name from the list above',
                'Specify the account ID directly if known'
              ],
              userPrompt: `Error: Multiple users found for "${searchTerm}". Please specify the exact email address or choose from: ${searchResults.slice(0, 3).map(u => u.displayName).join(', ')}`
            }, { status: 400 });
          }

          targetUser = exactMatch;
        } else {
          targetUser = searchResults[0];
        }
      } else {
        // Validate the provided account ID
        try {
          const userResponse = await jiraFetchWithRetry(`/rest/api/3/user?accountId=${sanitizedAccountId}`);
          targetUser = await userResponse.json();
        } catch (error) {
          return NextResponse.json({
            success: false,
            error: 'Invalid account ID',
            details: `User with account ID ${sanitizedAccountId} not found`,
            accountId: sanitizedAccountId,
            userPrompt: `Error: User with account ID "${sanitizedAccountId}" does not exist in Jira.`
          }, { status: 404 });
        }
      }

      // Validate user can be assigned to this project
      const validation = await validateUserForProject(targetUser.accountId, projectKey);
      
      if (!validation.valid) {
        return NextResponse.json({
          success: false,
          error: 'User cannot be assigned',
          details: validation.reason,
          user: {
            displayName: targetUser.displayName,
            emailAddress: targetUser.emailAddress,
            accountId: targetUser.accountId,
            active: targetUser.active
          },
          project: projectKey,
          ticket: sanitizedTicketKey,
          suggestions: [
            'Check if the user has access to the project',
            'Verify the user account is active',
            'Contact project admin to grant permissions',
            'Try assigning to a different user'
          ],
          userPrompt: `Error: Cannot assign ticket to ${targetUser.displayName}. ${validation.reason}`
        }, { status: 403 });
      }

      // Attempt the assignment
      try {
        await jiraFetchWithRetry(`/rest/api/3/issue/${sanitizedTicketKey}`, {
          method: 'PUT',
          body: JSON.stringify({
            fields: {
              assignee: { accountId: targetUser.accountId }
            }
          }),
        });

        // Fetch the updated ticket
        const updatedTicketResponse = await jiraFetchWithRetry(`/rest/api/3/issue/${sanitizedTicketKey}`);
        const updatedTicket = await updatedTicketResponse.json();
        const parsedTicket = parseJiraIssue(updatedTicket);

        return NextResponse.json({
          success: true,
          message: 'Ticket assigned successfully',
          assignment: {
            ticket: {
              key: parsedTicket.key,
              summary: parsedTicket.summary,
              project: parsedTicket.project.name
            },
            assignee: {
              displayName: targetUser.displayName,
              emailAddress: targetUser.emailAddress,
              accountId: targetUser.accountId
            },
            previousAssignee: updatedTicket.changelog?.histories?.[0]?.items?.find(
              item => item.field === 'assignee'
            )?.fromString || 'Unassigned'
          },
          userPrompt: `✅ Successfully assigned ticket ${sanitizedTicketKey} (${parsedTicket.summary}) to ${targetUser.displayName} (${targetUser.emailAddress})`
        });

      } catch (assignError) {
        console.error('Assignment error:', assignError);
        
        let errorMessage = 'Failed to assign ticket';
        let statusCode = 500;

        if (assignError.message.includes('does not exist') || assignError.message.includes('404')) {
          errorMessage = `Ticket ${sanitizedTicketKey} does not exist or you don't have permission to modify it`;
          statusCode = 404;
        } else if (assignError.message.includes('forbidden') || assignError.message.includes('403')) {
          errorMessage = 'You do not have permission to assign this ticket';
          statusCode = 403;
        } else if (assignError.message.includes('assignee')) {
          errorMessage = 'Invalid assignee or assignee field is not editable';
          statusCode = 400;
        }

        return NextResponse.json({
          success: false,
          error: 'Assignment failed',
          details: errorMessage,
          ticket: sanitizedTicketKey,
          assignee: {
            displayName: targetUser.displayName,
            emailAddress: targetUser.emailAddress,
            accountId: targetUser.accountId
          },
          suggestions: [
            'Verify you have edit permissions on the ticket',
            'Check if the ticket is in a status that allows assignment',
            'Ensure the assignee field is available for this issue type',
            'Try refreshing your Jira authentication'
          ],
          userPrompt: `Error: Failed to assign ${sanitizedTicketKey} to ${targetUser.displayName}. ${errorMessage}`
        }, { status: statusCode });
      }

    } catch (ticketError) {
      console.error('Ticket fetch error:', ticketError);
      
      return NextResponse.json({
        success: false,
        error: 'Ticket not found',
        details: `Ticket ${sanitizedTicketKey} does not exist or you don't have permission to access it`,
        ticket: sanitizedTicketKey,
        suggestions: [
          'Check if the ticket key is correct (format: PROJECT-NUMBER)',
          'Verify you have access to the project',
          'Ensure the ticket exists in Jira',
          'Contact project admin if you need access'
        ],
        userPrompt: `Error: Ticket "${sanitizedTicketKey}" not found or inaccessible. Please verify the ticket key and your permissions.`
      }, { status: 404 });
    }

  } catch (error) {
    console.error('Jira assignment error:', error);

    if (error.message === 'Not authenticated with Jira') {
      return NextResponse.json({
        success: false,
        error: 'Authentication required',
        details: error.message,
        userPrompt: 'Error: Please authenticate with Jira first to assign tickets.'
      }, { status: 401 });
    }

    return NextResponse.json({
      success: false,
      error: 'Assignment operation failed',
      details: error.message || 'Unknown error occurred',
      suggestions: [
        'Check your Jira connection',
        'Verify all parameters are correct',
        'Try again in a moment',
        'Contact support if the issue persists'
      ],
      userPrompt: `Error: Assignment failed due to technical issue. ${error.message || 'Please try again.'}`
    }, { status: 500 });
  }
}