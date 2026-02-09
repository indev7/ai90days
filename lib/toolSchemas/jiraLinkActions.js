export const JIRA_LINK_ACTIONS_SCHEMA = {
  type: 'function',
  name: 'emit_jira_link_actions',
  description: 'Emit link/unlink actions between OKRTs and Jira tickets.',
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
              enum: ['LINK_JIRA_TICKET', 'UNLINK_JIRA_TICKET']
            },
            endpoint: {
              type: 'string',
              enum: ['/api/okrt/[id]/jira-link']
            },
            method: {
              type: 'string',
              enum: ['POST', 'DELETE']
            },
            payload: {
              type: 'object',
              required: ['id', 'jira_ticket_id'],
              properties: {
                id: {
                  allOf: [
                    {
                      anyOf: [
                        { type: 'string', pattern: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$' },
                        { type: 'string', pattern: '^gen-[a-z0-9]{8}$' }
                      ]
                    }
                  ]
                },
                jira_ticket_id: {
                  type: 'string',
                  pattern: '^[A-Za-z][A-Za-z0-9]+-[0-9]+$'
                }
              },
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
