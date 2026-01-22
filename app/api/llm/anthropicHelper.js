export async function handleAnthropic({
  llmMessages,
  logHumanReadable,
  getActionsTool,
  extractActionsFromArgs,
  logLlmApiInteraction
}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL_NAME || process.env.LLM_MODEL_NAME || 'claude-3-5-sonnet-20240620';
  const maxTokens = parseInt(process.env.ANTHROPIC_MAX_TOKENS || '4096', 10);
  if (!apiKey) throw new Error('Anthropic API key not configured');

  // Anthropic expects the system prompt separately; client messages are only user/assistant.
  const systemText = llmMessages
    .filter(m => m.role === 'system')
    .map(m => String(m.content ?? ''))
    .join('\n\n');

  // Normalize messages to Anthropic schema and drop empty content.
  const messages = llmMessages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: [{ type: 'text', text: String(m.content ?? '') }]
    }))
    .filter(m => m.content[0].text.trim().length > 0);

  // Expose a single tool (if defined) so Claude can return structured actions.
  const actionsTool = getActionsTool();
  const tools = actionsTool
    ? [
        {
          name: actionsTool.name,
          description: actionsTool.description,
          input_schema: actionsTool.parameters
        }
      ]
    : [];

  // Streamed response is turned into JSONL chunks for the coach page (/app/coach/page.js).
  const payload = {
    model,
    max_tokens: maxTokens,
    system: systemText,
    messages,
    tools,
    tool_choice: tools.length ? { type: 'auto' } : undefined,
    stream: true
  };
  const requestBody = JSON.stringify(payload);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: requestBody
  });

  if (!response.ok) {
    const errorBody = await response.text();
    await logLlmApiInteraction?.({
      provider: 'anthropic',
      request: {
        url: 'https://api.anthropic.com/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: requestBody
      },
      response: {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: errorBody
      },
      error: `Anthropic API error: ${response.status} - ${errorBody}`
    });
    console.error('Anthropic API Error Details:', errorBody);
    throw new Error(`Anthropic API error: ${response.status} - ${errorBody}`);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      // We parse Anthropic's SSE stream and re-emit JSON lines the client expects:
      // { type: 'content' | 'preparing_actions' | 'actions' | 'done', data?: ... }
      let pendingEvent = null;
      let dataLines = [];
      let carry = '';
      let sentPreparing = false;

      // Tool input arrives in chunks; buffer by tool id so we can parse once complete.
      const toolBuffers = new Map(); // id -> string[]
      const toolNames = new Map();   // id -> name
      const toolIndexToId = new Map(); // index(string) -> id
      const toolHasSeededInput = new Map(); // id -> boolean
      let actionsPayloads = [];      // aggregated actions
      let rawResponse = '';
      let hasLoggedRawResponse = false;

      const send = (obj) => controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
      const prep = () => { if (!sentPreparing) { sentPreparing = true; send({ type: 'preparing_actions' }); } };
      const dedupe = (arr) => Array.from(new Map(arr.map(a => [JSON.stringify(a), a])).values());
      const logRawResponse = () => {
        if (hasLoggedRawResponse) return;
        void logLlmApiInteraction?.({
          provider: 'anthropic',
          request: {
            url: 'https://api.anthropic.com/v1/messages',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01'
            },
            body: requestBody
          },
          response: {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            body: rawResponse
          }
        });
        hasLoggedRawResponse = true;
      };

      // Parse and aggregate any buffered tool input into action payloads.
      const flushAllTools = () => {
        for (const [id, parts] of toolBuffers.entries()) {
          try {
            const fullStr = (parts || []).join('');
            if (!fullStr) continue;
            const actions = extractActionsFromArgs(fullStr);
            if (actions.length) {
              actionsPayloads.push(...actions);
            }
          } catch (e) {
            console.error('Tool JSON parse error for', id, e);
          }
        }
        actionsPayloads = dedupe(actionsPayloads);
      };

      const handleEvent = (eventName, payloadStr) => {
        if (payloadStr === '[DONE]') {
          flushAllTools();
          if (actionsPayloads.length) { prep(); send({ type: 'actions', data: actionsPayloads }); }
          logRawResponse();
          send({ type: 'done' });
          return 'CLOSE';
        }

        let data;
        try { data = JSON.parse(payloadStr); } catch { data = payloadStr; }

        switch (eventName) {
          case 'content_block_start': {
            const block = data?.content_block;
            if (block?.type === 'tool_use' && block?.id) {
              toolBuffers.set(block.id, []);
              if (block?.name) toolNames.set(block.id, block.name);
              if (data?.index != null) toolIndexToId.set(String(data.index), block.id);
              const hasInput =
                block?.input &&
                typeof block.input === 'object' &&
                Object.keys(block.input).length > 0;
              if (hasInput) {
                toolBuffers.set(block.id, [JSON.stringify(block.input)]);
                toolHasSeededInput.set(block.id, true);
              }
              prep();
            }
            break;
          }
          case 'content_block_delta': {
            if (data?.delta?.text) {
              // Forward text chunks to the UI stream.
              send({ type: 'content', data: data.delta.text });
            }
            if (data?.delta?.type === 'input_json_delta' && data?.delta?.partial_json != null) {
              // Tool input JSON arrives incrementally; assemble by tool id or index.
              const bufferId =
                data?.id ||
                toolIndexToId.get(data?.index != null ? String(data.index) : '') ||
                data?.delta?.id;
              if (bufferId) {
                if (toolHasSeededInput.get(bufferId)) {
                  break;
                }
                const arr = toolBuffers.get(bufferId) || [];
                arr.push(String(data.delta.partial_json));
                toolBuffers.set(bufferId, arr);
                prep();
              }
            }
            break;
          }
          case 'content_block_stop': {
            flushAllTools();
            if (actionsPayloads.length) { prep(); send({ type: 'actions', data: actionsPayloads }); }
            break;
          }
          case 'message_stop': {
            flushAllTools();
            if (actionsPayloads.length) { prep(); send({ type: 'actions', data: actionsPayloads }); }
            logRawResponse();
            send({ type: 'done' });
            return 'CLOSE';
          }
          case 'message_delta': {
            if (data?.delta?.stop_reason) {
            }
            break;
          }
          case 'error': {
            console.error('Anthropic stream error:', data);
            logRawResponse();
            send({ type: 'done' });
            return 'CLOSE';
          }
          default:
            break;
        }
        return 'CONTINUE';
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            if (pendingEvent && dataLines.length) {
              const joined = dataLines.join('\n');
              const res = handleEvent(pendingEvent, joined);
              if (res === 'CLOSE') break;
            }
            logRawResponse();
            send({ type: 'done' });
            controller.close();
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          rawResponse += chunk;
          const lines = (carry + chunk).split(/\r?\n/);
          carry = lines.pop() || '';

          // SSE framing: event/data lines separated by blank line.
          for (const line of lines) {
            if (line.startsWith('event:')) {
              if (pendingEvent && dataLines.length) {
                const joined = dataLines.join('\n');
                const res = handleEvent(pendingEvent, joined);
                if (res === 'CLOSE') {
                  controller.close();
                  return;
                }
              }
              pendingEvent = line.slice(6).trim();
              dataLines = [];
              continue;
            }
            if (line.startsWith('data:')) { dataLines.push(line.slice(5)); continue; }
            if (line === '') {
              if (pendingEvent) {
                const joined = dataLines.join('\n');
                const res = handleEvent(pendingEvent, joined);
                pendingEvent = null;
                dataLines = [];
                if (res === 'CLOSE') {
                  controller.close();
                  return;
                }
              }
            }
          }
        }
      } catch (err) {
        console.error('Anthropic streaming error:', err);
        controller.error(err);
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
}
