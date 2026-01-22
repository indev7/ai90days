export const OKRT_SHARE_ACTIONS_SCHEMA = {
  type: 'function',
  name: 'emit_okrt_share_actions',
  description: 'Emit an ordered list of OKRT share/unshare actions.',
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
              enum: ['SHARE_OKRT', 'UNSHARE_OKRT']
            },
            endpoint: {
              type: 'string',
              enum: ['/api/okrt/[id]/share']
            },
            method: {
              type: 'string',
              enum: ['POST', 'DELETE']
            },
            payload: {
              type: 'object',
              required: ['id'],
              properties: {
                id: {
                  allOf: [
                    {
                      anyOf: [
                        {
                          type: 'string',
                          pattern: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
                        },
                        {
                          type: 'string',
                          pattern: '^gen-[a-z0-9]{8}$'
                        }
                      ]
                    }
                  ]
                },
                visibility: {
                  type: 'string',
                  enum: ['private', 'shared']
                },
                groups: {
                  type: 'array',
                  items: { type: 'string' }
                },
                users: {
                  type: 'array',
                  items: {
                    type: 'string',
                    pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$'
                  }
                },
                target: { type: 'string' },
                share_type: { type: 'string', enum: ['G', 'U'] }
              },
              additionalProperties: true
            }
          },
          oneOf: [
            {
              properties: {
                intent: { const: 'SHARE_OKRT' },
                method: { const: 'POST' },
                payload: {
                  required: ['id', 'visibility']
                }
              }
            },
            {
              properties: {
                intent: { const: 'UNSHARE_OKRT' },
                method: { const: 'POST' },
                payload: {
                  required: ['id', 'visibility'],
                  properties: {
                    visibility: { const: 'private' }
                  }
                }
              }
            },
            {
              properties: {
                intent: { const: 'UNSHARE_OKRT' },
                method: { const: 'DELETE' },
                payload: {
                  required: ['id', 'target', 'share_type']
                }
              }
            }
          ],
          additionalProperties: true
        }
      }
    },
    required: ['actions'],
    additionalProperties: true
  }
};
