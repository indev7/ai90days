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
- Each action in actions[] MUST include "intent", "endpoint", "method", "payload".
- The "payload" object must itself be valid and include all required fields.
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
1) First, STREAM a single short paragraph of human-readable coaching text. Do NOT include JSON in the text.
2) Only if actions are warranted, CALL the tool "emit_actions" once with an ordered actions[] list.
3) Use only three intents: CREATE_OKRT, UPDATE_OKRT, DELETE_OKRT.
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
    function: {
      name: "emit_actions",
      description: "Emit an ordered list of OKRT actions (create, update, delete). Use real UUIDs from CONTEXT.",
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

      console.log('🔧 Making OpenAI request with:', { model, messagesCount: llmMessages.length });
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: llmMessages,
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

      const stream = new ReadableStream({
        async start(controller) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();

          // Buffers for tool call JSON (standard OpenAI format)
          const toolBuffers = new Map(); // tool_call_id -> string
          const toolNames = new Map();   // tool_call_id -> name
          const actionsPayloads = [];    // accumulated actions (if any)

          const flushAllTools = () => {
            for (const [id, buf] of toolBuffers.entries()) {
              try {
                const parsed = JSON.parse(buf || '{}');
                if (toolNames.get(id) === 'emit_actions' && parsed?.actions) {
                  actionsPayloads.push(...parsed.actions);
                }
              } catch (e) {
                console.error('Tool JSON parse error for', id, ':', e, 'Buffer was:', buf);
              }
            }
            
            // Log summary at the end
            console.log('\n=== FINAL RESULTS ===');
            console.log('Tool buffers:', Array.from(toolBuffers.entries()));
            console.log('Final actions payload:', actionsPayloads);
          };

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                // On hard end, flush tools & finish
                flushAllTools();
                controller.enqueue(encoder.encode(JSON.stringify({ type: 'actions', data: actionsPayloads }) + '\n'));
                controller.enqueue(encoder.encode(JSON.stringify({ type: 'done' }) + '\n'));
                controller.close();
                break;
              }

              const chunk = decoder.decode(value);
              const lines = chunk.split('\n').filter(l => l.trim().startsWith('data:'));
              
              for (const line of lines) {
                const data = line.slice(5).trim(); // after 'data:'
                if (data === '[DONE]') {
                  flushAllTools();
                  controller.enqueue(encoder.encode(JSON.stringify({ type: 'actions', data: actionsPayloads }) + '\n'));
                  controller.enqueue(encoder.encode(JSON.stringify({ type: 'done' }) + '\n'));
                  controller.close();
                  return;
                }
                
                let evt;
                try {
                  evt = JSON.parse(data);
                } catch (e) {
                  continue;
                }

                // Handle standard OpenAI Chat Completions streaming events
                const choice = evt?.choices?.[0];
                if (!choice) continue;

                // Text content streaming
                if (choice.delta?.content) {
                  controller.enqueue(encoder.encode(JSON.stringify({ type: 'content', data: choice.delta.content }) + '\n'));
                }

                // Tool calls
                if (choice.delta?.tool_calls) {
                  // Signal that we're starting to prepare actions (only once)
                  if (toolBuffers.size === 0) {
                    controller.enqueue(encoder.encode(JSON.stringify({ type: 'preparing_actions' }) + '\n'));
                  }
                  
                  for (const toolCall of choice.delta.tool_calls) {
                    // Use index as the key when id is missing
                    const key = toolCall.id || `tool_${toolCall.index || 0}`;
                    
                    if (toolCall.function?.name) {
                      // Tool call started: initialize buffer only
                      toolNames.set(key, toolCall.function.name);
                      if (!toolBuffers.has(key)) {
                        toolBuffers.set(key, '');
                      }
                    }
                    if (toolCall.function?.arguments) {
                      // Tool call arguments delta
                      if (toolBuffers.has(key)) {
                        toolBuffers.set(key, (toolBuffers.get(key) || '') + toolCall.function.arguments);
                      } else {
                        // Initialize buffer if it doesn't exist (for streaming arguments)
                        toolBuffers.set(key, toolCall.function.arguments);
                        // Set a default name if not set
                        if (!toolNames.has(key)) {
                          toolNames.set(key, 'emit_actions');
                        }
                      }
                    }
                  }
                }

                // Finish reason indicates completion
                if (choice.finish_reason) {
                  flushAllTools();
                  controller.enqueue(encoder.encode(JSON.stringify({ type: 'actions', data: actionsPayloads }) + '\n'));
                  controller.enqueue(encoder.encode(JSON.stringify({ type: 'done' }) + '\n'));
                  controller.close();
                  return;
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
