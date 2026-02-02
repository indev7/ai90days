export async function handleOpenAI({
  llmMessages,
  logHumanReadable,
  tools,
  extractActionsFromArgs,
  extractRenderChartFromArgs,
  extractReqMoreInfoFromArgs,
  logLlmApiInteraction
}) {
  // Step 1: Read config and ensure OpenAI credentials exist.
  const apiKey = process.env.OPENAI_API_KEY || process.env.OPEN_AI_API_KEY;
  const model = process.env.LLM_MODEL_NAME || 'gpt-4o-mini';
  if (!apiKey) throw new Error('OpenAI API key not configured');

  // Step 2: Convert messages into the Responses API input format.
  // Convert ChatCompletion-style messages -> Responses input (role + typed content)
  const input = llmMessages.map(m => {
    const role = m.role === 'assistant' ? 'assistant' : (m.role === 'system' ? 'system' : 'user');
    const partType = role === 'assistant' ? 'output_text' : 'input_text';
    return { role, content: [{ type: partType, text: String(m.content ?? '') }] };
  });

  // Step 3: Build the OpenAI payload (model + tools + stream).
  // Build Responses API payload with tools enabled and streaming on.
  const activeTools = Array.isArray(tools) ? tools.filter(Boolean) : [];
  const blockReqMoreInfo = activeTools.some(
    (tool) =>
      tool?.name === 'emit_okrt_actions' ||
      tool?.name === 'emit_okrt_share_actions'
  );
  const openaiPayload = {
    model,
    input,
    tools: activeTools,
    tool_choice: activeTools.length ? 'auto' : undefined,
    stream: true
  };
  const requestBody = JSON.stringify(openaiPayload);

  // Step 4: Send request to OpenAI Responses API.
  // Call OpenAI Responses API.
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: requestBody
  });

  if (!response.ok) {
    const errorBody = await response.text();
    await logLlmApiInteraction?.({
      provider: 'openai',
      request: {
        url: 'https://api.openai.com/v1/responses',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: requestBody
      },
      response: {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: errorBody
      },
      error: `OpenAI API error: ${response.status} - ${errorBody}`
    });
    console.error('OpenAI API Error Details:', errorBody);
    throw new Error(`OpenAI API error: ${response.status} - ${errorBody}`);
  }

  // Step 5: Stream events back to the client as JSON lines.
  // Stream model output and tool calls back to the client as JSON lines.
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      // Step 6: Parse SSE frames (event + data lines).
      // Proper SSE framing: collect multi-line data blocks until a blank line ends the event.
      let pendingEvent = null;
      let dataLines = [];
      let carry = '';
      let sentPreparing = false;

      const toolBuffers = new Map(); // id -> string[] (arguments fragments)
      const toolNames = new Map();   // id -> name
      let actionsPayloads = [];      // aggregated actions
      let chartPayloads = [];
      let latestReqMoreInfo = null;
      let hasSentReqMoreInfo = false;
      let hasReqMoreInfoError = false;
      
      // Logging variables
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
        if (hasSentReqMoreInfo || !latestReqMoreInfo || blockReqMoreInfo || hasReqMoreInfoError) return;
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
          provider: 'openai',
          request: {
            url: 'https://api.openai.com/v1/responses',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
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

      // Step 7: Parse buffered tool argument fragments into actions.
      const flushAllTools = () => {
        for (const [id, parts] of toolBuffers.entries()) {
          try {
            const fullStr = (parts || []).join('');
            const toolName = toolNames.get(id);
            if (
              toolName === 'emit_okrt_actions' ||
              toolName === 'emit_okrt_share_actions'
            ) {
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
              } else if (blockReqMoreInfo) {
                sendReqMoreInfoError(
                  'I already have the tool schema I need, so I cannot request more info. Please retry.'
                );
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

      // Step 8: Extract actions from function call items.
      const handleFunctionCallItem = (item) => {
        if (!item) return;
        if (item.type !== 'function_call') return;
        if (
          item.name === 'emit_okrt_actions' ||
          item.name === 'emit_okrt_share_actions'
        ) {
          const actions = extractActionsFromArgs(item.arguments || '{}');
          if (actions.length) {
            actionsPayloads.push(...actions);
          }
          return;
        }
        if (item.name === 'render_chart') {
          const chart = extractRenderChartFromArgs?.(item.arguments || '{}');
          if (chart) chartPayloads.push(chart);
          return;
        }
        if (item.name === 'req_more_info') {
          const info = extractReqMoreInfoFromArgs?.(item.arguments || '{}');
          if (info?.__invalid) {
            sendReqMoreInfoError();
          } else if (blockReqMoreInfo) {
            sendReqMoreInfoError(
              'I already have the tool schema I need, so I cannot request more info. Please retry.'
            );
          } else if (info) {
            latestReqMoreInfo = info;
          }
        }
      };

      // Step 9: Extract tool calls from completed responses.
      const handleResponseCompletedOutput = (payloadObj) => {
        const out = payloadObj?.response?.output;
        if (Array.isArray(out)) {
          for (const item of out) handleFunctionCallItem(item);
        }
      };

      // Step 10: Handle each incoming SSE event type.
      // Handle each SSE event type from the Responses stream.
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
          case 'response.output_text.delta': {
            // Stream assistant text tokens.
            const textDelta = typeof data === 'string' ? (() => {
              try { const inner = JSON.parse(data); return inner?.delta ?? data; } catch { return data; }
            })() : (data?.delta ?? '');
            if (textDelta) {
              send({ type: 'content', data: textDelta });
            }
            break;
          }
          case 'response.output_text.done': {
            break;
          }

          case 'response.tool_call.created': {
            // Start buffering tool call arguments.
            const { id, type, name } = (typeof data === 'object' && data) || {};
            if (id) {
              toolBuffers.set(id, []);
              if (type === 'function' && name) toolNames.set(id, name);
            }
            if (
              name === 'emit_okrt_actions' ||
              name === 'emit_okrt_share_actions'
            ) {
              prep();
            }
            if (name === 'req_more_info' && blockReqMoreInfo) {
              sendReqMoreInfoError(
                'I already have the tool schema I need, so I cannot request more info. Please retry.'
              );
            }
            break;
          }
          case 'response.tool_call.delta': {
            // Append streamed tool arguments.
            const { id, delta } = (typeof data === 'object' && data) || {};
            if (id && delta?.arguments != null) {
              const arr = toolBuffers.get(id) || [];
              arr.push(String(delta.arguments));
              toolBuffers.set(id, arr);
            }
            break;
          }
          case 'response.tool_call.completed': {
            // Finalize tool arguments and emit actions if available.
            const { id, name, arguments: finalArgs } = (typeof data === 'object' && data) || {};
            if (id && finalArgs != null) toolBuffers.set(id, [String(finalArgs)]);
            if (id && name) toolNames.set(id, name);
            flushAllTools();
            if (actionsPayloads.length) {
              prep();
              send({ type: 'actions', data: actionsPayloads });
            }
            sendCharts();
            break;
          }

          // v2 style
          case 'response.function_call_arguments.delta': {
            // v2: streamed function call arguments.
            const { item_id, delta } = (typeof data === 'object' && data) || {};
            if (item_id && delta != null) {
              const arr = toolBuffers.get(item_id) || [];
              arr.push(String(delta));
              toolBuffers.set(item_id, arr);
              const toolName = toolNames.get(item_id);
              if (
                toolName === 'emit_okrt_actions' ||
                toolName === 'emit_okrt_share_actions'
              ) {
                prep();
              }
            }
            break;
          }
          case 'response.function_call_arguments.done': {
            // v2: finalize function call arguments.
            const { item_id, arguments: finalArgs } = (typeof data === 'object' && data) || {};
            if (item_id && finalArgs != null) toolBuffers.set(item_id, [String(finalArgs)]);
            flushAllTools();
            if (actionsPayloads.length) {
              prep();
              send({ type: 'actions', data: actionsPayloads });
            }
            sendCharts();
            break;
          }

          // Some models send function call as an output item
          case 'response.output_item.done': {
            // Some models emit function calls as output items.
            const item = (typeof data === 'object' && (data.item || data)) || null;
            handleFunctionCallItem(item);
            if (actionsPayloads.length) {
              prep();
              send({ type: 'actions', data: dedupe(actionsPayloads) });
            }
            sendCharts();
            break;
          }

          case 'response.completed': {
            // End-of-response: flush tools, log text, and close the stream.
            if (typeof data === 'object' && data) {
              handleResponseCompletedOutput(data);
            }
            flushAllTools();
            if (actionsPayloads.length) {
              prep();
              send({ type: 'actions', data: dedupe(actionsPayloads) });
            }
            sendCharts();
            sendReqMoreInfo();
            logRawResponse();
            send({ type: 'done' });
            return 'CLOSE';
          }

          case 'response.error': {
            // Error from Responses stream: flush any tool calls and close.
            console.error('Responses stream error:', data);
            flushAllTools();
            if (actionsPayloads.length) { prep(); send({ type: 'actions', data: actionsPayloads }); }
            sendCharts();
            sendReqMoreInfo();
            logRawResponse();
            send({ type: 'done' });
            return 'CLOSE';
          }

          default: break;
        }
        return 'CONTINUE';
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            // flush any buffered event
            if (pendingEvent && dataLines.length) {
              const joined = dataLines.join('\n');
              const res = handleEvent(pendingEvent, joined);
              if (res === 'CLOSE') break;
            }
            flushAllTools();
            if (actionsPayloads.length) { prep(); send({ type: 'actions', data: actionsPayloads }); }
            sendCharts();
            sendReqMoreInfo();
            logRawResponse();
            send({ type: 'done' });
            controller.close();
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          rawResponse += chunk;
          const lines = (carry + chunk).split(/\r?\n/);
          carry = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('event:')) {
              // finalize previous event
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
        console.error('OpenAI streaming error:', err);
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
