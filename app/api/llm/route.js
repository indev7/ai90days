// app/api/llm/route.js
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDatabase, get, all } from '@/lib/pgdb';

// Increase route timeout for LLM responses (Next.js 15 route segment config)
export const maxDuration = 300; // 5 minutes (Vercel limit)
export const dynamic = 'force-dynamic'; // Disable caching for LLM responses

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
Full OKRT Data (JSON below is reliable and authoritative). Use titles/descriptions in user-facing text. Use IDs only in emit_actions tool calls:
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
  IMPORTANT: Politely refuse if the users intent is beyond the scope of the 90days coach (asking unrelated questions, wanting to know table structure, API etc..)
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
- Use IDs only inside emit_actions; never surface them in user-facing text.
- IDs/UUIDs (id, parent_id, owner_id, gen-* tokens) must not appear in the coaching paragraph. If a sentence would contain an ID, rewrite it without the ID. Before sending text, scan and remove any token matching a UUID (\\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\\b) or gen-[a-z0-9]{8}. Do not remove numeric values like weights or progress percentages.
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
   Ollama-specific prompt matching OpenAI structure
   Uses same prompt content but adapted for inline JSON output (no tool calling API)
   ========================= */
function getCoachSystemPromptForOllama(okrtContext) {
  const timeCtx = getTimeContext();
  const displayName = okrtContext?.user?.displayName || 'User';
  const objectives = okrtContext?.objectives || [];
  const krCount = objectives.reduce((sum, o) => sum + (Array.isArray(o.krs) ? o.krs.length : 0), 0);
  const taskCount = objectives.reduce((sum, o) => 
    sum + (o.krs || []).reduce((kSum, kr) => kSum + (kr.tasks || []).length, 0), 0);

  // Send compact list of OKRTs with IDs for UPDATE/DELETE operations
  const contextBlock = objectives.length > 0
    ? `
EXISTING USER OKRTS:
User: ${displayName}
${objectives.map(o => {
  const krs = o.krs || [];
  return `- [${o.id}] Objective: "${o.title}"
${krs.map(kr => `  - [${kr.id}] KR: "${kr.description}"`).join('\n')}`;
}).join('\n')}

IMPORTANT: For UPDATE or DELETE, use the EXACT IDs shown in brackets [id] above!`
    : `
EXISTING USER OKRTS:
User: ${displayName} has no OKRTs yet.`;

  const timeBlock = `
TIME: Quarter ${timeCtx.currentQuarter} (${timeCtx.quarterStart} to ${timeCtx.quarterEnd})`;

  // DETAILED prompt for qwen2.5:7b - keeps full instructions but minimal context
  return `You are an OKRT coach. Address user as "${displayName}".

${timeBlock}
${contextBlock}

CRITICAL: When user wants to create/update/delete OKRTs, you MUST output EXACTLY this format:

[1-2 sentence coaching message]

ACTIONS_JSON:
{"actions":[{"intent":"CREATE_OKRT","endpoint":"/api/okrt","method":"POST","payload":{...fields...}}]}

DATA MODEL:
O (Objective) → K (Key Result) → T (Task) linked by parent_id

⚠️ CRITICAL ID RULES:
- CREATE: Generate NEW random IDs like gen-k3x7m9p2
- UPDATE/DELETE: Use EXACT IDs from "EXISTING USER OKRTS" list above (shown in [brackets])

⚠️ ENDPOINT RULES:
- CREATE uses: "/api/okrt" 
- UPDATE uses: "/api/okrt/ACTUAL-ID" (ID must be in URL!)
- DELETE uses: "/api/okrt/ACTUAL-ID" (ID must be in URL!)

ACTION TYPES:

1. CREATE_OKRT - Create new OKRT
{
  "intent": "CREATE_OKRT",
  "endpoint": "/api/okrt",
  "method": "POST",
  "payload": {
    "id": "gen-XXXXXXXX",
    "type": "O" or "K" or "T",
    ...fields...
  }
}

2. UPDATE_OKRT - Update existing OKRT
{
  "intent": "UPDATE_OKRT",
  "endpoint": "/api/okrt/ACTUAL-ID-HERE",
  "method": "PUT",
  "payload": {
    "id": "ACTUAL-ID-HERE",
    ...ONLY the fields you want to change...
  }
}
⚠️ CRITICAL FOR UPDATE:
- Endpoint MUST be "/api/okrt/" + the actual OKRT id (e.g., "/api/okrt/gen-u3v4w5x6")
- Payload MUST include "id" field with same id
- Payload should ONLY include fields being changed (not all fields!)
- Example: To change kr_target_number to 300:
  endpoint: "/api/okrt/gen-u3v4w5x6"
  payload: {"id": "gen-u3v4w5x6", "kr_target_number": 300}

3. DELETE_OKRT - Delete existing OKRT
{
  "intent": "DELETE_OKRT",
  "endpoint": "/api/okrt/{id}",
  "method": "DELETE",
  "payload": {
    "id": "{id}"
  }
}
CRITICAL: For DELETE, endpoint MUST include the ID: "/api/okrt/gen-abc12345"
Also include "id" in payload (same ID as in endpoint)

REQUIRED PAYLOAD FIELDS:

Objective (type:"O"):
- id, type, title, description, area, status, visibility, objective_kind, cycle_qtr, progress

Key Result (type:"K"):
- id, type, parent_id, description, kr_target_number, kr_unit, kr_baseline_number, weight, progress

Task (type:"T"):
- id, type, parent_id, description, task_status, weight, progress

FIELD VALUES:
- area: "Life", "Work", or "Health"
- status: "D"
- visibility: "private"
- objective_kind: "committed"
- cycle_qtr: "${timeCtx.currentQuarter}"
- kr_unit: "count", "%", "$", or "hrs"
- task_status: "todo", "in_progress", or "done"
- kr_target_number: NUMBER (not string!)
- kr_baseline_number: NUMBER (not string!)
- progress: NUMBER 0
- weight: NUMBER 1.0 or 0.5

IDs: CRITICAL - Generate UNIQUE random IDs as "gen-" + 8 random chars
Examples: gen-x7m9k2p4, gen-w3n8q5r1, gen-t6y2h9v3
NEVER reuse IDs from examples! Generate NEW random ones EVERY time!

EXAMPLES (STRUCTURE ONLY - GENERATE NEW IDS):

Example 1 - CREATE:
User: "Create fitness objective with 2 key results"

Your response:
Let's track your fitness!

ACTIONS_JSON:
{"actions":[{"intent":"CREATE_OKRT","endpoint":"/api/okrt","method":"POST","payload":{"id":"gen-x7m9k2p4","type":"O","title":"Improve Fitness","description":"Get healthier","area":"Life","status":"D","visibility":"private","objective_kind":"committed","cycle_qtr":"${timeCtx.currentQuarter}","progress":0}},{"intent":"CREATE_OKRT","endpoint":"/api/okrt","method":"POST","payload":{"id":"gen-w3n8q5r1","type":"K","parent_id":"gen-x7m9k2p4","description":"Run 5km 3 times/week","kr_target_number":3,"kr_unit":"count","kr_baseline_number":0,"weight":0.5,"progress":0}},{"intent":"CREATE_OKRT","endpoint":"/api/okrt","method":"POST","payload":{"id":"gen-t6y2h9v3","type":"K","parent_id":"gen-x7m9k2p4","description":"Lose 5kg","kr_target_number":5,"kr_unit":"count","kr_baseline_number":0,"weight":0.5,"progress":0}}]}

Example 2 - UPDATE:
User: "Change the subscriber key result to 500"
(Assuming [gen-u3v4w5x6] is the ID from EXISTING USER OKRTS list)

Your response:
I'll update that target for you!

ACTIONS_JSON:
{"actions":[{"intent":"UPDATE_OKRT","endpoint":"/api/okrt/gen-u3v4w5x6","method":"PUT","payload":{"id":"gen-u3v4w5x6","kr_target_number":500}}]}

NOTE: ID gen-u3v4w5x6 comes from the EXISTING USER OKRTS list, NOT from examples!

Example 3 - DELETE:
User: "Delete the fitness objective"
(Assuming [acdc55dd-dc11-486f-bbaf-73da24612a90] is the ID from EXISTING USER OKRTS list)

Your response:
I'll remove that objective and its children.

ACTIONS_JSON:
{"actions":[{"intent":"DELETE_OKRT","endpoint":"/api/okrt/acdc55dd-dc11-486f-bbaf-73da24612a90","method":"DELETE","payload":{"id":"acdc55dd-dc11-486f-bbaf-73da24612a90"}}]}

NOTE: ID comes from the EXISTING USER OKRTS list, NOT from examples!

IMPORTANT: IDs in examples are gen-x7m9k2p4, gen-w3n8q5r1, gen-t6y2h9v3, gen-abc12345
YOUR IDs must be DIFFERENT! Generate random combinations like: gen-j4k8m1n7, gen-p9r2s5t8, etc.

CRITICAL RULES:
1. NO markdown fences (no \`\`\`json)
2. NO extra text after JSON
3. ACTIONS_JSON: must be on its own line
4. JSON must be ONE LINE (no newlines in JSON)
5. All numbers WITHOUT quotes
6. Each action needs intent + endpoint + method + payload
7. Payload must have ALL required fields for that type

WRONG (DO NOT DO THIS):
\`\`\`json
{"actions":[{"action":"some text"...}]}
\`\`\`

RIGHT (DO THIS):
ACTIONS_JSON:
{"actions":[{"intent":"CREATE_OKRT","endpoint":"/api/okrt","method":"POST","payload":{...}}]}`;

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
    
    // Determine provider early
    const provider = process.env.LLM_PROVIDER || 'ollama';

    // Build system prompt (provider-specific for Ollama)
    let systemPrompt = provider === 'ollama'
      ? getCoachSystemPromptForOllama(okrtContext)
      : getCoachSystemPrompt(okrtContext);

    // (OpenAI path retains original prompt intact; modifications only for Ollama)

    const llmMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.slice(-10).map(m => ({ role: m.role, content: m.content }))
    ];

    /* ===== OLLAMA (chat API + streaming) ===== */
  if (provider === 'ollama') {
      const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
      const model = process.env.LLM_MODEL_NAME || process.env.LLM_CHAT_MODEL || 'llama3:latest';

      const ollamaPayload = { model, messages: llmMessages, stream: true };
      
      // Add format reminder to user message for better compliance
      const lastUserMsg = llmMessages[llmMessages.length - 1];
      if (lastUserMsg?.role === 'user') {
        const needsActions = /create|add|update|change|delete|remove|set/i.test(lastUserMsg.content);
        if (needsActions) {
          lastUserMsg.content += '\n\n[Remember: If creating OKRTs, output: coaching text, blank line, ACTIONS_JSON:, then {"actions":[...]} with all required fields]';
        }
      }

      console.log('\n' + '━'.repeat(80));
      console.log('📤 SENDING TO OLLAMA (llama3)');
      console.log('━'.repeat(80));
      console.log('Model:', model);
      console.log('System Prompt Length:', llmMessages[0]?.content?.length || 0, 'chars');
      console.log('System Prompt Preview (first 500 chars):');
      console.log(llmMessages[0]?.content?.substring(0, 500) + '...');
      console.log('User Message:', llmMessages[llmMessages.length - 1]?.content);
      console.log('━'.repeat(80) + '\n');

      // Configure Ollama with performance optimizations
      const ollamaRequestBody = {
        ...ollamaPayload,
        keep_alive: '15m',  // Keep model loaded for 15 minutes
        options: {
          temperature: 0.1,        // More deterministic (less creative)
          top_p: 0.9,              // Nucleus sampling
          num_predict: 3000,       // Increased to allow full JSON completion
          // No stop sequences - let it complete the JSON fully
          num_ctx: 8192,           // Larger context window for qwen2.5
          num_thread: 8,           // Use more CPU threads
          repeat_penalty: 1.1,     // Avoid repetition
        }
      };

      console.log('⏱️  Requesting from Ollama (this may take 30-90 seconds)...\n');

      // WORKAROUND: Node.js fetch has 300s timeout hardcoded in undici
      // We need to wrap the fetch with a timeout handler that allows longer waits
      let response;
      try {
        // Create a promise that resolves with the fetch
        const fetchPromise = fetch(`${ollamaUrl}/api/chat`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(ollamaRequestBody),
        });
        
        // Wait for response - if Ollama doesn't respond, fetch will handle its own timeout
        // The key is we're not adding an external timeout that would cancel it
        response = await fetchPromise;
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
        }
      } catch (error) {
        // Check if it's the dreaded headers timeout
        if (error.cause?.code === 'UND_ERR_HEADERS_TIMEOUT') {
          throw new Error(`Ollama is taking too long to respond (>5 min). This usually means:
1. Model is too large for your hardware (try: ollama pull llama3.2:latest)
2. Ollama service is overloaded or crashed (restart: sudo systemctl restart ollama)
3. First request is loading model into memory (wait 2-3 minutes and try again)

Current model: ${model}
Recommended: Switch to llama3.2:latest (3B, much faster) or qwen2.5:7b`);
        }
        throw error;
      }

      const encoder = new TextEncoder();
      // Helper to convert incorrect nested format to actions array
      function convertNestedToActions(obj) {
        const actions = [];
        const currentQuarter = getCurrentQuarter();
        
        // Handle objective
        if (obj.objective) {
          const o = obj.objective;
          actions.push({
            intent: 'CREATE_OKRT',
            endpoint: '/api/okrt',
            method: 'POST',
            payload: {
              id: o.id || `gen-${Math.random().toString(36).slice(2, 10)}`,
              type: 'O',
              title: o.title || o.description || 'Untitled Objective',  // title is REQUIRED
              description: o.description || o.title || '',
              area: o.area || 'Work',
              status: o.status === 'Draft' ? 'D' : (o.status === 'Active' ? 'A' : (o.status === 'Complete' ? 'C' : 'D')),
              visibility: (o.visibility || 'private').toLowerCase(),
              objective_kind: (o.objective_kind || 'committed').toLowerCase(),
              cycle_qtr: o.cycle_qtr || currentQuarter,
              progress: typeof o.progress === 'number' ? o.progress : 0
            }
          });
        }
        
        // Handle key result
        if (obj.kr) {
          const kr = obj.kr;
          const parentId = obj.objective?.id || kr.parent_id;
          
          // Ensure required fields for KR
          const krTargetNumber = kr.kr_target_number !== undefined ? parseFloat(kr.kr_target_number) : 100;
          const krUnit = kr.kr_unit || 'count';
          
          actions.push({
            intent: 'CREATE_OKRT',
            endpoint: '/api/okrt',
            method: 'POST',
            payload: {
              id: kr.id || `gen-${Math.random().toString(36).slice(2, 10)}`,
              type: 'K',
              parent_id: parentId,
              description: kr.description || kr.title || 'Untitled Key Result',  // description is REQUIRED
              kr_target_number: krTargetNumber,  // REQUIRED
              kr_unit: krUnit,  // REQUIRED
              kr_baseline_number: kr.kr_baseline_number !== undefined ? parseFloat(kr.kr_baseline_number) : 0,
              weight: kr.weight !== undefined ? parseFloat(kr.weight) : 1.0,
              progress: typeof kr.progress === 'number' ? kr.progress : 0
            }
          });
        }
        
        // Handle task
        if (obj.task) {
          const t = obj.task;
          const parentId = obj.kr?.id || t.parent_id;
          
          // Normalize task_status
          let taskStatus = (t.task_status || t.status || 'todo').toLowerCase().replace(/\s+/g, '_');
          if (!['todo', 'in_progress', 'done', 'blocked'].includes(taskStatus)) {
            taskStatus = 'todo';
          }
          
          actions.push({
            intent: 'CREATE_OKRT',
            endpoint: '/api/okrt',
            method: 'POST',
            payload: {
              id: t.id || `gen-${Math.random().toString(36).slice(2, 10)}`,
              type: 'T',
              parent_id: parentId,
              description: t.description || t.title || 'Untitled Task',  // description is REQUIRED
              task_status: taskStatus,  // REQUIRED
              progress: typeof t.progress === 'number' ? t.progress : 0,
              weight: t.weight !== undefined ? parseFloat(t.weight) : 1.0,
              due_date: t.due_date || null
            }
          });
        }
        
        return actions.length > 0 ? actions : null;
      }

      // Helper to extract actions JSON from accumulated text output
      function tryExtractActions(raw) {
        if (!raw) return null;
        
        console.log('\n🔍 EXTRACTION DEBUG:');
        console.log('Raw text length:', raw.length);
        console.log('Contains ACTIONS_JSON:', raw.includes('ACTIONS_JSON:'));
        console.log('Contains ```json:', raw.includes('```json'));
        console.log('Contains "actions":', raw.includes('"actions"'));
        
        // Priority 1: ACTIONS_JSON marker with correct format
        const markerIndex = raw.indexOf('ACTIONS_JSON:');
        if (markerIndex !== -1) {
          console.log('✓ Found ACTIONS_JSON marker at position', markerIndex);
          let after = raw.slice(markerIndex + 'ACTIONS_JSON:'.length).trim();
          
          // Remove markdown code fences (qwen2.5 loves to add these)
          after = after.replace(/^```json\s*/i, '').replace(/^```\s*/i, '');
          after = after.replace(/```\s*$/i, '');
          console.log('After cleaning fences, first 200 chars:', after.substring(0, 200));
          
          // Find first '{' 
          const braceStart = after.indexOf('{');
          if (braceStart !== -1) {
            console.log('✓ Found opening brace at position', braceStart);
            let depth = 0;
            let jsonEnd = -1;
            for (let i = braceStart; i < after.length; i++) {
              const ch = after[i];
              if (ch === '{') depth++;
              else if (ch === '}') {
                depth--;
                if (depth === 0) {
                  jsonEnd = i;
                  break;
                }
              }
            }
            
            if (jsonEnd !== -1) {
              const candidate = after.slice(braceStart, jsonEnd + 1).trim();
              console.log('Extracted JSON candidate length:', candidate.length);
              console.log('JSON preview:', candidate.substring(0, 150) + '...');
              
              try {
                const parsed = JSON.parse(candidate);
                console.log('✓ JSON parsed successfully');
                console.log('Parsed keys:', Object.keys(parsed));
                
                // Check if it has correct actions array format
                if (parsed && Array.isArray(parsed.actions)) {
                  console.log('✅ Found correct actions array with', parsed.actions.length, 'items');
                  
                  // Validate each action has required structure
                  const validActions = parsed.actions.filter(a => {
                    const hasStructure = a.intent && a.endpoint && a.method && a.payload;
                    if (!hasStructure) {
                      console.warn('⚠️  Action missing required fields:', Object.keys(a));
                    }
                    return hasStructure;
                  });
                  
                  if (validActions.length > 0) {
                    console.log('✅ Returning', validActions.length, 'valid action(s)');
                    return validActions;
                  } else {
                    console.log('❌ No valid actions found (missing intent/endpoint/method/payload)');
                  }
                }
                
                // Check if it's the incorrect nested format
                if (parsed && (parsed.objective || parsed.kr || parsed.task)) {
                  console.log('⚠️  Found incorrect nested format, converting...');
                  const converted = convertNestedToActions(parsed);
                  if (converted) return converted;
                }
                
                console.log('❌ Parsed JSON has unexpected structure:', Object.keys(parsed));
              } catch (e) {
                console.error('❌ JSON parse error:', e.message);
                console.error('Failed candidate first 300 chars:', candidate.substring(0, 300));
              }
            } else {
              console.log('❌ Could not find closing brace for JSON');
            }
          } else {
            console.log('❌ Could not find opening brace after ACTIONS_JSON:');
          }
        } else {
          console.log('❌ ACTIONS_JSON: marker not found');
        }
        
        // Fallback 1: Search for correct actions array format
        if (raw.indexOf('"actions"') !== -1) {
          const idx = raw.lastIndexOf('"actions"');
          let start = idx;
          while (start > 0 && raw[start] !== '{') start--;
          if (raw[start] === '{') {
            let depth = 0;
            for (let i = start; i < raw.length; i++) {
              const ch = raw[i];
              if (ch === '{') depth++;
              else if (ch === '}') depth--;
              if (depth === 0) {
                const candidate = raw.slice(start, i + 1).trim();
                try {
                  const parsed = JSON.parse(candidate);
                  if (parsed && Array.isArray(parsed.actions)) {
                    console.log('✅ Found actions array via fallback search');
                    return parsed.actions;
                  }
                } catch (_) {}
                break;
              }
            }
          }
        }
        
        // Fallback 2: Search for nested format anywhere in text
        const objMatch = raw.match(/\{[\s\S]*?"objective"[\s\S]*?\}/);
        if (objMatch) {
          try {
            // Find the complete balanced object
            const startIdx = raw.indexOf(objMatch[0]);
            let depth = 0;
            let endIdx = startIdx;
            for (let i = startIdx; i < raw.length; i++) {
              const ch = raw[i];
              if (ch === '{') depth++;
              else if (ch === '}') {
                depth--;
                if (depth === 0) {
                  endIdx = i + 1;
                  break;
                }
              }
            }
            const candidate = raw.slice(startIdx, endIdx);
            const parsed = JSON.parse(candidate);
            if (parsed && (parsed.objective || parsed.kr || parsed.task)) {
              console.log('⚠️  Found nested format via fallback, converting...');
              const converted = convertNestedToActions(parsed);
              if (converted) return converted;
            }
          } catch (e) {
            console.error('Failed to parse nested format:', e);
          }
        }
        
        return null;
      }

      const stream = new ReadableStream({
        async start(controller) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let accumText = '';
          let actionsSent = false;
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                // Log complete accumulated text for debugging
                console.log('\n' + '='.repeat(80));
                console.log('OLLAMA COMPLETE RESPONSE TEXT:');
                console.log('='.repeat(80));
                console.log(accumText);
                console.log('='.repeat(80));
                console.log('Checking for ACTIONS_JSON marker...');
                console.log('Contains "ACTIONS_JSON:":', accumText.includes('ACTIONS_JSON:'));
                console.log('Contains "actions":', accumText.includes('"actions"'));
                console.log('='.repeat(80) + '\n');
                
                // Final attempt at extracting actions
                if (!actionsSent) {
                  let actions = tryExtractActions(accumText);
                  if (actions && actions.length) {
                    // FIX: Regenerate IDs if model used example IDs
                    const exampleIds = [
                      'gen-a1b2c3d4', 'gen-e5f6g7h8', 'gen-i9j0k1l2', 
                      'gen-x7m9k2p4', 'gen-w3n8q5r1', 'gen-t6y2h9v3',
                      'gen-abc12345', 'gen-u3v4w5x6', 'gen-j4k8m1n7', 'gen-p9r2s5t8'
                    ];
                    const usedIds = new Set();
                    
                    actions = actions.map(action => {
                      // ONLY regenerate IDs for CREATE actions, not UPDATE/DELETE
                      if (action.intent === 'CREATE_OKRT' && action.payload && action.payload.id) {
                        const originalId = action.payload.id;
                        // Check if ID is from examples or duplicate
                        if (exampleIds.includes(originalId) || usedIds.has(originalId)) {
                          const newId = `gen-${Math.random().toString(36).substring(2, 10)}`;
                          console.log(`⚠️  Replaced duplicate/example ID ${originalId} → ${newId}`);
                          action.payload.id = newId;
                          
                          // Update parent_id references in other actions
                          actions.forEach(a => {
                            if (a.payload && a.payload.parent_id === originalId) {
                              a.payload.parent_id = newId;
                            }
                          });
                        }
                        usedIds.add(action.payload.id);
                      }
                      
                      // FIX: Correct endpoint for UPDATE and DELETE if LLM forgot to add ID
                      if ((action.intent === 'UPDATE_OKRT' || action.intent === 'DELETE_OKRT') && 
                          action.payload?.id && 
                          action.endpoint === '/api/okrt') {
                        action.endpoint = `/api/okrt/${action.payload.id}`;
                        console.log(`🔧 Corrected endpoint for ${action.intent}: ${action.endpoint}`);
                      }
                      
                      return action;
                    });
                    
                    console.log('✅ SUCCESS: Extracted', actions.length, 'action(s)');
                    console.log(JSON.stringify(actions, null, 2));
                    controller.enqueue(encoder.encode(JSON.stringify({ type: 'actions', data: actions }) + '\n'));
                  } else {
                    console.log('❌ FAILED: No actions could be extracted');
                    console.log('This usually means:');
                    console.log('1. Model did not output ACTIONS_JSON: marker');
                    console.log('2. JSON was malformed');
                    console.log('3. Model used wrong format');
                  }
                }
                controller.enqueue(encoder.encode(JSON.stringify({ type: 'done' }) + '\n'));
                controller.close();
                break;
              }
              const chunk = decoder.decode(value);
              const lines = chunk.split('\n').filter(l => l.trim());
              for (const line of lines) {
                try {
                  const data = JSON.parse(line);
                  if (data.message?.content) {
                    const content = data.message.content;
                    accumText += content;
                    controller.enqueue(encoder.encode(JSON.stringify({ type: 'content', data: content }) + '\n'));
                    if (!actionsSent) {
                      let actions = tryExtractActions(accumText);
                      if (actions && actions.length) {
                        // FIX: Regenerate IDs if model used example IDs
                        const exampleIds = [
                          'gen-a1b2c3d4', 'gen-e5f6g7h8', 'gen-i9j0k1l2', 
                          'gen-x7m9k2p4', 'gen-w3n8q5r1', 'gen-t6y2h9v3',
                          'gen-abc12345', 'gen-u3v4w5x6', 'gen-j4k8m1n7', 'gen-p9r2s5t8'
                        ];
                        const usedIds = new Set();
                        
                        actions = actions.map(action => {
                          // ONLY regenerate IDs for CREATE actions, not UPDATE/DELETE
                          if (action.intent === 'CREATE_OKRT' && action.payload && action.payload.id) {
                            const originalId = action.payload.id;
                            if (exampleIds.includes(originalId) || usedIds.has(originalId)) {
                              const newId = `gen-${Math.random().toString(36).substring(2, 10)}`;
                              console.log(`⚠️  Replaced duplicate/example ID ${originalId} → ${newId}`);
                              action.payload.id = newId;
                              
                              // Update parent_id references
                              actions.forEach(a => {
                                if (a.payload && a.payload.parent_id === originalId) {
                                  a.payload.parent_id = newId;
                                }
                              });
                            }
                            usedIds.add(action.payload.id);
                          }
                          
                          // FIX: Correct endpoint for UPDATE and DELETE if LLM forgot to add ID
                          if ((action.intent === 'UPDATE_OKRT' || action.intent === 'DELETE_OKRT') && 
                              action.payload?.id && 
                              action.endpoint === '/api/okrt') {
                            action.endpoint = `/api/okrt/${action.payload.id}`;
                            console.log(`🔧 Corrected endpoint for ${action.intent}: ${action.endpoint}`);
                          }
                          
                          return action;
                        });
                        
                        console.log('=== OLLAMA EXTRACTED ACTIONS (STREAMING) ===');
                        console.log(JSON.stringify(actions, null, 2));
                        console.log('=== END OLLAMA ACTIONS ===');
                        actionsSent = true;
                        controller.enqueue(encoder.encode(JSON.stringify({ type: 'actions', data: actions }) + '\n'));
                      }
                    }
                  }
                  if (data.done) {
                    // Attempt again if not sent
                    if (!actionsSent) {
                      const actions = tryExtractActions(accumText);
                      if (actions && actions.length) {
                        console.log('=== OLLAMA EXTRACTED ACTIONS (FINAL) ===');
                        console.log(JSON.stringify(actions, null, 2));
                        console.log('=== END OLLAMA ACTIONS ===');
                        actionsSent = true;
                        controller.enqueue(encoder.encode(JSON.stringify({ type: 'actions', data: actions }) + '\n'));
                      }
                    }
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
