export async function handleOpenAI({
  llmMessages,
  logHumanReadable,
  getActionsTool,
  extractActionsFromArgs
}) {
  // Step 1: Read config and ensure OpenAI credentials exist.
  const apiKey = process.env.OPENAI_API_KEY || process.env.OPEN_AI_API_KEY;
  const model = process.env.LLM_MODEL_NAME || 'gpt-4o-mini';
  console.log('[AI Coach] LLM provider: openai, model:', model);
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
  const openaiPayload = { model, input, tools: [getActionsTool()], tool_choice: "auto", stream: true };
  logHumanReadable('OPENAI API PAYLOAD', openaiPayload);

  // Step 4: Send request to OpenAI Responses API.
  // Call OpenAI Responses API.
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(openaiPayload)
  });

  if (!response.ok) {
    const errorBody = await response.text();
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
      
      // Logging variables
      let fullTextResponse = '';
      let hasLoggedTextResponse = false;

      const send = (obj) => controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
      const prep = () => { if (!sentPreparing) { sentPreparing = true; send({ type: 'preparing_actions' }); } };
      const dedupe = (arr) => Array.from(new Map(arr.map(a => [JSON.stringify(a), a])).values());

      // Step 7: Parse buffered tool argument fragments into actions.
      const flushAllTools = () => {
        for (const [id, parts] of toolBuffers.entries()) {
          try {
            const fullStr = (parts || []).join('');
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

      // Step 8: Extract actions from function call items.
      const handleFunctionCallItem = (item) => {
        if (!item) return;
        if (item.type === 'function_call' && item.name === 'emit_actions') {
          const actions = extractActionsFromArgs(item.arguments || '{}');
          if (actions.length) {
            actionsPayloads.push(...actions);
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
              fullTextResponse += textDelta;
              send({ type: 'content', data: textDelta });
            }
            break;
          }
          case 'response.output_text.done': {
            // Log complete text response when text generation is done.
            if (fullTextResponse.trim() && !hasLoggedTextResponse) {
              console.log('=== OPENAI FULL TEXT RESPONSE ===');
              console.log(fullTextResponse);
              console.log('=== END OPENAI TEXT RESPONSE ===');
              hasLoggedTextResponse = true;
            }
            break;
          }

          case 'response.tool_call.created': {
            // Start buffering tool call arguments.
            const { id, type, name } = (typeof data === 'object' && data) || {};
            if (id) {
              toolBuffers.set(id, []);
              if (type === 'function' && name) toolNames.set(id, name);
            }
            prep();
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
              console.log('=== OPENAI COMPLETE TOOL RESPONSE ===');
              console.log(JSON.stringify(actionsPayloads, null, 2));
              console.log('=== END OPENAI TOOL RESPONSE ===');
              prep();
              send({ type: 'actions', data: actionsPayloads });
            }
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
              prep();
            }
            break;
          }
          case 'response.function_call_arguments.done': {
            // v2: finalize function call arguments.
            const { item_id, arguments: finalArgs } = (typeof data === 'object' && data) || {};
            if (item_id && finalArgs != null) toolBuffers.set(item_id, [String(finalArgs)]);
            flushAllTools();
            if (actionsPayloads.length) {
              console.log('=== OPENAI COMPLETE TOOL RESPONSE ===');
              console.log(JSON.stringify(actionsPayloads, null, 2));
              console.log('=== END OPENAI TOOL RESPONSE ===');
              prep();
              send({ type: 'actions', data: actionsPayloads });
            }
            break;
          }

          // Some models send function call as an output item
          case 'response.output_item.done': {
            // Some models emit function calls as output items.
            const item = (typeof data === 'object' && (data.item || data)) || null;
            handleFunctionCallItem(item);
            if (actionsPayloads.length) {
              console.log('=== OPENAI COMPLETE TOOL RESPONSE ===');
              console.log(JSON.stringify(dedupe(actionsPayloads), null, 2));
              console.log('=== END OPENAI TOOL RESPONSE ===');
              prep();
              send({ type: 'actions', data: dedupe(actionsPayloads) });
            }
            break;
          }

          case 'response.completed': {
            // End-of-response: flush tools, log text, and close the stream.
            if (typeof data === 'object' && data) {
              handleResponseCompletedOutput(data);
            }
            flushAllTools();
            if (actionsPayloads.length) {
              console.log('=== OPENAI COMPLETE TOOL RESPONSE ===');
              console.log(JSON.stringify(dedupe(actionsPayloads), null, 2));
              console.log('=== END OPENAI TOOL RESPONSE ===');
              prep();
              send({ type: 'actions', data: dedupe(actionsPayloads) });
            }
            // Log complete text response if not already logged
            if (fullTextResponse.trim() && !hasLoggedTextResponse) {
              console.log('=== OPENAI FULL TEXT RESPONSE ===');
              console.log(fullTextResponse);
              console.log('=== END OPENAI TEXT RESPONSE ===');
            }
            send({ type: 'done' });
            return 'CLOSE';
          }

          case 'response.error': {
            // Error from Responses stream: flush any tool calls and close.
            console.error('Responses stream error:', data);
            flushAllTools();
            if (actionsPayloads.length) { prep(); send({ type: 'actions', data: actionsPayloads }); }
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
            send({ type: 'done' });
            controller.close();
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
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
