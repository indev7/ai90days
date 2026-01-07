export async function handleAnthropic({
  llmMessages,
  logHumanReadable,
  getActionsTool,
  extractActionsFromArgs
}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL_NAME || process.env.LLM_MODEL_NAME || 'claude-3-5-sonnet-20240620';
  const maxTokens = parseInt(process.env.ANTHROPIC_MAX_TOKENS || '4096', 10);
  if (!apiKey) throw new Error('Anthropic API key not configured');

  const systemText = llmMessages
    .filter(m => m.role === 'system')
    .map(m => String(m.content ?? ''))
    .join('\n\n');

  const messages = llmMessages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: [{ type: 'text', text: String(m.content ?? '') }]
    }))
    .filter(m => m.content[0].text.trim().length > 0);

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

  const payload = {
    model,
    max_tokens: maxTokens,
    system: systemText,
    messages,
    tools,
    tool_choice: tools.length ? { type: 'auto' } : undefined,
    stream: true
  };

  logHumanReadable('ANTHROPIC API PAYLOAD', payload);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('Anthropic API Error Details:', errorBody);
    throw new Error(`Anthropic API error: ${response.status} - ${errorBody}`);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let pendingEvent = null;
      let dataLines = [];
      let carry = '';
      let sentPreparing = false;

      const toolBuffers = new Map(); // id -> string[]
      const toolNames = new Map();   // id -> name
      const toolIndexToId = new Map(); // index(string) -> id
      const toolHasSeededInput = new Map(); // id -> boolean
      let actionsPayloads = [];      // aggregated actions

      const send = (obj) => controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
      const prep = () => { if (!sentPreparing) { sentPreparing = true; send({ type: 'preparing_actions' }); } };
      const dedupe = (arr) => Array.from(new Map(arr.map(a => [JSON.stringify(a), a])).values());

      const flushAllTools = () => {
        for (const [id, parts] of toolBuffers.entries()) {
          try {
            const fullStr = (parts || []).join('');
            if (!fullStr) continue;
            console.log('[Anthropic] tool buffer flush:', {
              id,
              name: toolNames.get(id),
              length: fullStr.length
            });
            const actions = extractActionsFromArgs(fullStr);
            if (actions.length) {
              actionsPayloads.push(...actions);
            } else {
              console.warn('[Anthropic] Tool args parsed to empty actions:', fullStr.slice(0, 500));
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
              console.log('[Anthropic] tool_use start:', {
                id: block.id,
                name: block.name,
                index: data?.index,
                seeded: toolHasSeededInput.get(block.id) || false,
                hasInput
              });
              prep();
            }
            break;
          }
          case 'content_block_delta': {
            if (data?.delta?.text) {
              send({ type: 'content', data: data.delta.text });
            }
            if (data?.delta?.type === 'input_json_delta' && data?.delta?.partial_json != null) {
              const bufferId =
                data?.id ||
                toolIndexToId.get(data?.index != null ? String(data.index) : '') ||
                data?.delta?.id;
              if (bufferId) {
                if (toolHasSeededInput.get(bufferId)) {
                  break;
                }
                console.log('[Anthropic] input_json_delta:', {
                  id: bufferId,
                  index: data?.index,
                  chunk: String(data.delta.partial_json).slice(0, 120)
                });
                const arr = toolBuffers.get(bufferId) || [];
                arr.push(String(data.delta.partial_json));
                toolBuffers.set(bufferId, arr);
                prep();
              } else {
                console.warn('[Anthropic] input_json_delta missing tool id', {
                  index: data?.index,
                  deltaId: data?.delta?.id
                });
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
            send({ type: 'done' });
            return 'CLOSE';
          }
          case 'message_delta': {
            if (data?.delta?.stop_reason) {
              console.log('[Anthropic] stop_reason:', data.delta.stop_reason);
            }
            break;
          }
          case 'error': {
            console.error('Anthropic stream error:', data);
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
            send({ type: 'done' });
            controller.close();
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          const lines = (carry + chunk).split(/\r?\n/);
          carry = lines.pop() || '';

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
