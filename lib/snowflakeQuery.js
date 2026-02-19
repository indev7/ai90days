import { getSnowflakeAccessToken } from '@/lib/snowflakeToken';

const requireEnv = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const buildSnowflakeEndpoint = () => {
  const account = requireEnv('SNOWFLAKE_ACCOUNT');
  return `https://${account}.snowflakecomputing.com/api/v2/statements`;
};

export const runSnowflakeQuery = async (sql) => {
  const accessToken = await getSnowflakeAccessToken();
  const endpoint = buildSnowflakeEndpoint();

  const body = {
    statement: sql,
    timeout: 60
  };

  if (process.env.SNOWFLAKE_DATABASE) body.database = process.env.SNOWFLAKE_DATABASE;
  if (process.env.SNOWFLAKE_SCHEMA) body.schema = process.env.SNOWFLAKE_SCHEMA;
  if (process.env.SNOWFLAKE_WAREHOUSE) body.warehouse = process.env.SNOWFLAKE_WAREHOUSE;
  if (process.env.SNOWFLAKE_ROLE) body.role = process.env.SNOWFLAKE_ROLE;

  console.log('[Snowflake] Sending request to:', endpoint);
  console.log('[Snowflake] Request body:', JSON.stringify(body, null, 2));

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'X-Snowflake-Authorization-Token-Type': 'OAUTH'
    },
    body: JSON.stringify(body)
  });

  console.log('[Snowflake] Response status:', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Snowflake] Error response:', errorText);
    const error = new Error(`Snowflake query failed (${response.status}): ${errorText}`);
    error.status = response.status;
    throw error;
  }

  return response.json();
};
