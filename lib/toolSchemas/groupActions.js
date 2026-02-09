export const GROUP_ACTIONS_SCHEMA = {
  type: 'function',
  name: 'emit_group_actions',
  description: 'Emit an ordered list of group actions (create, update, delete, membership, settings).',
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
                'CREATE_GROUP',
                'UPDATE_GROUP',
                'DELETE_GROUP',
                'ADD_GROUP_MEMBER',
                'UPDATE_GROUP_MEMBER',
                'REMOVE_GROUP_MEMBER'
              ]
            },
            endpoint: {
              type: 'string',
              enum: [
                '/api/groups',
                '/api/groups/[id]',
                '/api/groups/[id]/members',
                '/api/groups/[id]/members/[userId]'
              ]
            },
            method: { type: 'string', enum: ['POST', 'PUT', 'DELETE'] },
            payload: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                type: {
                  type: 'string',
                  enum: ['Organisation', 'Department', 'Team', 'Chapter', 'Squad', 'Tribe', 'Group']
                },
                parent_group_id: { type: ['string', 'null'] },
                thumbnail_data: { type: 'string' },
                thumbnail_url: { type: 'string' },
                vision: { type: 'string' },
                mission: { type: 'string' },
                strategic_objectives: {
                  type: 'array',
                  items: { type: 'string' },
                  maxItems: 5
                },
                members: {
                  type: 'array',
                  items: {
                    type: 'object',
                    required: ['id'],
                    properties: {
                      id: { type: 'integer' },
                      isAdmin: { type: 'boolean' }
                    },
                    additionalProperties: false
                  }
                },
                email: { type: 'string' },
                isAdmin: { type: 'boolean' },
                userId: { type: 'integer' }
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
