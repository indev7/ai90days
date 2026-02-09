export const RENDER_CHART_SCHEMA = {
  type: 'function',
  name: 'render_chart',
  description:
    'Render a chart in the AIME chat UI when the user requests a visual chart. Use only bar, pie, or line.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    required: ['kind', 'chartType', 'data', 'x', 'series'],
    properties: {
      kind: { type: 'string', enum: ['render_chart'] },
      chartType: { type: 'string', enum: ['bar', 'pie', 'line'] },
      title: { type: 'string' },
      subtitle: { type: 'string' },
      description: { type: 'string' },
      data: {
        type: 'array',
        minItems: 1,
        maxItems: 60,
        items: {
          type: 'object',
          additionalProperties: {
            anyOf: [{ type: 'string' }, { type: 'number' }, { type: 'null' }]
          }
        }
      },
      x: {
        type: 'object',
        additionalProperties: false,
        required: ['key'],
        properties: {
          key: { type: 'string' },
          label: { type: 'string' }
        }
      },
      series: {
        type: 'array',
        minItems: 1,
        maxItems: 6,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['key'],
          properties: {
            key: { type: 'string' },
            label: { type: 'string' },
            format: { type: 'string', enum: ['number', 'currency:LKR', 'percent'] }
          }
        }
      },
      y: {
        type: 'object',
        additionalProperties: false,
        properties: {
          label: { type: 'string' },
          format: { type: 'string', enum: ['number', 'currency:LKR', 'percent'] },
          min: { type: 'number' },
          max: { type: 'number' }
        }
      },
      options: {
        type: 'object',
        additionalProperties: false,
        properties: {
          pieInnerRadius: { type: 'number' },
          showLegend: { type: 'boolean' }
        }
      }
    }
  }
};
