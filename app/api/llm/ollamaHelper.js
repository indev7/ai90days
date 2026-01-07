export async function handleOllama({ llmMessages, logHumanReadable }) {
  const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  const model = process.env.LLM_MODEL_NAME || process.env.LLM_CHAT_MODEL || 'llama3:latest';
  console.log('[AI Coach] LLM provider: ollama, model:', model);

  const ollamaPayload = { model, messages: llmMessages, stream: true };
  logHumanReadable('OLLAMA API PAYLOAD', ollamaPayload);

  const response = await fetch(`${ollamaUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ollamaPayload)
  });
  if (!response.ok) throw new Error(`Ollama API error: ${response.status}`);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const reader = response.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            controller.enqueue(encoder.encode(JSON.stringify({ type: 'done' }) + '\n'));
            controller.close();
            break;
          }
          const chunk = new TextDecoder().decode(value);
          const lines = chunk.split('\n').filter(l => l.trim());
          for (const line of lines) {
            try {
              const data = JSON.parse(line);
              if (data.message?.content) {
                controller.enqueue(encoder.encode(JSON.stringify({ type: 'content', data: data.message.content }) + '\n'));
              }
              if (data.done) {
                controller.enqueue(encoder.encode(JSON.stringify({ type: 'done' }) + '\n'));
              }
            } catch (e) {
              console.error('Ollama chunk parse error:', e);
            }
          }
        }
      } catch (err) {
        console.error('Ollama streaming error:', err);
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
