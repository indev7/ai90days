import fs from 'fs/promises';
import path from 'path';

const TOKEN_REFRESH_SKEW_MS = 60 * 1000;

const resolveTokenFilePath = () => {
  const configured = process.env.SNOWFLAKE_TOKEN_FILE;
  if (configured && configured.trim()) {
    return configured.trim();
  }
  return path.join(process.cwd(), 'snowflake-token.json');
};

const readCachedToken = async (tokenPath) => {
  try {
    const raw = await fs.readFile(tokenPath, 'utf8');
    const data = JSON.parse(raw);
    if (!data || !data.access_token) return null;

    let expiresAtMs = 0;
    if (data.expires_at) {
      expiresAtMs = new Date(data.expires_at).getTime();
    } else if (typeof data.expires_in === 'number') {
      const acquiredAt = data.acquired_at ? new Date(data.acquired_at).getTime() : 0;
      expiresAtMs = acquiredAt + data.expires_in * 1000;
    }

    return {
      access_token: data.access_token,
      expires_at_ms: expiresAtMs
    };
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    console.warn('[Snowflake Token] Failed to read cached token:', error);
    return null;
  }
};

const writeCachedToken = async (tokenPath, tokenData) => {
  const dir = path.dirname(tokenPath);
  await fs.mkdir(dir, { recursive: true });

  const acquiredAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

  const payload = {
    access_token: tokenData.access_token,
    token_type: tokenData.token_type,
    scope: tokenData.scope,
    expires_in: tokenData.expires_in,
    acquired_at: acquiredAt,
    expires_at: expiresAt
  };

  await fs.writeFile(tokenPath, JSON.stringify(payload, null, 2), 'utf8');
};

const requireEnv = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const fetchAzureToken = async () => {
  const tenantId = requireEnv('AZURE_TENANT_ID');
  const clientId = requireEnv('AZURE_CLIENT_ID');
  const clientSecret = requireEnv('AZURE_CLIENT_SECRET');
  
  // Try Snowflake-specific scope first, fall back to custom scope
  const customScope = process.env.AZURE_SCOPE;
  const snowflakeAccount = process.env.SNOWFLAKE_ACCOUNT;
  
  // Snowflake expects the scope to be in the format: https://<account>.snowflakecomputing.com/session:role-any
  // OR the Azure app scope if configured properly
  let scope = customScope;
  
  // If AZURE_SNOWFLAKE_SCOPE is set, use that instead (for Snowflake-specific scope)
  if (process.env.AZURE_SNOWFLAKE_SCOPE) {
    scope = process.env.AZURE_SNOWFLAKE_SCOPE;
  } else if (snowflakeAccount && !customScope) {
    // Try constructing Snowflake scope
    scope = `https://${snowflakeAccount}.snowflakecomputing.com/session:role-any`;
  }
  
  if (!scope) {
    throw new Error('Missing AZURE_SCOPE or AZURE_SNOWFLAKE_SCOPE environment variable');
  }

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  console.log('[Azure Token] Fetching token...');
  console.log('[Azure Token] Scope:', scope);

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope,
      grant_type: 'client_credentials'
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Azure Token] Error response:', errorText);
    throw new Error(`Azure token request failed (${response.status}): ${errorText}`);
  }

  const tokenData = await response.json();
  console.log('[Azure Token] Token fetched successfully');
  console.log('[Azure Token] Expires in:', tokenData.expires_in, 'seconds');
  
  return tokenData;
};

export const getSnowflakeAccessToken = async () => {
  const tokenPath = resolveTokenFilePath();
  const cached = await readCachedToken(tokenPath);
  const now = Date.now();

  if (cached && cached.expires_at_ms - TOKEN_REFRESH_SKEW_MS > now) {
    return cached.access_token;
  }

  const tokenData = await fetchAzureToken();
  await writeCachedToken(tokenPath, tokenData);
  return tokenData.access_token;
};
