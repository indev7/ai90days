export const JIRA_QUERY_ACTIONS_SCHEMA = {
  type: 'function',
  name: 'emit_jira_query_actions',
  description: 'Emit read-only Jira query actions that call the Jira proxy endpoint with minimal JQL and fields.',
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
                jql: { type: 'string' },
                fields: { type: 'string' },
                distinct: {
                  type: 'string',
                  enum: ['project', 'issuetype', 'status']
                },
                startAt: { type: 'integer', minimum: 0 },
                maxResults: { type: 'integer', minimum: 1 },
                scanLimit: { type: 'integer', minimum: 1 },
                countOnly: { type: 'boolean' },
                toolMode: { type: 'boolean' },
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
