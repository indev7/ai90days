// app/api/llm/route.js
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { handleOpenAI } from './openAIHelper';
import { handleOllama } from './ollamaHelper';
import { handleAnthropic } from './anthropicHelper';
import { handleBedrock } from './bedrockHelper';
import fs from 'fs';
import path from 'path';

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
  const localDate = `${year}-${String(month).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const localTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  return {
    nowISO: now.toISOString(),
    nowLocal: `${localDate} ${localTime}`,
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

/*async function getOKRTContext(userId) {
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
}*/

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
- Now (Local): ${timeCtx.nowLocal}
- Timezone: ${timeCtx.timezone} (UTC${timeCtx.utcOffset})
- Current quarter: ${timeCtx.currentQuarter}
- Quarter window: ${timeCtx.quarterStart} → ${timeCtx.quarterEnd}
- Day in cycle: ${timeCtx.dayOfQuarter}/${timeCtx.totalQuarterDays}
- Quarter months: ${timeCtx.quarterMonths}`;

  return `You are Aime, an OKRT coach inside the "Aime App". When the user has only an outline of an idea, you will help to well define OKRTs. You will also offer motivation, planing, updating the OKRTs, timing of tasks, when a child task makes progress, offer inspiration and motivational stories, links and videos. 
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
- Objective (O): title, description, area (Life/Work/Health), cycle_qtr, status (A-Active/C-Complete/R-Archived), visibility (private/shared), objective_kind (committed/stretch), progress (0–100).
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
   Tool (Responses API shape)
   ========================= */
function getActionsTool() {
  const filePath = path.join(process.cwd(), 'ToolSchemas/okrt_actions.json');
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    console.error('Failed to load tool schema file:', filePath, error);
    return null;
  }
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
    // LLM step 3 (server): validate session and incoming payload from the client.
    const session = await getSession();
    if (!session?.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = parseInt(session.sub, 10);

    const requestBody = await request.json();
    
    const { messages, okrtContext: clientOkrtContext } = requestBody;
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages array required' }, { status: 400 });
    }

    if (!clientOkrtContext) {
      return NextResponse.json({ error: 'okrtContext is required' }, { status: 400 });
    }

    const okrtContext = clientOkrtContext;

    if (!clientOkrtContext.user) {
      okrtContext.user = { displayName: 'User' };
    }
    
    const systemPrompt = getCoachSystemPrompt(okrtContext);

    const llmMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.slice(-10).map(m => ({ role: m.role, content: m.content }))
    ];

    // LLM step 4 (server): select provider and stream the model response back to the client.
    const provider = process.env.LLM_PROVIDER || 'ollama';

    /* ===== OLLAMA (chat API + streaming) ===== */
    if (provider === 'ollama') {
      return handleOllama({ llmMessages, logHumanReadable });
    }

    /* ===== OPENAI (Responses API + tools) ===== */
    if (provider === 'openai') {
      return handleOpenAI({
        llmMessages,
        logHumanReadable,
        getActionsTool,
        extractActionsFromArgs
      });
    }

    /* ===== ANTHROPIC (Messages API + streaming) ===== */
    if (provider === 'anthropic') {
      return handleAnthropic({
        llmMessages,
        logHumanReadable,
        getActionsTool,
        extractActionsFromArgs
      });
    }

    /* ===== BEDROCK (Anthropic Messages API wrapper) ===== */
    if (provider === 'bedrock') {
      return handleBedrock({
        llmMessages,
        logHumanReadable,
        getActionsTool,
        extractActionsFromArgs
      });
    }

    return NextResponse.json({ error: 'Invalid LLM provider' }, { status: 400 });

  } catch (error) {
    console.error('LLM chat error:', error);
    return NextResponse.json({ error: 'Failed to process chat request' }, { status: 500 });
  }
}
