export const MS_MAIL_ACTIONS_SCHEMA = {
  type: 'function',
  name: 'emit_ms_mail_actions',
  description: 'Emit an ordered list of Microsoft mail actions (list messages, preview, open).',
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
                'LIST_MESSAGES',
                'GET_MESSAGE_PREVIEW',
                'OPEN_MESSAGE'
              ]
            },
            endpoint: {
              type: 'string',
              enum: [
                '/api/ms/mail/messages',
                '/api/ms/mail/message/[id]/preview',
                '/api/ms/mail/message/[id]/open'
              ]
            },
            method: { type: 'string', enum: ['GET'] },
            payload: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                folder: { type: 'string' },
                top: { type: 'integer' },
                cursor: { type: 'string' },
                unreadOnly: { type: 'boolean' },
                fromDate: { type: 'string' },
                toDate: { type: 'string' }
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
