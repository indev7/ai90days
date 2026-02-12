export const CONFLUENCE_QUERY_ACTIONS_SCHEMA = {
  type: 'function',
  name: 'emit_confluence_query_actions',
  description: 'Emit read-only Confluence search actions that call the Confluence proxy endpoint. Use CQL for queries.',
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
              enum: ['CONFLUENCE_SEARCH_CONTENT']
            },
            endpoint: {
              type: 'string',
              enum: ['/api/confluence/search']
            },
            method: {
              type: 'string',
              enum: ['GET']
            },
            payload: {
              type: 'object',
              properties: {
                cql: {
                  type: 'string',
                  description: 'CQL query string (e.g., type=page AND text ~ "onboarding")'
                },
                limit: { type: 'integer', minimum: 1 },
                cursor: { type: 'string' },
                expand: {
                  type: 'string',
                  description: 'Comma-separated expand fields (e.g., "space,history.lastUpdated")'
                },
                toolMode: {
                  type: 'boolean',
                  description: 'Always set to true for compact responses'
                }
              },
              required: ['cql'],
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
