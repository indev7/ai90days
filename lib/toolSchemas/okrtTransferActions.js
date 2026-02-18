export const OKRT_TRANSFER_ACTIONS_SCHEMA = {
  type: 'function',
  name: 'emit_okrt_transfer_actions',
  description: 'Emit an ordered list of OKRT ownership transfer actions.',
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
              enum: ['TRANSFER_OKRT']
            },
            endpoint: {
              type: 'string',
              enum: ['/api/okrt/[id]/transfer']
            },
            method: {
              type: 'string',
              enum: ['POST']
            },
            payload: {
              type: 'object',
              required: ['id', 'target_user_id'],
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
                target_user_id: { type: 'integer' },
                objective_title: { type: 'string' },
                target_member_label: { type: 'string' },
                target_member_email: { type: 'string' }
              },
              additionalProperties: true
            }
          },
          additionalProperties: true
        }
      }
    },
    required: ['actions'],
    additionalProperties: true
  }
};
