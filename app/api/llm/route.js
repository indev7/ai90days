// app/api/llm/route.js
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDatabase, get, all } from '@/lib/pgdb';
import { jiraFetchWithRetry, parseJiraIssue } from '@/lib/jiraAuth';

// Increase route timeout for LLM responses (Next.js 15 route segment config)
export const maxDuration = 300; // 5 minutes (Vercel limit)
export const dynamic = 'force-dynamic'; // Disable caching for LLM responses

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

    // Attempt to load Jira tickets for this user (best-effort). If Jira not connected, leave empty.
    try {
      const jql = 'assignee = currentUser() ORDER BY updated DESC';
      let allIssues = [];
      let fetchedAll = false;
      let currentStart = 0;
      const batchSize = 100;

      while (!fetchedAll && currentStart < 1000) {
        const params = new URLSearchParams({
          jql: jql,
          startAt: currentStart.toString(),
          maxResults: batchSize.toString(),
          fields: 'summary,status,assignee,reporter,priority,issuetype,project,created,updated,labels,description,subtasks,parent,issuelinks'
        });

        const jiraResp = await jiraFetchWithRetry(`/rest/api/3/search/jql?${params}`);
        const jiraJson = await jiraResp.json();
        const batch = jiraJson.issues || jiraJson.values || [];

        if (batch.length === 0) {
          fetchedAll = true;
        } else {
          allIssues = allIssues.concat(batch);
          currentStart += batch.length;

          if (batch.length < batchSize) {
            fetchedAll = true;
          }
        }
      }

      const parsed = allIssues.map(parseJiraIssue).filter(i => i !== null);
      context.jiraTickets = parsed;
    } catch (e) {
      // Ignore Jira errors - not all users are connected
      context.jiraTickets = [];
    }

    return cleanObject(context);
  } catch (error) {
    console.error('Error fetching OKRT context:', error);
    return { user: { displayName: 'User' }, objectives: [], jiraTickets: [] };
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

  // Include Jira tickets summary if available
  const jiraList = okrtContext?.jiraTickets || [];
  const jiraBlock = jiraList.length > 0
    ? `\nJIRA - User's connected Jira tickets (assigned to user): ${jiraList.length}\nJSON: ${JSON.stringify(jiraList)}`
    : `\nJIRA - No connected Jira tickets or user not connected.`;

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

JIRA SUPPORT
- This coach can also manage Jira tickets in addition to OKRTs. When recommending or taking actions on Jira tickets, use these intents and endpoints:
  * CREATE_JIRA: endpoint '/api/jira/tickets/create', method: 'POST', payload: {project, summary, issueType, description?}
  * UPDATE_JIRA: endpoint '/api/jira/tickets/{key}', method: 'PUT', payload: {summary?, description?, assignee?, priority?, labels?}
    - Replace {key} with the actual ticket key (e.g., '/api/jira/tickets/90D-123')
    - Only include fields you want to update
  * COMMENT_JIRA: endpoint '/api/jira/tickets/{key}/comments', method: 'POST', payload: {comment: "text"}
    - Replace {key} with the actual ticket key
  * TRANSITION_JIRA: endpoint '/api/jira/tickets/{key}/transition', method: 'POST', payload: {transitionName: "status"}
    - Replace {key} with the actual ticket key
    - Common status values: "To Do", "In Progress", "Done", "Blocked"
    - Check the Jira ticket's available transitions if unsure
  * CREATE_SUBTASK: endpoint '/api/jira/tickets/{parentKey}/subtasks', method: 'POST', payload: {summary, description?, assignee?, priority?}
    - Replace {parentKey} with the parent ticket key (e.g., '/api/jira/tickets/90D-123/subtasks')
    - Creates a subtask under the parent ticket
  * LINK_JIRA: endpoint '/api/jira/tickets/{key}/links', method: 'POST', payload: {targetKey, linkType, comment?}
    - Replace {key} with the source ticket key
    - linkType options: "blocks", "is blocked by", "relates to", "duplicates", "is duplicated by"
    - targetKey is the ticket you're linking to

⚠️ CRITICAL: PROJECT EXTRACTION FOR JIRA
When user wants to create a Jira ticket, you MUST extract the project KEY (not name) from their message:
- Look at existing Jira tickets in JIRA section above - each ticket has a "project" object with a "key" field
- Extract that project KEY (short code like "90D", "IRIS", "PROJ") from existing tickets
- If user mentions "90 days" in their message, look for a project in existing tickets whose name contains "90" and use its KEY
- The project field in the payload should be the KEY (e.g., "90D"), NOT the full name ("90 Days")
- If NO existing tickets, use "90D" as fallback

EXAMPLES:
Existing tickets show: {"key":"90D-123", "project":{"key":"90D","name":"90 Days"}}
User: "create a ticket in 90 days project for testing"
→ {project: "90D", summary: "testing", issueType: "Task"}

Existing tickets show: {"key":"IRIS-45", "project":{"key":"IRIS","name":"IRIS Project"}}
User: "add ticket for IRIS to track bug"
→ {project: "IRIS", summary: "track bug", issueType: "Task"}

User: "create jira ticket called fix login"
→ Look at existing tickets' project.key field, use that (e.g., {project: "90D", summary: "fix login", issueType: "Task"})

JIRA ACTION EXAMPLES:
1. CREATE_JIRA:
   {intent: "CREATE_JIRA", endpoint: "/api/jira/tickets/create", method: "POST", 
    payload: {project: "90D", summary: "Fix login bug", issueType: "Task", description: "User cannot login"}}

2. UPDATE_JIRA:
   {intent: "UPDATE_JIRA", endpoint: "/api/jira/tickets/90D-123", method: "PUT",
    payload: {summary: "Updated summary", description: "New description"}}

3. COMMENT_JIRA:
   {intent: "COMMENT_JIRA", endpoint: "/api/jira/tickets/90D-123/comments", method: "POST",
    payload: {comment: "Work in progress, 50% complete"}}

4. TRANSITION_JIRA:
   {intent: "TRANSITION_JIRA", endpoint: "/api/jira/tickets/90D-123/transition", method: "POST",
    payload: {transitionName: "In Progress"}}

5. CREATE_SUBTASK:
   {intent: "CREATE_SUBTASK", endpoint: "/api/jira/tickets/90D-123/subtasks", method: "POST",
    payload: {summary: "Implement login form validation", description: "Add client-side validation"}}

6. LINK_JIRA:
   {intent: "LINK_JIRA", endpoint: "/api/jira/tickets/90D-123/links", method: "POST",
    payload: {targetKey: "90D-124", linkType: "blocks", comment: "Cannot proceed until this is done"}}

Jira actions follow ACTIONS_JSON format but use these specific Jira endpoints and payload structures.

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


${timeBlock}${contextBlock}${jiraBlock}`;
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

  // Include compact Jira tickets list if present
  const jiraList = okrtContext?.jiraTickets || [];
  const jiraBlock = jiraList.length > 0
    ? `\nEXISTING JIRA TICKETS:\n${jiraList.slice(0, 10).map(j => `- [${j.key}] ${j.summary} (${j.status})`).join('\n')}\n`
    : `\nEXISTING JIRA TICKETS: none or not connected\n`;

  const timeBlock = `
TIME: Quarter ${timeCtx.currentQuarter} (${timeCtx.quarterStart} to ${timeCtx.quarterEnd})`;

  // DETAILED prompt for llama3.2:latest - keeps full instructions but minimal context
  return `You are an OKRT coach. Address user as "${displayName}".

${timeBlock}
${contextBlock}
${jiraBlock}

CRITICAL: When user wants to create/update/delete OKRTs, you MUST output EXACTLY this format:

[1-2 sentence coaching message]

ACTIONS_JSON:
{"actions":[{"intent":"CREATE_OKRT","endpoint":"/api/okrt","method":"POST","payload":{...fields...}}]}

DATA MODEL:
O (Objective) → K (Key Result) → T (Task) linked by parent_id

JIRA SUPPORT:
- This coach can also propose and emit actions for Jira tickets. Use these intents:
  * CREATE_JIRA: endpoint '/api/jira/tickets/create', payload must have: project, summary, issueType, description?
  * UPDATE_JIRA: endpoint '/api/jira/tickets/{key}', payload: {summary?, description?, assignee?, priority?, labels?}
  * COMMENT_JIRA: endpoint '/api/jira/tickets/{key}/comments', payload: {comment: 'text'}
  * TRANSITION_JIRA: endpoint '/api/jira/tickets/{key}/transition', payload: {transitionName: 'Done'}
  * CREATE_SUBTASK: endpoint '/api/jira/tickets/{parentKey}/subtasks', payload: {summary, description?}
  * LINK_JIRA: endpoint '/api/jira/tickets/{key}/links', payload: {targetKey, linkType}

⚠️ TICKET KEY FORMAT:
- User might say "D90-529" or "90D-529" - BOTH refer to same ticket
- Common formats: D90-XXX, 90D-XXX, IRIS-XXX, PROJ-XXX
- When user says "D90-529", use it AS-IS in the endpoint
- Example: User says "Create subtask for D90-529" → endpoint: "/api/jira/tickets/D90-529/subtasks"

⚠️ PROJECT EXTRACTION:
- Extract project KEY from existing Jira tickets above (look for project.key field, e.g., "90D", "IRIS")
- Use the KEY (short code), NOT the project name
- If user says "90 days", look at existing tickets and use their project.key
- If no existing tickets, use "90D" as fallback
- ALWAYS include project field in CREATE_JIRA payload!

Follow ACTIONS_JSON format.

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

Example 4 - CREATE JIRA SUBTASK:
User: "Create a subtask for ticket D90-529 to implement the login form"

Your response:
I'll create that subtask for you!

ACTIONS_JSON:
{"actions":[{"intent":"CREATE_SUBTASK","endpoint":"/api/jira/tickets/D90-529/subtasks","method":"POST","payload":{"summary":"Implement the login form","description":"Create login form UI components"}}]}

Example 5 - COMMENT ON JIRA:
User: "Add comment to D90-529: Working on this now"

Your response:
I'll add that comment!

ACTIONS_JSON:
{"actions":[{"intent":"COMMENT_JIRA","endpoint":"/api/jira/tickets/D90-529/comments","method":"POST","payload":{"comment":"Working on this now"}}]}

Example 6 - LINK JIRA TICKETS:
User: "Link D90-529 to D90-530 because it blocks it"

Your response:
I'll create that link!

ACTIONS_JSON:
{"actions":[{"intent":"LINK_JIRA","endpoint":"/api/jira/tickets/D90-529/links","method":"POST","payload":{"targetKey":"D90-530","linkType":"blocks"}}]}

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
  const genId = '^gen-[a-z0-9]{8}$';

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
              intent: { type: "string", enum: ["CREATE_OKRT", "UPDATE_OKRT", "DELETE_OKRT", "CREATE_JIRA", "UPDATE_JIRA", "COMMENT_JIRA", "TRANSITION_JIRA", "CREATE_SUBTASK", "LINK_JIRA"] },
              endpoint: { type: "string", enum: ["/api/okrt", "/api/okrt/[id]", "/api/jira/tickets/create", "/api/jira/tickets/[key]", "/api/jira/tickets/[key]/comments", "/api/jira/tickets/[key]/transition", "/api/jira/tickets/[key]/subtasks", "/api/jira/tickets/[key]/links"] },
              method: { type: "string", enum: ["POST", "PUT", "DELETE"] },
              payload: {
                type: "object",
                properties: {
                  id: {
                    allOf: [
                      {
                        anyOf: [
                          { type: "string", pattern: uuidV4 },
                          { type: "string", pattern: genId }
                        ]
                      }
                    ]
                  },
                  type: { type: "string", enum: ["O", "K", "T"] },
                  owner_id: { type: "integer" }, // (server should ignore/overwrite)
                  parent_id: {
                    allOf: [
                      {
                        anyOf: [
                          { type: "string", pattern: uuidV4 },
                          { type: "string", pattern: genId }
                        ]
                      }
                    ]
                  },
                  description: { type: "string" },
                  progress: { type: "number" },
                  order_index: { type: "integer" },
                  task_status: { type: "string", enum: ["todo", "in_progress", "done", "blocked"] },
                  title: { type: "string" },
                  area: { type: "string" },
                  visibility: { type: "string", enum: ["private", "shared"] },
                  objective_kind: { type: "string", enum: ["committed", "stretch"] },
                  status: { type: "string", enum: ["D", "A", "C"] },
                  cycle_qtr: { type: "string" },
                  kr_target_number: { type: "number" },
                  kr_unit: { type: "string", enum: ["%", "$", "count", "hrs"] },
                  kr_baseline_number: { type: "number" },
                  weight: { type: "number" },
                  due_date: { type: "string" },
                  recurrence_json: { type: "string" },
                  blocked_by: { type: "string" },
                  repeat: { type: "string", enum: ["Y", "N"] }
                  ,
                  // Jira-specific fields
                  key: { type: "string" },
                  comment: { type: "string" },
                  fields: { type: "object" },
                  transition_to: { type: "string" },
                  summary: { type: "string" },
                  project: { type: "string" },
                  issueType: { type: "string" },
                  parent: { type: "string" },
                  targetKey: { type: "string" },
                  linkType: { type: "string" }
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

    const { messages, okrtContext: clientOkrtContext } = requestBody;
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages array required' }, { status: 400 });
    }

    // Use client-provided OKRT context if available, otherwise fetch from DB
    let okrtContext = clientOkrtContext || await getOKRTContext(userId);

    // If client provided a partial context, ensure we attach the user's display name
    if (clientOkrtContext && !clientOkrtContext.user) {
      await getDatabase(); // Ensure database is initialized
      const user = await get(`SELECT display_name FROM users WHERE id = ?`, [userId]);
      okrtContext.user = { displayName: user?.display_name || 'User' };
    }

    // If client provided their own context, they may not have Jira tickets included.
    // Attempt to fetch Jira tickets and merge them into the context (best-effort).
    if (clientOkrtContext) {
      try {
        const jql = 'assignee = currentUser() ORDER BY updated DESC';
        let allIssues = [];
        let fetchedAll = false;
        let currentStart = 0;
        const batchSize = 100;

        while (!fetchedAll && currentStart < 1000) {
          const params = new URLSearchParams({
            jql: jql,
            startAt: currentStart.toString(),
            maxResults: batchSize.toString(),
            fields: 'summary,status,assignee,reporter,priority,issuetype,project,created,updated,labels,description'
          });

          const jiraResp = await jiraFetchWithRetry(`/rest/api/3/search/jql?${params}`);
          const jiraJson = await jiraResp.json();
          const batch = jiraJson.issues || jiraJson.values || [];

          if (batch.length === 0) {
            fetchedAll = true;
          } else {
            allIssues = allIssues.concat(batch);
            currentStart += batch.length;

            if (batch.length < batchSize) {
              fetchedAll = true;
            }
          }
        }

        const parsed = allIssues.map(parseJiraIssue).filter(i => i !== null);
        okrtContext.jiraTickets = parsed;
      } catch (e) {
        // Ignore Jira errors for users who haven't connected Jira
        okrtContext.jiraTickets = clientOkrtContext.jiraTickets || [];
      }
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
          num_ctx: 8192,           // Larger context window for llama3.2
          num_thread: 8,           // Use more CPU threads
          repeat_penalty: 1.1,     // Avoid repetition
        }
      };

      // Make request to Ollama
      let response;
      try {
        response = await fetch(`${ollamaUrl}/api/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(ollamaRequestBody),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
        }
      } catch (error) {
        // Check if it's the dreaded headers timeout
        if (error.cause?.code === 'UND_ERR_HEADERS_TIMEOUT') {
          throw new Error(`Ollama is taking too long to respond (>5 min). This usually means:
1. Model is too large for your hardware (current model: ${model})
2. Ollama service is overloaded or crashed (restart: sudo systemctl restart ollama)
3. First request is loading model into memory (wait 2-3 minutes and try again)

Recommended: Use llama3.2:latest (3B, fast and efficient)`);
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

          // Remove markdown code fences (some models add these)
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
                } catch (_) { }
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
                      if (((action.intent === 'UPDATE_OKRT' || action.intent === 'DELETE_OKRT') && action.payload?.id && action.endpoint === '/api/okrt') ||
                        ((action.intent === 'UPDATE_JIRA' || action.intent === 'DELETE_JIRA') && action.payload?.id && action.endpoint === '/api/jira/tickets')) {
                        if (action.endpoint === '/api/okrt') {
                          action.endpoint = `/api/okrt/${action.payload.id}`;
                        } else if (action.endpoint === '/api/jira/tickets') {
                          action.endpoint = `/api/jira/tickets/${action.payload.id}`;
                        }
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
