import fs from 'fs';
import path from 'path';

const LOG_FILE_NAME = 'llm_api_req_res.txt';
const LOG_PATH = path.join(process.cwd(), LOG_FILE_NAME);

function redactHeaders(headers) {
  if (!headers || typeof headers !== 'object') return headers;
  const copy = { ...headers };
  for (const key of Object.keys(copy)) {
    const lowerKey = key.toLowerCase();
    if (lowerKey === 'authorization' || lowerKey === 'x-api-key') {
      copy[key] = '[REDACTED]';
    }
  }
  return copy;
}

function safeStringify(value) {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch (err) {
    return String(value);
  }
}

export async function logLlmApiInteraction({
  provider,
  request,
  response,
  error
}) {
  const entry = {
    timestamp: new Date().toISOString(),
    provider,
    request: request
      ? {
          url: request.url,
          method: request.method,
          headers: redactHeaders(request.headers),
          body: request.body
        }
      : undefined,
    response: response
      ? {
          status: response.status,
          statusText: response.statusText,
          headers: redactHeaders(response.headers),
          body: response.body
        }
      : undefined,
    error: error ? String(error) : undefined
  };

  const logBlock = [
    '=== LLM API INTERACTION ===',
    safeStringify(entry),
    '=== END LLM API INTERACTION ===',
    ''
  ].join('\n');

  try {
    await fs.promises.appendFile(LOG_PATH, logBlock, 'utf8');
  } catch (err) {
    console.error('Failed to write LLM API log:', err);
  }
}
