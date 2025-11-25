// app/api/llm/route.js
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDatabase, get, all } from '@/lib/pgdb';

/* =========================
   Utility functions
   ========================= */
function logHumanReadable(title, obj) {
  console.log(`=== ${title} ===`);
  
  // First stringify normally, then replace escape sequences with actual characters
  let jsonString = JSON.stringify(obj, null, 2);
  
  // Replace escaped characters with actual characters for better readability
  jsonString = jsonString
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\r/g, '\r')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
  
  console.log(jsonString);
  console.log(`=== END ${title} ===`);
}

/* =========================
   Time/Quarter helpers
   ========================= */
function getCurrentQuarter() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const quarter = Math.ceil(month / 3);
  return `${year}-Q${quarter}`;
}

function getTimeContext() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const quarter = Math.ceil(month / 3);

  const qStart = new Date(year, (quarter - 1) * 3, 1);
  const qEnd = new Date(year, quarter * 3, 0);

  const dayOfQuarter = Math.floor((now - qStart) / (1000 * 60 * 60 * 24)) + 1;
  const totalQuarterDays = Math.floor((qEnd - qStart) / (1000 * 60 * 60 * 24)) + 1;

  const quarterMonths = ['Jan–Mar', 'Apr–Jun', 'Jul–Sep', 'Oct–Dec'][quarter - 1];

  const offsetMinutes = now.getTimezoneOffset();
  const offsetHours = Math.abs(Math.trunc(offsetMinutes / 60));
  const offsetMins = Math.abs(offsetMinutes % 60);
  const sign = offsetMinutes <= 0 ? '+' : '-';
  const utcOffset = `${sign}${String(offsetHours).padStart(2, '0')}:${String(offsetMins).padStart(2, '0')}`;

  return {
    nowISO: now.toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    utcOffset,
    currentQuarter: `${year}-Q${quarter}`,
    quarterStart: qStart.toISOString().split('T')[0],
    quarterEnd: qEnd.toISOString().split('T')[0],
    dayOfQuarter,
    totalQuarterDays,
    quarterMonths
  };
}

/* =========================
   Cleaners / DB context
   ========================= */
function cleanObject(obj) {
  if (Array.isArray(obj)) {
    return obj.map(cleanObject).filter(item => {
      if (typeof item === 'object' && item !== null) {
        return Object.keys(item).length > 0;
      }
      return item !== null && item !== undefined && item !== '';
    });
  } else if (typeof obj === 'object' && obj !== null) {
    return Object.entries(obj).reduce((acc, [key, value]) => {
      if (
        value !== null &&
        value !== undefined &&
        value !== '' &&
        !(Array.isArray(value) && value.length === 0)
      ) {
        acc[key] = cleanObject(value);
      }
      return acc;
    }, {});
  }
  return obj;
}

async function getOKRTContext(userId) {
  try {
    await getDatabase(); // Ensure database is initialized
    const currentQuarter = getCurrentQuarter();

    const user = await get(`SELECT display_name FROM users WHERE id = ?`, [userId]);
    const displayName = user?.display_name || 'User';

    const objectives = await all(
      `SELECT * FROM okrt
       WHERE owner_id = ? AND type = 'O'
       ORDER BY
         CASE WHEN cycle_qtr = ? THEN 0 ELSE 1 END,
         status = 'A' DESC,
         created_at DESC
       LIMIT 3`,
      [userId, currentQuarter]
    );

    const context = { user: { displayName }, objectives: [] };

    for (const obj of objectives) {
      const objData = { ...obj, krs: [] };
      const krs = await all(
        `SELECT * FROM okrt
         WHERE owner_id = ? AND parent_id = ? AND type = 'K'
         ORDER BY created_at DESC
         LIMIT 3`,
        [userId, obj.id]
      );
      for (const kr of krs) {
        const krData = { ...kr, tasks: [] };
        const tasks = await all(
          `SELECT * FROM okrt
           WHERE owner_id = ? AND parent_id = ? AND type = 'T'
           ORDER BY task_status = 'in_progress' DESC, created_at DESC
           LIMIT 3`,
          [userId, kr.id]
        );
        krData.tasks = tasks;
        objData.krs.push(krData);
      }
      context.objectives.push(objData);
    }

    return cleanObject(context);
  } catch (error) {
    console.error('Error fetching OKRT context:', error);
    return { user: { displayName: 'User' }, objectives: [] };
  }
}

/* =========================
   System prompt
   ========================= */
function getCoachSystemPrompt(okrtContext) {
  const timeCtx = getTimeContext();
  const displayName = okrtContext?.user?.displayName || 'User';
  const objectives = okrtContext?.objectives || [];
  const krCount = objectives.reduce((sum, o) => sum + (Array.isArray(o.krs) ? o.krs.length : 0), 0);

  const contextBlock = objectives.length > 0
    ? `
CONTEXT - Current User's Information and OKRTs:
User Display Name: ${displayName}
Number of Objectives: ${objectives.length}
Full OKRT Data (JSON below is reliable and authoritative):
${JSON.stringify(okrtContext)}
Summary: ${displayName} has ${objectives.length} objective(s) with ${krCount} key result(s).`
    : `
CONTEXT - Current User's Information and OKRTs:
User Display Name: ${displayName}
Number of Objectives: 0
No OKRTs found for this user in the current quarter.`;

  const timeBlock = `
TIME CONTEXT:
- Now (ISO): ${timeCtx.nowISO}
- Timezone: ${timeCtx.timezone} (UTC${timeCtx.utcOffset})
- Current quarter: ${timeCtx.currentQuarter}
- Quarter window: ${timeCtx.quarterStart} → ${timeCtx.quarterEnd}
- Day in cycle: ${timeCtx.dayOfQuarter}/${timeCtx.totalQuarterDays}
- Quarter months: ${timeCtx.quarterMonths}`;

  return `You are an OKRT coach inside the "90Days App". When the user has only an outline of an idea, you will help to well define OKRTs. You will also offer motivation, planing, updating the OKRTs, timing of tasks, when a child task makes progress, offer inspiration and motivational stories, links and videos. 
  offer to send update actions when user input suggests so. 
STYLE & ADDRESSING
- Address the user EXACTLY as "${displayName}".
ACTION GUARDRAILS
- Ask clarifying questions before proposing Objectives/KRs/Tasks. Do not exceed three clafifications.

STRICT JSON CONTRACT FOR ACTIONS
- Emit via the tool only: { "actions": [ ... ] } with required keys.

SCOPE & DATA MODEL
- Single table "okrt" with types O/K/T and parent_id hierarchy.
- If the user intend to update task progress, then propagate progress upwards to KR and to Objective using weighted sum.
- Types: Objective (O), Key Result (K), Task (T). Hierarchy via parent_id.
- Objective (O): title, description, area (Life/Work/Health), cycle_qtr, status (D-Draft/A-Active/C-Complete), visibility (private/shared), objective_kind (committed/stretch), progress (0–100).
- Key Result (K): description (required), kr_target_number, kr_unit ∈ {count, %, $, hrs}, kr_baseline_number?, weight (default 1.0), progress (0–100).
- Task (T): description (required), due_date?, task_status ∈ {todo, in_progress, done, blocked}, weight (default 1.0), progress (0–100).
- Progress propagation: parent_progress = Σ(child_progress × child_weight). Sibling weights under one parent should sum to 1.0.


OUTPUT CONTRACT
1) Stream a short paragraph of coaching text.
2) If changes are requested, call "emit_actions" once with an ordered "actions" array.

ID SAFETY (MANDATORY)
- For UPDATE_OKRT and DELETE_OKRT you MUST copy IDs exactly as they appear in CONTEXT. Never modify, shorten, or reformat IDs.
- For every CREATE_OKRT payload you MUST include an "id".
- New IDs must be in gen-XXXXXXXX format where X is a lowercase letter or digit.
- When creating new OKRTs for an existing parent, use the exact parent id and set it in childrens parent_id field 
- Parent chaining for a newly created tree:
  - Objective: id = gen-XXXXXXXX
  - Each KR:   id = gen-XXXXXXXX, parent_id = <Objective's gen-XXXXXXXX>
  - Each Task: id = gen-XXXXXXXX, parent_id = <its KR's gen-XXXXXXXX>
- Emit actions in strict parent→child order (Objective, then its KRs, then their Tasks).
- Output the entire tool_call arguments JSON in a single contiguous block (do not split keys/values across deltas).


${timeBlock}${contextBlock}`;
}

/* =========================
   Tool (Responses API shape)
   ========================= */
function getActionsTool() {
  const uuidV4 = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$';
  const genId  = '^gen-[a-z0-9]{8}$';

  return {
    type: "function",
    name: "emit_actions",
    description: "Emit an ordered list of OKRT actions (create, update, delete).",
    parameters: {
      type: "object",
      properties: {
        actions: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            required: ["intent", "endpoint", "method", "payload"],
            properties: {
              intent:   { type: "string", enum: ["CREATE_OKRT", "UPDATE_OKRT", "DELETE_OKRT"] },
              endpoint: { type: "string", enum: ["/api/okrt", "/api/okrt/[id]"] },
              method:   { type: "string", enum: ["POST", "PUT", "DELETE"] },
              payload: {
                type: "object",
                properties: {
                  id: {
                    allOf: [
                      { anyOf: [
                          { type: "string", pattern: uuidV4 },
                          { type: "string", pattern: genId }
                        ]
                      }
                    ]
                  },
                  type: { type: "string", enum: ["O","K","T"] },
                  owner_id: { type: "integer" }, // (server should ignore/overwrite)
                  parent_id: {
                    allOf: [
                      { anyOf: [
                          { type: "string", pattern: uuidV4 },
                          { type: "string", pattern: genId }
                        ]
                      }
                    ]
                  },
                  description: { type: "string" },
                  progress:    { type: "number" },
                  order_index: { type: "integer" },
                  task_status: { type: "string", enum: ["todo","in_progress","done","blocked"] },
                  title: { type: "string" },
                  area:  { type: "string" },
                  visibility: { type: "string", enum: ["private","shared"] },
                  objective_kind: { type: "string", enum: ["committed","stretch"] },
                  status: { type: "string", enum: ["D","A","C"] },
                  cycle_qtr: { type: "string" },
                  kr_target_number:   { type: "number" },
                  kr_unit:            { type: "string", enum: ["%","$","count","hrs"] },
                  kr_baseline_number: { type: "number" },
                  weight:     { type: "number" },
                  due_date:   { type: "string" },
                  recurrence_json: { type: "string" },
                  blocked_by: { type: "string" },
                  repeat: { type: "string", enum: ["Y","N"] }
                },
                additionalProperties: true
              }
            },
            additionalProperties: true
          }
        }
      },
      required: ["actions"],
      additionalProperties: true
    }
  };
}


/* =========================
   Helpers: tool args parsing
   ========================= */
function extractActionsFromArgs(argsStr) {
  try {
    const parsed = JSON.parse(argsStr || '{}');
    if (Array.isArray(parsed)) return parsed;                // non-standard: model returned array directly
    if (parsed?.actions && Array.isArray(parsed.actions)) {  // standard
      return parsed.actions;
    }
    // non-standard shapes: wrap single action-ish object
    if (parsed?.intent && parsed?.method && parsed?.endpoint) return [parsed];
    if (parsed?.payload && (parsed?.intent || parsed?.method || parsed?.endpoint)) return [parsed];
  } catch (e) {
    console.error('Failed to JSON.parse tool arguments:', e, argsStr?.slice(0, 200));
  }
  return [];
}

/* =========================
   Route handler
   ========================= */
export async function POST(request) {
  try {
    const session = await getSession();
    if (!session?.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = parseInt(session.sub, 10);

    const requestBody = await request.json();
    logHumanReadable('COMPLETE API REQUEST JSON', requestBody);
    
    const { messages, okrtContext: clientOkrtContext } = requestBody;
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages array required' }, { status: 400 });
    }

    // Use client-provided OKRT context if available, otherwise fetch from DB
    const okrtContext = clientOkrtContext || await getOKRTContext(userId);
    
    // Add user display name if not present in client context
    if (clientOkrtContext && !clientOkrtContext.user) {
      await getDatabase(); // Ensure database is initialized
      const user = await get(`SELECT display_name FROM users WHERE id = ?`, [userId]);
      okrtContext.user = { displayName: user?.display_name || 'User' };
    }
    
    const systemPrompt = getCoachSystemPrompt(okrtContext);

    const llmMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.slice(-10).map(m => ({ role: m.role, content: m.content }))
    ];

    const provider = process.env.LLM_PROVIDER || 'ollama';

    /* ===== OLLAMA (chat API + streaming) ===== */
    if (provider === 'ollama') {
      const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
      const model = process.env.LLM_MODEL_NAME || process.env.LLM_CHAT_MODEL || 'llama3:latest';

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

    /* ===== OPENAI (Responses API + tools) ===== */
    if (provider === 'openai') {
      const apiKey = process.env.OPENAI_API_KEY || process.env.OPEN_AI_API_KEY;
      const model = process.env.LLM_MODEL_NAME || 'gpt-4o-mini';
      if (!apiKey) throw new Error('OpenAI API key not configured');

      // Convert ChatCompletion-style messages -> Responses input
      const input = llmMessages.map(m => {
        const role = m.role === 'assistant' ? 'assistant' : (m.role === 'system' ? 'system' : 'user');
        const partType = role === 'assistant' ? 'output_text' : 'input_text';
        return { role, content: [{ type: partType, text: String(m.content ?? '') }] };
      });

      const openaiPayload = { model, input, tools: [getActionsTool()], tool_choice: "auto", stream: true };
      logHumanReadable('OPENAI API PAYLOAD', openaiPayload);

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

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();

          // Proper SSE framing: collect multi-line data blocks until a blank line ends the event
          let pendingEvent = null;
          let dataLines = [];
          let carry = '';
          let sentPreparing = false;

          const toolBuffers = new Map(); // id -> string[]
          const toolNames = new Map();   // id -> name
          let actionsPayloads = [];      // aggregated
          
          // Logging variables
          let fullTextResponse = '';
          let hasLoggedTextResponse = false;

          const send = (obj) => controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
          const prep = () => { if (!sentPreparing) { sentPreparing = true; send({ type: 'preparing_actions' }); } };
          const dedupe = (arr) => Array.from(new Map(arr.map(a => [JSON.stringify(a), a])).values());

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

          const handleFunctionCallItem = (item) => {
            if (!item) return;
            if (item.type === 'function_call' && item.name === 'emit_actions') {
              const actions = extractActionsFromArgs(item.arguments || '{}');
              if (actions.length) {
                actionsPayloads.push(...actions);
              }
            }
          };

          const handleResponseCompletedOutput = (payloadObj) => {
            const out = payloadObj?.response?.output;
            if (Array.isArray(out)) {
              for (const item of out) handleFunctionCallItem(item);
            }
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
              case 'response.output_text.delta': {
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
                // Log complete text response when text generation is done
                if (fullTextResponse.trim() && !hasLoggedTextResponse) {
                  console.log('=== OPENAI FULL TEXT RESPONSE ===');
                  console.log(fullTextResponse);
                  console.log('=== END OPENAI TEXT RESPONSE ===');
                  hasLoggedTextResponse = true;
                }
                break;
              }

              case 'response.tool_call.created': {
                const { id, type, name } = (typeof data === 'object' && data) || {};
                if (id) {
                  toolBuffers.set(id, []);
                  if (type === 'function' && name) toolNames.set(id, name);
                }
                prep();
                break;
              }
              case 'response.tool_call.delta': {
                const { id, delta } = (typeof data === 'object' && data) || {};
                if (id && delta?.arguments != null) {
                  const arr = toolBuffers.get(id) || [];
                  arr.push(String(delta.arguments));
                  toolBuffers.set(id, arr);
                }
                break;
              }
              case 'response.tool_call.completed': {
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

    return NextResponse.json({ error: 'Invalid LLM provider' }, { status: 400 });

  } catch (error) {
    console.error('LLM chat error:', error);
    return NextResponse.json({ error: 'Failed to process chat request' }, { status: 500 });
  }
}