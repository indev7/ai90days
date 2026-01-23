/**
 * JIRA Actions Tool Schema
 * Defines function calling schema for JIRA ticket management operations
 */

export const JIRA_ACTIONS_SCHEMA = {
  type: "function",
  name: "emit_jira_actions",
  description: "Emit an ordered list of JIRA ticket management actions (create, update, comment, transition, link, list).",
  parameters: {
    type: "object",
    properties: {
      actions: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          required: ["intent", "endpoint", "method", "payload"],
          properties: {
            intent: {
              type: "string",
              enum: [
                "CREATE_JIRA",
                "UPDATE_JIRA",
                "COMMENT_JIRA",
                "TRANSITION_JIRA",
                "CREATE_SUBTASK",
                "LINK_JIRA",
                "CREATE_LEAVE",
                "LIST_JIRA_TICKETS",
                "BULK_TRANSITION_JIRA"
              ]
            },
            endpoint: {
              type: "string",
              enum: [
                "/api/jira/tickets/create",
                "/api/jira/tickets/[key]",
                "/api/jira/tickets/[key]/comments",
                "/api/jira/tickets/[key]/transition",
                "/api/jira/tickets/[key]/subtasks",
                "/api/jira/tickets/[key]/links",
                "/api/jira/tickets",
                "/api/jira/tickets/bulk-transition"
              ]
            },
            method: {
              type: "string",
              enum: ["POST", "PUT", "DELETE", "GET"]
            },
            payload: {
              type: "object",
              properties: {
                // Regular JIRA ticket fields
                project: {
                  type: "string",
                  description: "Project KEY (e.g., '90D', 'IRIS', 'ILT'), NOT project name"
                },
                summary: {
                  type: "string",
                  description: "Ticket title/summary"
                },
                issueType: {
                  type: "string",
                  enum: ["Task", "Bug", "Story", "Epic", "Leave-Request"],
                  description: "Type of JIRA issue"
                },
                description: {
                  type: "string",
                  description: "Detailed description"
                },
                assignee: {
                  type: "string",
                  description: "Assignee username or email"
                },
                priority: {
                  type: "string",
                  enum: ["Highest", "High", "Medium", "Low", "Lowest"],
                  description: "Priority level"
                },
                labels: {
                  type: "array",
                  items: { type: "string" },
                  description: "Array of label strings"
                },
                
                // Ticket operations
                key: {
                  type: "string",
                  description: "JIRA ticket key (e.g., '90D-123', 'ILT-456')"
                },
                comment: {
                  type: "string",
                  description: "Comment text to add to ticket"
                },
                transitionName: {
                  type: "string",
                  description: "Status to transition to (e.g., 'In Progress', 'Done', 'Blocked')"
                },
                
                // Linking
                targetKey: {
                  type: "string",
                  description: "Target ticket key for linking"
                },
                linkType: {
                  type: "string",
                  enum: ["blocks", "is blocked by", "relates to", "duplicates", "is duplicated by"],
                  description: "Type of link relationship"
                },
                
                // Leave-specific fields (for CREATE_LEAVE intent)
                leaveType: {
                  type: "string",
                  enum: [
                    "Medical Leaves 2024",
                    "Casual Leaves 2024",
                    "Annual Leaves 2024",
                    "Medical Leaves 2025",
                    "Casual Leaves 2025",
                    "Annual Leaves 2025",
                    "Medical Leaves 2026",
                    "Casual Leaves 2026",
                    "Annual Leaves 2026",
                    "Medical Leaves 2027",
                    "Casual Leaves 2027",
                    "Annual Leaves 2027"
                  ],
                  description: "Type of leave with year suffix"
                },
                startDate: {
                  type: "string",
                  pattern: "^\\d{4}-\\d{2}-\\d{2}$",
                  description: "Leave start date in YYYY-MM-DD format"
                },
                days: {
                  type: "number",
                  minimum: 0.5,
                  maximum: 365,
                  description: "Number of leave days"
                },
                allocation: {
                  type: "number",
                  minimum: 0.5,
                  maximum: 365,
                  description: "Leave allocation (typically same as days)"
                },
                customFields: {
                  type: "object",
                  description: "Custom field values (CRITICAL: use customfield_10015 for startDate, customfield_11603 for days)",
                  properties: {
                    customfield_10015: {
                      type: "string",
                      description: "Start date custom field (YYYY-MM-DD)"
                    },
                    customfield_11603: {
                      type: "number",
                      description: "Days custom field"
                    }
                  }
                },
                parent: {
                  type: "object",
                  required: ["key"],
                  properties: {
                    key: {
                      type: "string",
                      description: "Parent ticket key (e.g., 'ILT-11602')"
                    }
                  },
                  description: "Parent issue object (MUST be object format, NOT string)"
                },
                
                // Bulk operations
                ticketKeys: {
                  type: "array",
                  items: { type: "string" },
                  description: "Array of ticket keys for bulk operations"
                },
                
                // List/query parameters
                status: {
                  type: "string",
                  enum: ["Open", "In Progress", "Done", "To Do", "Blocked", "Resolved", "Cancelled"],
                  description: "Status filter for listing tickets"
                },
                projectKey: {
                  type: "string",
                  description: "Project key filter for listing tickets (e.g., 'D90', 'ILT')"
                }
              },
              additionalProperties: true
            }
          },
          additionalProperties: true
        }
      }
    },
    required: ["actions"],
    additionalProperties: true
  }
};
