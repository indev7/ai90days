export async function handleBedrock({
  llmMessages,
  logHumanReadable,
  tools,
  extractActionsFromArgs,
  extractReqMoreInfoFromArgs,
  logLlmApiInteraction
}) {
  const bearerToken = process.env.AWS_BEARER_TOKEN_BEDROCK;
  const region = process.env.AWS_BEDROCK_REGION;
  const model = process.env.AWS_BEDROCK_MODEL;
  const maxTokens = parseInt(process.env.AWS_BEDROCK_MAX_TOKENS || process.env.ANTHROPIC_MAX_TOKENS || '4096', 10);
  if (!bearerToken) throw new Error('AWS Bedrock bearer token not configured');
  if (!region) throw new Error('AWS Bedrock region not configured');
  if (!model) throw new Error('AWS Bedrock model not configured');

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
  const endpoint = `https://bedrock-runtime.${region}.amazonaws.com/model/${encodeURIComponent(model)}/invoke`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${bearerToken}`
    },
    body: requestBody
  });

  if (!response.ok) {
    const errorBody = await response.text();
    await logLlmApiInteraction?.({
      provider: 'bedrock',
      request: {
        url: endpoint,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${bearerToken}`
        },
        body: requestBody
      },
      response: {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: errorBody
      },
      error: `Bedrock API error: ${response.status} - ${errorBody}`
    });
    console.error('Bedrock API Error Details:', errorBody);
    throw new Error(`Bedrock API error: ${response.status} - ${errorBody}`);
  }

  const responseBody = await response.json();

  await logLlmApiInteraction?.({
    provider: 'bedrock',
    request: {
      url: endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${bearerToken}`
      },
      body: requestBody
    },
    response: {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: JSON.stringify(responseBody)
    }
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (obj) => controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
      const contentBlocks = Array.isArray(responseBody?.content) ? responseBody.content : [];
      let actionsPayloads = [];
      let latestReqMoreInfo = null;
      let sentPreparing = false;
      let hasReqMoreInfoError = false;
      const prep = () => { if (!sentPreparing) { sentPreparing = true; send({ type: 'preparing_actions' }); } };
      const dedupe = (arr) => Array.from(new Map(arr.map(a => [JSON.stringify(a), a])).values());
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

      for (const block of contentBlocks) {
        if (block?.type === 'text' && block?.text) {
          send({ type: 'content', data: block.text });
        } else if (block?.type === 'tool_use') {
          const inputStr = JSON.stringify(block?.input ?? {});
          if (
            block?.name === 'emit_okrt_actions' ||
            block?.name === 'emit_okrt_share_actions'
          ) {
            const actions = extractActionsFromArgs?.(inputStr) || [];
            if (actions.length) actionsPayloads.push(...actions);
          } else if (block?.name === 'req_more_info') {
            const info = extractReqMoreInfoFromArgs?.(inputStr);
            if (info?.__invalid) {
              sendReqMoreInfoError();
            } else if (info) {
              latestReqMoreInfo = info;
            }
          }
        }
      }

      actionsPayloads = dedupe(actionsPayloads);
      if (actionsPayloads.length) {
        prep();
        send({ type: 'actions', data: actionsPayloads });
      }
      sendReqMoreInfo();
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
