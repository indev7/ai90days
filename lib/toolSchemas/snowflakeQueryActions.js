export const SNOWFLAKE_QUERY_ACTIONS_SCHEMA = {
  type: 'function',
  name: 'emit_snowflake_query_actions',
  description: 'Emit read-only Snowflake SQL query actions that call the Snowflake proxy endpoint. Use this to query Trustpilot reviews and other business analytics data. CRITICAL: Only SELECT statements are allowed. Generate SQL based on the Snowflake domain knowledge.',
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
                'SNOWFLAKE_QUERY_DATA',
                'SNOWFLAKE_AGGREGATE_DATA',
                'SNOWFLAKE_ANALYZE_REVIEWS'
              ],
              description: 'Intent of the query: QUERY_DATA for listing records, AGGREGATE_DATA for counts/averages, ANALYZE_REVIEWS for review analysis'
            },
            endpoint: {
              type: 'string',
              enum: ['/api/snowflake/query']
            },
            method: {
              type: 'string',
              enum: ['POST']
            },
            payload: {
              type: 'object',
              properties: {
                sql: {
                  type: 'string',
                  description: 'SQL SELECT query string. Must be a valid SELECT statement. Use UPPERCASE for column names. Include WHERE clauses for date filtering. Use DATE_TRUNC for time-based grouping.'
                }
              },
              required: ['sql'],
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
