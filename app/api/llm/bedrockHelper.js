export async function handleBedrock({
  llmMessages,
  logHumanReadable,
  getActionsTool,
  extractActionsFromArgs,
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
      let sentPreparing = false;
      const prep = () => { if (!sentPreparing) { sentPreparing = true; send({ type: 'preparing_actions' }); } };
      const dedupe = (arr) => Array.from(new Map(arr.map(a => [JSON.stringify(a), a])).values());

      for (const block of contentBlocks) {
        if (block?.type === 'text' && block?.text) {
          send({ type: 'content', data: block.text });
        } else if (block?.type === 'tool_use') {
          const inputStr = JSON.stringify(block?.input ?? {});
          const actions = extractActionsFromArgs?.(inputStr) || [];
          if (actions.length) actionsPayloads.push(...actions);
        }
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
