export const OKRT_ACTIONS_SCHEMA = {
  type: 'function',
  name: 'emit_okrt_actions',
  description: 'Emit an ordered list of OKRT actions (create, update, delete).',
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
            intent: { type: 'string', enum: ['CREATE_OKRT', 'UPDATE_OKRT', 'DELETE_OKRT'] },
            endpoint: { type: 'string', enum: ['/api/okrt', '/api/okrt/[id]'] },
            method: { type: 'string', enum: ['POST', 'PUT', 'DELETE'] },
            payload: {
              type: 'object',
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
                type: { type: 'string', enum: ['O', 'K', 'T'] },
                owner_id: { type: 'integer' },
                parent_id: {
                  allOf: [
                    {
                      anyOf: [
                        { type: 'string', pattern: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$' },
                        { type: 'string', pattern: '^gen-[a-z0-9]{8}$' }
                      ]
                    }
                  ]
                },
                description: { type: 'string' },
                progress: { type: 'number' },
                order_index: { type: 'integer' },
                task_status: { type: 'string', enum: ['todo', 'in_progress', 'done', 'blocked'] },
                title: { type: 'string' },
                area: { type: 'string' },
                visibility: { type: 'string', enum: ['private', 'shared'] },
                objective_kind: { type: 'string', enum: ['committed', 'stretch'] },
                status: { type: 'string', enum: ['A', 'C', 'R'] },
                cycle_qtr: { type: 'string' },
                kr_target_number: { type: 'number' },
                kr_unit: { type: 'string', enum: ['%', '$', 'count', 'hrs'] },
                kr_baseline_number: { type: 'number' },
                weight: { type: 'number' },
                due_date: { type: 'string' },
                recurrence_json: { type: 'string' },
                blocked_by: { type: 'string' },
                repeat: { type: 'string', enum: ['Y', 'N'] }
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
