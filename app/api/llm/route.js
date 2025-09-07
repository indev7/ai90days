// app/api/coach/route.js
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDatabase } from '@/lib/db';

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

  const quarterMonths = [
    ['Jan–Mar', 'Apr–Jun', 'Jul–Sep', 'Oct–Dec'][quarter - 1]
  ];

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
    const db = await getDatabase();
    const currentQuarter = getCurrentQuarter();

    const user = await db.get(
      `SELECT display_name FROM users WHERE id = ?`,
      [userId]
    );
    const displayName = user?.display_name || 'User';

    const objectives = await db.all(
      `SELECT * FROM okrt
       WHERE owner_id = ? AND type = 'O'
       ORDER BY 
         CASE WHEN cycle_qtr = ? THEN 0 ELSE 1 END,
         status = 'A' DESC,
         created_at DESC
       LIMIT 3`,
      [userId, currentQuarter]
    );

    const context = {
      user: { displayName },
      objectives: []
    };

    for (const obj of objectives) {
      const objData = { ...obj, krs: [] };

      const krs = await db.all(
        `SELECT * FROM okrt
         WHERE owner_id = ? AND parent_id = ? AND type = 'K'
         ORDER BY created_at DESC
         LIMIT 3`,
        [userId, obj.id]
      );

      for (const kr of krs) {
        const krData = { ...kr, tasks: [] };

        const tasks = await db.all(
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
   SINGLE system prompt
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

  return `You are an OKRT coach inside the "90Days App". The user opens you from the Coach menu to plan and maintain OKRs in 90-day cycles. You follow the OKR methods popularized by John Doerr and ideas from Keith Cunningham.
  You also have knowlege on how OKRT CRUD operations are done usign API. You also know the attributes of the OKRT table where OKRTS are stored. With that knowlege, every time you suggest a modification to users OKRT set, you will aslo provide action buttons for them to execute. Do not wait for the user to ask for action buttons.
  You will use OpenAI's Responses API. Your response will always stream some text and optionally action JSON. You will convert vague ideas into well defined OKRTs. When printing OKRTs, always use correct indentation.

STRICT JSON CONTRACT FOR ACTIONS (AVOID MALFORMED OUTPUT)
- All tool calls MUST output fully valid JSON conforming to the tool schema.
- Always double-quote keys and string values.
- Always include colons between keys and values (e.g. "intent": "CREATE_OKRT").
- Do NOT join keys/values without punctuation.
- NEVER output malformed keys like "intentCREATE_OKRT" or "actions{".
- Do NOT emit partial fragments of a JSON key or its colon across multiple deltas.
  For example: always emit '"actions":' together, never '"actions"' then later ':'.
- Each property ("key": value) must appear atomically within a single streamed chunk.
- Emit the ENTIRE tool_call arguments JSON in one contiguous block when possible.
- The only valid top-level for tool_call arguments is: { "actions": [ ... ] }.
- MANDATORY. Each action in actions[] MUST include "intent", "endpoint", "method", "payload".
- Preserve client-supplied IDs exactly (e.g., "id": "gen-xxxx"). Use consistent IDs for children with parent_id linking correctly.
- Never invent or drop keys defined in schema, but also allow additional properties safely.
- If unsure, omit the tool call entirely rather than emit malformed JSON.

SCOPE & DATA MODEL
- Single table "okrt" stores Objective (O), Key Result (K), and Task (T) using "parent_id" for hierarchy.
- Objective (O): title, description, area (Life/Work/Health), cycle_qtr, status (D/A/C), visibility (private/team/org), objective_kind (committed/stretch), progress (0–100).
- Key Result (K): description (REQUIRED; no title), kr_target_number, kr_unit ∈ {count, %, $, hrs}, kr_baseline_number?, weight (default 1.0), progress (0–100).
- Task (T): description (REQUIRED; no title), due_date?, task_status ∈ {todo, in_progress, done, blocked}, weight (default 1.0), progress (0–100).
- When updating progress of a task, always change the task_status to "in_progress" or complete. Also prpagate the progress up to Obejective. Calculate parent progress as given below. 
- Parent progress formula: parent_progress = Σ(child_progress × child_weight). Sibling weights under the same parent should sum to 1.0.
- If you are asked to review already set OKRTs, check if the progress and task_status of child tasks match that of parent. If not suggest corrections.

BEHAVIOR
- Identify the user's intent from their message and the CONTEXT snapshot. Ask ONE precise question only if a required field is missing.
- Motivate briefly; improve vague goals; break Objectives → KRs → Tasks; use absolute dates (YYYY-MM-DD) inside the 90-day window.
- If a task becomes "done", its progress must be 100%. If a task moves to "in_progress", ask for a progress percentage and include an action in the tool payload.
- When deleting a parent (Objective or KR), propose child deletions FIRST, then the parent LAST (no cascade).
- UUID GENERATION: When creating new OKRTs that will have children, generate your own UUID in the format "gen-[8-random-chars]" (e.g., "gen-a1b2c3d4") and use it consistently across all related actions in the same response.


OUTPUT CONTRACT (VERY IMPORTANT)
1) First, STREAM a single short paragraph of human-readable coaching text. Do NOT include JSON or code blocks for actions in the text.
2) When the user’s request or your coaching implies that an Objective, Key Result, or Task should be created, updated, or deleted, you MUST call the tool "emit_actions" once. Always output a well‑formed JSON object with an "actions" array matching those changes.
   - IMPORTANT: Never embed action JSON inside text or markdown (no triple backtick blocks). Actions must ONLY be emitted via the tool call.
3) If no OKRT changes are expected, do not call the tool and only return coaching text.
4) Use only three intents: CREATE_OKRT, UPDATE_OKRT, DELETE_OKRT.
4) For CREATE_OKRT include type and other needed fields; for UPDATE_OKRT/DELETE_OKRT include id. Include only fields that are required or changing. Never include created_at/updated_at.
5) When deleting a parent, include child deletes first (tasks → KR) then parent last.
6) For CREATE operations involving hierarchies (Objective + KRs + Tasks): 
   - Set the Objective's id to a generated UUID like "gen-abc12345"
   - Use that same generated UUID as parent_id for related KRs
   - Use generated KR UUIDs as parent_id for related Tasks

${timeBlock}${contextBlock}`;
}

/* =========================
   Actions tool (your schema)
   ========================= */
 function getActionsTool() {
   return {
     type: "function",
     name: "emit_actions",
     description:
       "Emit an ordered list of OKRT actions (create, update, delete). Use real UUIDs from CONTEXT.",
     parameters: {
       type: "object",
       properties: {
         actions: {
           type: "array",
           minItems: 1,
           items: {
             type: "object",
             properties: {
               intent: { type: "string", enum: ["CREATE_OKRT", "UPDATE_OKRT", "DELETE_OKRT"] },
               endpoint: { type: "string", enum: ["/api/okrt", "/api/okrt/[id]"] },
               method: { type: "string", enum: ["POST", "PUT", "DELETE"] },
               payload: {
                 type: "object",
                 description: "OKRT fields to send. Include only what is required or changing.",
                 properties: {
                   id: { type: "string" },
                   type: { type: "string", enum: ["O","K","T"] },
                   owner_id: { type: "integer" },
                   parent_id: { type: "string" },
                   description: { type: "string" },
                   progress: { type: "number" },
                   order_index: { type: "integer" },
                   task_status: { type: "string", enum: ["todo","in_progress","done","blocked"] },
                   title: { type: "string" },
                   area: { type: "string" },
                   visibility: { type: "string", enum: ["private","team","org"] },
                   objective_kind: { type: "string", enum: ["committed","stretch"] },
                   status: { type: "string", enum: ["D","A","C"] },
                   cycle_qtr: { type: "string" },
                   kr_target_number: { type: "number" },
                   kr_unit: { type: "string", enum: ["%","$","count","hrs"] },
                   kr_baseline_number: { type: "number" },
                   weight: { type: "number" },
                   due_date: { type: "string" },
                   recurrence_json: { type: "string" },
                   blocked_by: { type: "string" },
                   repeat: { type: "string", enum: ["Y","N"] }
                 },
                 additionalProperties: true
               }
             },
             required: ["intent", "endpoint", "method", "payload"],
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
   Route handler
   ========================= */
export async function POST(request) {
  try {
    const session = await getSession();
    if (!session?.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = parseInt(session.sub, 10);

    const { messages } = await request.json();
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages array required' }, { status: 400 });
    }

    // Gather context + prompt
    const okrtContext = await getOKRTContext(userId);
    const systemPrompt = getCoachSystemPrompt(okrtContext);

    // Prepare LLM messages
    const llmMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.slice(-10).map(m => ({ role: m.role, content: m.content }))
    ];

    const provider = process.env.LLM_PROVIDER || 'ollama';

    /* ========== OLLAMA (chat API + streaming) ========== */
    if (provider === 'ollama') {
      const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
      const model = process.env.LLM_MODEL_NAME || process.env.LLM_CHAT_MODEL || 'llama3:latest';

      const response = await fetch(`${ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: llmMessages,
          stream: true
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

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

  /* ========== OPENAI (Responses API + tool call) ========== */
  if (provider === 'openai') {
    const apiKey = process.env.OPEN_AI_API_KEY;
    const model = process.env.LLM_MODEL_NAME || 'gpt-4o-mini';
    if (!apiKey) throw new Error('OpenAI API key not configured');

    // Convert old ChatCompletion-style messages -> Responses API "input"
    // Each message must be role + array of content parts (type=text)
    const input = llmMessages.map(m => {
      // Normalize roles to what Responses expects
      // (it accepts 'system', 'user', 'assistant')
      const role = m.role === 'system' ? 'system'
                : m.role === 'assistant' ? 'assistant'
                : 'user';

      // Content type depends on role:
      // - user/system -> input_text
      // - assistant   -> output_text (historical assistant messages)
      const partType = role === 'assistant' ? 'output_text' : 'input_text';

      return {
        role,
        content: [{ type: partType, text: String(m.content ?? '') }]
      };
    });


    //console.log('🔧 Making OpenAI Responses request with:', { model, inputCount: input.length });

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        input,
        tools: [getActionsTool()],
        tool_choice: "auto",
        stream: true
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('OpenAI API Error Details:', errorBody);
      throw new Error(`OpenAI API error: ${response.status} - ${errorBody}`);
    }

    const encoder = new TextEncoder();

    // --- SSE parser state for Responses API ---
    // Tool call buffers are keyed by tool_call id; accumulate streamed arguments
    const toolBuffers = new Map(); // id -> string (arguments JSON chunks)
    const toolNames   = new Map(); // id -> function name
    const actionsPayloads = [];    // final aggregated actions we’ll emit
    const collectedText    = [];    // aggregated assistant text deltas

    // Flush & parse any tool buffers we’ve accumulated
    const flushAllTools = () => {
      for (const [id, buf] of toolBuffers.entries()) {
        try {
          const fullStr = Array.isArray(buf) ? buf.join('') : buf;
          const parsed = JSON.parse(fullStr || '{}');
          if (toolNames.get(id) === 'emit_actions' && parsed?.actions) {
            actionsPayloads.push(...parsed.actions);
          }
        } catch (e) {
          console.error('Tool JSON parse error for', id, ':', e, 'Buffer was:', buf);
        }
      }
    };

    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        // Minimal SSE line parser (handles: event: <name> / data: <json or text>)
        let pendingEvent = null; // current "event:" name until a "data:" arrives

        const send = (obj) => controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              // Safety flush
              flushAllTools();
              send({ type: 'actions', data: actionsPayloads });
              send({ type: 'done' });
              controller.close();
              break;
            }

            const chunk = decoder.decode(value, { stream: true });
            // Split into lines; Responses SSE emits multiple event/data pairs
            for (const rawLine of chunk.split('\n')) {
              const line = rawLine.trim();
              if (!line) continue;
              //console.log('🔵 RAW SSE LINE:', rawLine);

              if (line.startsWith('event:')) {
                pendingEvent = line.slice(6).trim();
                continue;
              }

              if (line.startsWith('data:')) {
                const dataStr = line.slice(5).trim();

                // Some servers may send a terminal marker; handle gracefully
                if (dataStr === '[DONE]') {
                  flushAllTools();
                  const uniqueActions = Array.from(
                    new Map(actionsPayloads.map(a => [JSON.stringify(a), a])).values()
                  );
                  send({ type: 'actions', data: uniqueActions });
                  send({ type: 'done' });
                  controller.close();
                  return;
                }

                // Parse JSON payloads when present; some text-delta events are raw strings
                let data;
                try {
                  data = JSON.parse(dataStr);
                } catch {
                  data = dataStr; // textual deltas may be plain strings
                }

                switch (pendingEvent) {
                  // === Text streaming ===
                  case 'response.output_text.delta': {
                    // Always extract only the delta field
                    const textDelta = data?.delta || '';
                    if (textDelta) {
                      send({ type: 'content', data: textDelta });
                      collectedText.push(textDelta);
                    }
                    break;
                  }
                  case 'response.output_text.done': {
                    // nothing special to do
                    break;
                  }

                  // === Tool calling lifecycle ===
                  case 'response.tool_call.created': {
                    // { id, type: 'function', name?: 'emit_actions' }
                    const { id, type, name } = data || {};
                    if (id) {
                      toolBuffers.set(id, '');
                      if (type === 'function' && name) toolNames.set(id, name);
                    }
                    // Signal once that actions are being prepared
                    if (actionsPayloads.length === 0 && toolBuffers.size === 1) {
                      send({ type: 'preparing_actions' });
                    }
                    break;
                  }
                  case 'response.tool_call.delta': {
                    // { id, delta: { arguments: '...' } }
                    const { id, delta } = data || {};
                    if (id && delta?.arguments != null) {
                      const prev = toolBuffers.get(id) || [];
                      const arr = Array.isArray(prev) ? prev : [String(prev)];
                      arr.push(String(delta.arguments));
                      toolBuffers.set(id, arr);
                      //console.log('🔎 Tool delta fragment for', id, ':', delta.arguments);
                      //console.log('🔎 Current buffer for', id, ':', arr.join(''));
                    }
                    break;
                  }
                  case 'response.tool_call.completed': {
                    // { id, type: 'function', name, arguments?: '{...}' }
                    const { id, name, arguments: finalArgs } = data || {};
                    // If model sent a final full arguments blob, prefer it
                    if (id && finalArgs != null) {
                      toolBuffers.set(id, String(finalArgs));
                    }
                    if (id && name) toolNames.set(id, name);

                    // Try parsing this tool call right away
                    try {
                      const buf = toolBuffers.get(id) || [];
                      const fullStr = Array.isArray(buf) ? buf.join('') : buf;
                      const parsed = JSON.parse(fullStr || '{}');
                      if (toolNames.get(id) === 'emit_actions' && parsed?.actions) {
                        actionsPayloads.push(...parsed.actions);
                      }
                    } catch (e) {
                      console.error('Tool completed but JSON invalid:', e);
                    }
                    //console.log('✅ Raw tool_call JSON for', id, ':', toolBuffers.get(id));
                    break;
                  }

                  // === Overall response lifecycle ===
                  case 'response.completed': {
                    // The model is done; flush any pending tool calls and finish
                    flushAllTools();
                    // Also check if completed response contains inline function_call output
                    if (data?.response?.output) {
                      for (const out of data.response.output) {
                        if (out.type === 'function_call' && out.name === 'emit_actions') {
                          try {
                            const parsed = JSON.parse(out.arguments || '{}');
                            if (parsed?.actions) {
                              actionsPayloads.push(...parsed.actions);
                            }
                          } catch (e) {
                            console.error('Error parsing final function_call arguments:', e, out.arguments);
                          }
                        }
                      }
                    }
                    // if we found any function_call actions only at completion, notify UI that actions are being prepared
                    if (actionsPayloads.length > 0) {
                      send({ type: 'preparing_actions' });
                      // send only once at completion, avoid double-send
                      send({ type: 'actions', data: actionsPayloads });
                    }
                    // Do NOT resend collectedText here (already streamed via deltas)
                    send({ type: 'done' });
                    controller.close();
                    return;
       
                    send({ type: 'done' });
                    controller.close();
                    return;
                  }
                  case 'response.output_item.done': {
                    const item = data?.item;
                    if (item?.type === 'message' || item?.type === 'output_text') {
                      const contents = item.content || [];
                      for (const c of contents) {
                        if (c.type === 'output_text' && c.text) {
                          send({ type: 'content', data: c.text });
                          collectedText.push(c.text);
                        }
                      }
                    }
                    break;
                  }
                  case 'response.function_call_arguments.delta': {
                    const { item_id, delta } = data || {};
                    if (item_id && delta != null) {
                      const prev = toolBuffers.get(item_id) || '';
                      toolBuffers.set(item_id, prev + String(delta));
                      if (!actionsPayloads.length) {
                        send({ type: 'preparing_actions' });
                      }
                    }
                    break;
                  }
                  case 'response.function_call_arguments.done': {
                    const { item_id, arguments: finalArgs } = data || {};
                    if (item_id && finalArgs != null) {
                      try {
                        const parsed = JSON.parse(finalArgs);
                        if (parsed?.actions) {
                          actionsPayloads.push(...parsed.actions);
                        }
                      } catch (e) {
                        console.error('Error parsing function_call_arguments.done:', e, finalArgs);
                      }
                    }
                    break;
                  }
                  case 'response.error': {
                    console.error('Responses API stream error event:', data);
                    flushAllTools();
                    send({ type: 'actions', data: actionsPayloads });
                    controller.error(new Error(typeof data === 'string' ? data : (data?.error || 'Responses API stream error')));
                    return;
                  }
                  default: {
                    // Ignore other event types (e.g., refusal deltas, reasoning, metadata)
                    break;
                  }
                }

                // After handling this data line, clear the pending event name
                pendingEvent = null;
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
