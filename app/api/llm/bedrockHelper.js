import { BedrockRuntimeClient, InvokeModelWithResponseStreamCommand } from '@aws-sdk/client-bedrock-runtime';

export async function handleBedrock({
  llmMessages,
  logHumanReadable,
  getActionsTool,
  extractActionsFromArgs,
  logLlmApiInteraction
}) {
  const region = process.env.AWS_BEDROCK_REGION;
  const model = process.env.AWS_BEDROCK_MODEL;
  const accessKeyId = process.env.AWS_BEDROCK_USER_KEY;
  const secretAccessKey = process.env.AWS_BEDROCK_USER_SECRET;
  const sessionToken = process.env.AWS_BEDROCK_SESSION_TOKEN;
  const maxTokens = parseInt(process.env.AWS_BEDROCK_MAX_TOKENS || process.env.ANTHROPIC_MAX_TOKENS || '4096', 10);
  if (!region) throw new Error('AWS Bedrock region not configured');
  if (!model) throw new Error('AWS Bedrock model not configured');
  if (!accessKeyId || !secretAccessKey) {
    throw new Error('AWS Bedrock IAM user credentials not configured');
  }

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
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: maxTokens,
    system: systemText,
    messages,
    tools,
    tool_choice: tools.length ? { type: 'auto' } : undefined
  };
  const requestBody = JSON.stringify(payload);
  const client = new BedrockRuntimeClient({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
      sessionToken
    }
  });

  let response;
  try {
    response = await client.send(
      new InvokeModelWithResponseStreamCommand({
        modelId: model,
        contentType: 'application/json',
        accept: 'application/json',
        body: Buffer.from(requestBody)
      })
    );
  } catch (error) {
    await logLlmApiInteraction?.({
      provider: 'bedrock',
      request: {
        modelId: model,
        contentType: 'application/json',
        accept: 'application/json',
        body: requestBody
      },
      response: {
        status: error?.$metadata?.httpStatusCode,
        statusText: error?.name,
        headers: error?.$metadata?.httpHeaders,
        body: error?.message
      },
      error: `Bedrock API error: ${error?.message || 'Unknown error'}`
    });
    console.error('Bedrock API Error Details:', error);
    throw new Error(`Bedrock API error: ${error?.message || 'Unknown error'}`);
  }

  await logLlmApiInteraction?.({
    provider: 'bedrock',
    request: {
      modelId: model,
      contentType: 'application/json',
      accept: 'application/json',
      body: requestBody
    },
    response: {
      status: response?.$metadata?.httpStatusCode,
      statusText: response?.$metadata?.requestId,
      headers: response?.$metadata?.httpHeaders,
      body: ''
    }
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj) => controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
      let actionsPayloads = [];
      let sentPreparing = false;
      let pendingBuffer = '';
      const prep = () => { if (!sentPreparing) { sentPreparing = true; send({ type: 'preparing_actions' }); } };
      const dedupe = (arr) => Array.from(new Map(arr.map(a => [JSON.stringify(a), a])).values());
      const toolBuffers = new Map();
      const toolIndexToId = new Map();
      const toolHasSeededInput = new Map();

      const extractJsonObjects = (text) => {
        const objects = [];
        let depth = 0;
        let inString = false;
        let escape = false;
        let startIndex = null;

        for (let i = 0; i < text.length; i += 1) {
          const ch = text[i];
          if (inString) {
            if (escape) {
              escape = false;
            } else if (ch === '\\') {
              escape = true;
            } else if (ch === '"') {
              inString = false;
            }
            continue;
          }

          if (ch === '"') {
            inString = true;
            continue;
          }
          if (ch === '{') {
            if (depth === 0) startIndex = i;
            depth += 1;
          } else if (ch === '}') {
            depth -= 1;
            if (depth === 0 && startIndex != null) {
              objects.push(text.slice(startIndex, i + 1));
              startIndex = null;
            }
          }
        }

        const rest = depth === 0 ? '' : text.slice(startIndex ?? 0);
        return { objects, rest };
      };

      const flushAllTools = () => {
        for (const [id, parts] of toolBuffers.entries()) {
          try {
            const fullStr = (parts || []).join('');
            if (!fullStr) continue;
            const actions = extractActionsFromArgs?.(fullStr) || [];
            if (actions.length) actionsPayloads.push(...actions);
          } catch (e) {
            console.error('Tool JSON parse error for', id, e);
          }
        }
        actionsPayloads = dedupe(actionsPayloads);
      };

      const handleEvent = (payload) => {
        if (!payload || typeof payload !== 'object') return;
        switch (payload.type) {
          case 'content_block_start': {
            const block = payload?.content_block;
            if (block?.type === 'tool_use' && block?.id) {
              toolBuffers.set(block.id, []);
              if (payload?.index != null) toolIndexToId.set(String(payload.index), block.id);
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
            if (payload?.delta?.text) {
              send({ type: 'content', data: payload.delta.text });
            }
            if (payload?.delta?.type === 'input_json_delta' && payload?.delta?.partial_json != null) {
              const bufferId =
                payload?.id ||
                toolIndexToId.get(payload?.index != null ? String(payload.index) : '') ||
                payload?.delta?.id;
              if (bufferId) {
                if (toolHasSeededInput.get(bufferId)) break;
                const arr = toolBuffers.get(bufferId) || [];
                arr.push(String(payload.delta.partial_json));
                toolBuffers.set(bufferId, arr);
              }
            }
            break;
          }
          case 'content_block_stop':
          case 'message_stop': {
            flushAllTools();
            break;
          }
          default:
            break;
        }
      };

      try {
        for await (const event of response?.body || []) {
          if (!event?.chunk?.bytes) continue;
          const chunkText = new TextDecoder().decode(event.chunk.bytes);
          const combined = pendingBuffer + chunkText;
          const { objects, rest } = extractJsonObjects(combined);
          pendingBuffer = rest;
          for (const jsonText of objects) {
            try {
              handleEvent(JSON.parse(jsonText));
            } catch (e) {
              console.error('Bedrock stream JSON parse error:', e);
            }
          }
        }
        if (pendingBuffer.trim()) {
          const { objects } = extractJsonObjects(pendingBuffer);
          for (const jsonText of objects) {
            try {
              handleEvent(JSON.parse(jsonText));
            } catch (e) {
              console.error('Bedrock stream JSON parse error:', e);
            }
          }
        }
      } catch (err) {
        console.error('Bedrock streaming error:', err);
      }

      actionsPayloads = dedupe(actionsPayloads);
      if (actionsPayloads.length) {
        prep();
        send({ type: 'actions', data: actionsPayloads });
      }
      send({ type: 'done' });
      controller.close();
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
