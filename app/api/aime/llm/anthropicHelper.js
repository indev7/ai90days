export async function handleAnthropic({
  llmMessages,
  logHumanReadable,
  tools,
  extractActionsFromArgs,
  extractRenderChartFromArgs,
  extractReqMoreInfoFromArgs,
  logLlmApiInteraction
}) {
  const ACTION_TOOL_NAMES = new Set([
    'emit_okrt_actions',
    'emit_okrt_share_actions',
    'emit_group_actions',
    'emit_ms_mail_actions',
    'emit_jira_query_actions'
  ]);
  const isActionToolName = (name) => ACTION_TOOL_NAMES.has(name);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL_NAME || process.env.LLM_MODEL_NAME || 'claude-3-5-sonnet-20240620';
  const maxTokens = parseInt(process.env.ANTHROPIC_MAX_TOKENS || '4096', 10);
  if (!apiKey) throw new Error('Anthropic API key not configured');

  // Anthropic expects the system prompt separately; client messages are only user/assistant.
  const systemText = llmMessages
    .filter(m => m.role === 'system')
    .map(m => String(m.content ?? ''))
    .join('\n\n');

  const toText = (value) => {
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value ?? null);
    } catch {
      return String(value ?? '');
    }
  };

  // Normalize chat + synthetic tool bridge messages to Anthropic schema.
  const messages = llmMessages
    .filter((m) => m.role !== 'system')
    .map((m) => {
      if (m?.toolUse?.id && m?.toolUse?.name) {
        return {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: String(m.toolUse.id),
              name: String(m.toolUse.name),
              input:
                m.toolUse.input && typeof m.toolUse.input === 'object'
                  ? m.toolUse.input
                  : {}
            }
          ]
        };
      }
      if (m?.toolResult?.toolUseId) {
        return {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: String(m.toolResult.toolUseId),
              content: toText(m.toolResult.payload)
            }
          ]
        };
      }
      const text = String(m.content ?? '').trim();
      if (!text) return null;
      return {
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: [{ type: 'text', text }]
      };
    })
    .filter(Boolean);

  // Expose tools so Claude can return structured actions or req_more_info.
  const activeTools = Array.isArray(tools) ? tools.filter(Boolean) : [];
  const toolsPayload = activeTools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters
  }));
  // Streamed response is turned into JSONL chunks for the coach page (/app/coach/page.js).
  const payload = {
    model,
    max_tokens: maxTokens,
    system: systemText,
    messages,
    tools: toolsPayload,
    tool_choice: toolsPayload.length ? { type: 'auto' } : undefined,
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
        body: payload
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
      let chartPayloads = [];
      let latestReqMoreInfo = null;
      let hasSentReqMoreInfo = false;
      let hasReqMoreInfoError = false;
      let rawResponse = '';
      let hasLoggedRawResponse = false;

      const send = (obj) => controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
      const prep = () => { if (!sentPreparing) { sentPreparing = true; send({ type: 'preparing_actions' }); } };
      const dedupe = (arr) => Array.from(new Map(arr.map(a => [JSON.stringify(a), a])).values());
      const dedupeCharts = (arr) => Array.from(new Map(arr.map(c => [JSON.stringify(c), c])).values());
      const sendCharts = () => {
        if (!chartPayloads.length) return;
        const uniqueCharts = dedupeCharts(chartPayloads);
        for (const chart of uniqueCharts) {
          send({ type: 'chart', data: chart });
        }
        chartPayloads = [];
      };
      const sendReqMoreInfo = () => {
        if (hasSentReqMoreInfo || !latestReqMoreInfo || hasReqMoreInfoError) return;
        send({ type: 'req_more_info', data: latestReqMoreInfo });
        hasSentReqMoreInfo = true;
      };
      const sendReqMoreInfoError = (reason) => {
        if (hasReqMoreInfoError) return;
        hasReqMoreInfoError = true;
        send({
          type: 'content',
          data:
            reason ||
            'Sorry, I could not process the req_more_info tool call because its arguments were invalid. Please retry.'
        });
      };
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
            body: payload
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
            const toolName = toolNames.get(id);
            if (isActionToolName(toolName)) {
              const actions = extractActionsFromArgs(fullStr);
              if (actions.length) {
                actionsPayloads.push(...actions);
              }
            } else if (toolName === 'render_chart') {
              const chart = extractRenderChartFromArgs?.(fullStr);
              if (chart) chartPayloads.push(chart);
            } else if (toolName === 'req_more_info') {
              const info = extractReqMoreInfoFromArgs?.(fullStr);
              if (info?.__invalid) {
                sendReqMoreInfoError();
              } else if (info) {
                latestReqMoreInfo = info;
              }
            }
            toolBuffers.delete(id);
          } catch (e) {
            console.error('Tool JSON parse error for', id, e);
          }
        }
        actionsPayloads = dedupe(actionsPayloads);
        chartPayloads = dedupeCharts(chartPayloads);
      };

      const handleEvent = (eventName, payloadStr) => {
        if (payloadStr === '[DONE]') {
          flushAllTools();
          if (actionsPayloads.length) { prep(); send({ type: 'actions', data: actionsPayloads }); }
          sendCharts();
          sendReqMoreInfo();
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
              if (isActionToolName(block?.name)) {
                prep();
              }
              // Note: We don't block req_more_info here at content_block_start because we need to see the full arguments first
              // The blocking logic is in flushAllTools() where we can inspect what's being requested
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
                const toolName = toolNames.get(bufferId);
                if (isActionToolName(toolName)) {
                  prep();
                }
              }
            }
            break;
          }
          case 'content_block_stop': {
            flushAllTools();
            if (actionsPayloads.length) { prep(); send({ type: 'actions', data: actionsPayloads }); }
            sendCharts();
            sendReqMoreInfo();
            break;
          }
          case 'message_stop': {
            flushAllTools();
            if (actionsPayloads.length) { prep(); send({ type: 'actions', data: actionsPayloads }); }
            sendCharts();
            sendReqMoreInfo();
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
            sendReqMoreInfo();
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
            sendReqMoreInfo();
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
