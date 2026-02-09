export const JIRA_QUERY_ACTIONS_SCHEMA = {
  type: 'function',
  name: 'emit_jira_query_actions',
  description: 'Emit read-only Jira query actions that call the Jira proxy endpoint. CRITICAL: Do NOT combine "distinct" with "countOnly" - use ONE or the OTHER. For status counts, use distinct=status (returns counts automatically). For total count, use countOnly=true (without distinct).',
  parameters: {
    type: 'object',
    properties: {
      actions: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['intent', 'endpoint', 'method', 'payload'],
          properties: {
            intent: {
              type: 'string',
              enum: [
                'JIRA_QUERY_ISSUES',
                'JIRA_LIST_PROJECTS',
                'JIRA_LIST_ISSUE_TYPES',
                'JIRA_LIST_STATUSES'
              ]
            },
            endpoint: {
              type: 'string',
              enum: ['/api/jira/query']
            },
            method: {
              type: 'string',
              enum: ['GET']
            },
            payload: {
              type: 'object',
              properties: {
                jql: {
                  type: 'string',
                  description: 'JQL query string'
                },
                fields: {
                  type: 'string',
                  description: 'Comma-separated field names (e.g., "summary,status,priority")'
                },
                distinct: {
                  type: 'string',
                  enum: ['project', 'issuetype', 'status'],
                  description: 'Get unique values WITH counts. Do NOT use with countOnly. Returns: {statuses: [{name: "Done", count: 42}]}'
                },
                startAt: { type: 'integer', minimum: 0 },
                maxResults: { type: 'integer', minimum: 1 },
                scanLimit: { type: 'integer', minimum: 1 },
                countOnly: {
                  type: 'boolean',
                  description: 'Get total count only. Do NOT use with distinct. Returns: {total: 150}'
                },
                toolMode: {
                  type: 'boolean',
                  description: 'Always set to true for compact responses'
                },
                expand: { type: 'string' }
              },
              required: ['jql'],
              additionalProperties: false
            }
          },
          additionalProperties: false
        }
      }
    },
    required: ['actions'],
    additionalProperties: false
  }
};
