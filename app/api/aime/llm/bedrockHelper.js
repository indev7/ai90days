import { BedrockRuntimeClient, InvokeModelWithResponseStreamCommand } from '@aws-sdk/client-bedrock-runtime';

export async function handleBedrock({
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
    'emit_okrt_transfer_actions',
    'emit_group_actions',
    'emit_ms_mail_actions',
    'emit_jira_query_actions',
    'emit_jira_link_actions',
    'emit_confluence_query_actions',
    'emit_snowflake_query_actions'
  ]);
  const isActionToolName = (name) => ACTION_TOOL_NAMES.has(name);

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

  const toText = (value) => {
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value ?? null);
    } catch {
      return String(value ?? '');
    }
  };

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

  const activeTools = Array.isArray(tools) ? tools.filter(Boolean) : [];
  const toolsPayload = activeTools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters
  }));

  const payload = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: maxTokens,
    system: systemText,
    messages,
    tools: toolsPayload,
    tool_choice: toolsPayload.length ? { type: 'auto' } : undefined
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
        body: payload
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

  const responseMeta = {
    status: response?.$metadata?.httpStatusCode,
    statusText: response?.$metadata?.requestId,
    headers: response?.$metadata?.httpHeaders
  };

  const encoder = new TextEncoder();
const stream = new ReadableStream({
async start(controller) {
  const send = (obj) => controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
  let actionsPayloads = [];
  let chartPayloads = [];
  let latestReqMoreInfo = null;
  let sentPreparing = false;
  let hasReqMoreInfoError = false;
  let pendingBuffer = '';
  let rawResponse = '';
  let hasLoggedRawResponse = false;
  const MAX_LOGGED_RESPONSE_CHARS = 200000;
  let usageMetadata = { inputTokens: 0, outputTokens: 0 };
      const prep = () => { if (!sentPreparing) { sentPreparing = true; send({ type: 'preparing_actions' }); } };
      const dedupe = (arr) => Array.from(new Map(arr.map(a => [JSON.stringify(a), a])).values());
      const dedupeCharts = (arr) => Array.from(new Map(arr.map(c => [JSON.stringify(c), c])).values());
      const appendRawResponse = (chunkText) => {
        if (!chunkText) return;
        if (rawResponse.length >= MAX_LOGGED_RESPONSE_CHARS) return;
        const remaining = MAX_LOGGED_RESPONSE_CHARS - rawResponse.length;
        rawResponse += chunkText.slice(0, remaining);
      };
      const logRawResponse = async () => {
        if (hasLoggedRawResponse) return;
        hasLoggedRawResponse = true;
        const body =
          rawResponse.length >= MAX_LOGGED_RESPONSE_CHARS
            ? `${rawResponse}\n...[truncated]`
            : rawResponse;
        await logLlmApiInteraction?.({
          provider: 'bedrock',
          request: {
            modelId: model,
            contentType: 'application/json',
            accept: 'application/json',
            body: payload
          },
          response: {
            ...responseMeta,
            body
          }
        });
      };
      const sendCharts = () => {
        if (!chartPayloads.length) return;
        const uniqueCharts = dedupeCharts(chartPayloads);
        for (const chart of uniqueCharts) {
          send({ type: 'chart', data: chart });
        }
        chartPayloads = [];
      };
      const sendReqMoreInfo = () => {
        if (!latestReqMoreInfo || hasReqMoreInfoError) return;
        send({ type: 'req_more_info', data: latestReqMoreInfo });
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
            const toolName = toolNames.get(id);
            if (isActionToolName(toolName)) {
              const actions = extractActionsFromArgs?.(fullStr) || [];
              if (actions.length) actionsPayloads.push(...actions);
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

      const toolNames = new Map();
      const handleEvent = (payload) => {
        if (!payload || typeof payload !== 'object') return;
        
        // Capture usage metadata
        if (payload.type === 'message_start' && payload?.message?.usage) {
          usageMetadata.inputTokens = payload.message.usage.input_tokens || 0;
        }
        if (payload.type === 'message_delta' && payload?.usage) {
          usageMetadata.outputTokens = payload.usage.output_tokens || 0;
        }
        
        switch (payload.type) {
          case 'content_block_start': {
            const block = payload?.content_block;
            if (block?.type === 'tool_use' && block?.id) {
              toolBuffers.set(block.id, []);
              if (block?.name) toolNames.set(block.id, block.name);
              if (payload?.index != null) toolIndexToId.set(String(payload.index), block.id);
              const hasInput =
                block?.input &&
                typeof block.input === 'object' &&
                Object.keys(block.input).length > 0;
              if (hasInput) {
                toolBuffers.set(block.id, [JSON.stringify(block.input)]);
                toolHasSeededInput.set(block.id, true);
              }
              if (isActionToolName(block?.name) || block?.name === 'req_more_info') {
                prep();
              }
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
          appendRawResponse(chunkText);
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
      sendCharts();
      sendReqMoreInfo();
      await logRawResponse();
      
      // Send usage metadata before done
      if (usageMetadata.inputTokens > 0 || usageMetadata.outputTokens > 0) {
        send({ type: 'usage', data: usageMetadata });
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
