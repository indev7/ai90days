import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDatabase } from '@/lib/db';
 
// Get current quarter for context
function getCurrentQuarter() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 0-based to 1-based
  const quarter = Math.ceil(month / 3);
  return `${year}-Q${quarter}`;
}
 
// Get comprehensive time context
function getTimeContext() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const quarter = Math.ceil(month / 3);
  
  // Quarter start and end dates
  const qStart = new Date(year, (quarter - 1) * 3, 1);
  const qEnd = new Date(year, quarter * 3, 0);
  
  // Days in quarter
  const dayOfQuarter = Math.floor((now - qStart) / (1000 * 60 * 60 * 24)) + 1;
  const totalQuarterDays = Math.floor((qEnd - qStart) / (1000 * 60 * 60 * 24)) + 1;
  
  // Quarter months
  const quarterMonths = [
    ['Jan–Mar', 'Apr–Jun', 'Jul–Sep', 'Oct–Dec'][quarter - 1]
  ];
  
  // Timezone info
  const offsetMinutes = now.getTimezoneOffset();
  const offsetHours = Math.abs(offsetMinutes / 60);
  const utcOffset = offsetMinutes <= 0 ? `+${offsetHours.toString().padStart(2, '0')}:${Math.abs(offsetMinutes % 60).toString().padStart(2, '0')}` : `-${offsetHours.toString().padStart(2, '0')}:${Math.abs(offsetMinutes % 60).toString().padStart(2, '0')}`;
  
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
 
// Fetch user's OKRT context for the coach (include UUIDs)
async function getOKRTContext(userId) {
  try {
    const db = await getDatabase();
    const currentQuarter = getCurrentQuarter();
    
    // Get objectives (prioritize current quarter, but include all)
    const objectives = await db.all(`
      SELECT id, type, title, description, status, progress, cycle_qtr
      FROM okrt
      WHERE owner_id = ? AND type = 'O'
      ORDER BY
        CASE WHEN cycle_qtr = ? THEN 0 ELSE 1 END,
        status = 'A' DESC,
        created_at DESC
      
    `, [userId, currentQuarter]);
 
    const context = [];
    
    for (const obj of objectives) {
      const objData = {
        id: obj.id, // Include UUID for updates/deletes
        type: 'O',
        title: obj.title,
        status: obj.status,
        progress: obj.progress
      };
      
      // Get KRs for this objective (limit 3)
      const krs = await db.all(`
        SELECT id, type, description, kr_target_number, kr_unit, progress
        FROM okrt
        WHERE owner_id = ? AND parent_id = ? AND type = 'K'
        ORDER BY created_at DESC
        
      `, [userId, obj.id]);
      
      objData.krs = [];
      
      for (const kr of krs) {
        const krData = {
          id: kr.id, // Include UUID for updates/deletes
          type: 'K',
          description: kr.description,
          target: `${kr.kr_target_number} ${kr.kr_unit}`,
          progress: kr.progress
        };
        
        // Get tasks for this KR (limit 3)
        const tasks = await db.all(`
          SELECT id, type, description, task_status, due_date, progress
          FROM okrt
          WHERE owner_id = ? AND parent_id = ? AND type = 'T'
          ORDER BY  created_at DESC
          
        `, [userId, kr.id]);
        
        krData.tasks = tasks.map(task => ({
          id: task.id, // Include UUID for updates/deletes
          type: 'T',
          description: task.description,
          status: task.task_status,
          due_date: task.due_date,
          progress: task.progress
        }));
        
        objData.krs.push(krData);
      }
      
      context.push(objData);
    }
    
    return context;
  } catch (error) {
    console.error('Error fetching OKRT context:', error);
    return [];
  }
}
 
// System prompt for Coach Ryan
// System prompt for Coach Ryan (HTML forms, hidden inputs only; KRs/Tasks use description; streaming-safe)
function getSystemPrompt(okrtContext) {
  const timeCtx = getTimeContext();
  const contextBlock = okrtContext.length > 0
    ? `\n\nCONTEXT - Current User's OKRTs:\nNumber of Objectives: ${okrtContext.length}\nFull OKRT Data:\n${JSON.stringify(okrtContext, null, 2)}\nSummary: User has ${okrtContext.length} objective(s) with ${okrtContext.reduce((total, obj) => total + obj.krs.length, 0)} key result(s).`
    : '\n\nCONTEXT - Current User\'s OKRTs:\nNumber of Objectives: 0\nNo OKRTs found for this user in the current quarter.';
 
  const timeBlock = `\n\nTIME CONTEXT:
- Now (ISO): ${timeCtx.nowISO}
- Timezone: ${timeCtx.timezone} (UTC${timeCtx.utcOffset})
- Current quarter: ${timeCtx.currentQuarter}
- Quarter window: ${timeCtx.quarterStart} → ${timeCtx.quarterEnd}
- Day in cycle: ${timeCtx.dayOfQuarter}/${timeCtx.totalQuarterDays}
- Quarter months: ${timeCtx.quarterMonths}`;
 
  return `You are "Coach Ryan", an OKRT coach inside the 90-Days app. You respond via STREAMING.
 
CRITICAL SECURITY RULE: You must ONLY discuss data that appears in the CONTEXT section below. Do NOT make up, hallucinate, or reference any goals, objectives, key results, or tasks that are not explicitly listed in the CONTEXT section. If you mention data not in CONTEXT, it's a security breach.
 
Method in this app
- 90-day cycle (quarter). Current quarter: ${timeCtx.currentQuarter}.
- Objective (O): title, description, area (Life/Work/Health), cycle_qtr, status (D/A/C), visibility (private/team/org), objective_kind (committed/stretch), progress (0–100).
- Key Result (K): description (REQUIRED), kr_target_number, kr_unit (%, $, count, hrs), optional kr_baseline_number, weight (default 1.0), progress. KRs DO NOT use a title field.
- Task (T): description (REQUIRED), optional due_date, task_status (todo/in_progress/done/blocked), optional recurrence_json, weight. Tasks DO NOT use a title field.
 
Rules (STRICT)
- NO markdown, NO backticks, NO code fences, NO raw JSON dumps in the reply.
- Be brief and practical; resolve vague dates with TIME CONTEXT; use concrete numbers.
- Never write to the DB yourself.
- Deleting a parent Objective or KR: propose child deletions FIRST, then the parent LAST (no cascade).
- STREAMING UX: Begin with ONE short sentence summary. Then, if proposing actions, append exactly one HTML block at the end (see FORM CONTRACT). Do not put any text after that block.
- IMPORTANT: Always use the actual UUID from CONTEXT when referencing existing OKRTs (not placeholders like "UUID_FROM_CONTEXT").
- SECURITY: ONLY discuss OKRTs that are explicitly provided in the CONTEXT section. NEVER mention goals, objectives, or data that are not in the current user's CONTEXT.
 
Suggesting an entire OKRT set
- You MAY present a concise human-readable "plan" (Objective with its KRs and Tasks) inline as plain text (not JSON, no markdown).
- Only include executable forms for items whose required IDs/fields are known:
  - If the Objective does NOT exist in CONTEXT (no id), include ONLY the Objective CREATE form now. After it is created, you can propose KR/Task forms in the next turn (they need parent_id).
  - If the Objective exists (has id), you MAY include KR CREATE forms (need parent_objective_id).
  - If a KR exists (has id), you MAY include Task CREATE forms (need parent_kr_id).
 
FORM CONTRACT (HTML with hidden inputs only; visible button only)
- When proposing CREATE/UPDATE/DELETE, output ONE block:
<ACTION_HTML>
  ...one or more forms...
</ACTION_HTML>
- Allowed tags: form, input (type="hidden" only), button.
- Each form MUST:
  - use method="post"
  - include data-endpoint (exact API path) and data-method ("POST"|"PUT"|"DELETE")
  - contain ONLY hidden <input name="..."> payload fields and ONE visible <button type="submit">…</button>
  - NOT use the action= attribute.
- Units: kr_unit ∈ {"count","%","$","hrs"} (choose correctly for the description).
- Use ACTUAL IDs from CONTEXT when referencing existing items (not placeholder text).
 
Exact API endpoints
- CREATE any OKRT:        POST   /api/okrt
- UPDATE a specific OKRT: PUT    /api/okrt/[id]
- DELETE a specific OKRT: DELETE /api/okrt/[id]
 
Required fields by intent (and hidden inputs to include)
- CREATE_OBJECTIVE (POST /api/okrt)
  required: type="O", title, description, area, cycle_qtr
  defaults: status="D", visibility="private", objective_kind="committed", progress=0
- ADD_KR (POST /api/okrt)
  required: type="K", parent_id=<objective_id>, description, kr_target_number, kr_unit
  defaults: weight=1.0
- ADD_TASK (POST /api/okrt)
  required: type="T", parent_id=<kr_id>, description
  optional: due_date
  defaults: task_status="todo", weight=1.0
- UPDATE_TASK_STATUS (PUT /api/okrt/[task_id])
  required: task_status
- UPDATE_KR_PROGRESS (PUT /api/okrt/[kr_id])
  required: progress (0–100)
- UPDATE_DESCRIPTION (PUT /api/okrt/[id])
  required: description
- DELETE (DELETE /api/okrt/[id])
  no body required
 
HTML form templates (emit EXACTLY this shape; hidden inputs only)
 
- Create Objective:
<ACTION_HTML>
<form class="coach-form" method="post" data-endpoint="/api/okrt" data-method="POST">
  <input type="hidden" name="type" value="O"/>
  <input type="hidden" name="title" value="[YOUR_OBJECTIVE_TITLE]"/>
  <input type="hidden" name="description" value="[YOUR_OBJECTIVE_DESCRIPTION]"/>
  <input type="hidden" name="area" value="[Life|Work|Health]"/>
  <input type="hidden" name="cycle_qtr" value="${timeCtx.currentQuarter}"/>
  <input type="hidden" name="status" value="D"/>
  <input type="hidden" name="visibility" value="private"/>
  <input type="hidden" name="objective_kind" value="committed"/>
  <input type="hidden" name="progress" value="0"/>
  <button type="submit">Create Objective</button>
</form>
</ACTION_HTML>
 
- Add Key Result (uses description, not title):
<ACTION_HTML>
<form class="coach-form" method="post" data-endpoint="/api/okrt" data-method="POST">
  <input type="hidden" name="type" value="K"/>
  <input type="hidden" name="parent_id" value="[OBJECTIVE_UUID_FROM_CONTEXT]"/>
  <input type="hidden" name="description" value="[YOUR_KR_DESCRIPTION]"/>
  <input type="hidden" name="kr_target_number" value="[NUMBER]"/>
  <input type="hidden" name="kr_unit" value="[count|%|$|hrs]"/>
  <input type="hidden" name="weight" value="1.0"/>
  <button type="submit">Add Key Result</button>
</form>
</ACTION_HTML>
 
- Add Task (uses description, not title):
<ACTION_HTML>
<form class="coach-form" method="post" data-endpoint="/api/okrt" data-method="POST">
  <input type="hidden" name="type" value="T"/>
  <input type="hidden" name="parent_id" value="[USE_ACTUAL_KR_UUID_FROM_CONTEXT]"/>
  <input type="hidden" name="description" value="[REPLACE_WITH_SPECIFIC_TASK_DESCRIPTION]"/>
  <input type="hidden" name="due_date" value=""/>
  <input type="hidden" name="task_status" value="todo"/>
  <input type="hidden" name="weight" value="1.0"/>
  <button type="submit">Add Task</button>
</form>
</ACTION_HTML>
 
IMPORTANT: When generating forms, you MUST replace [PLACEHOLDERS] with actual values:
- [USE_ACTUAL_KR_UUID_FROM_CONTEXT] → Use the real UUID from CONTEXT (e.g., "test-kr-D60C304C4E35D97B")
- [REPLACE_WITH_SPECIFIC_TASK_DESCRIPTION] → Write a specific, actionable task description (e.g., "Research AI frameworks and tools", "Set up development environment for first AI project")
 
CRITICAL: For CREATE operations, the data-endpoint must be "/api/okrt" (no UUID). The parent_id goes in the hidden input field, NOT in the endpoint URL.
 
- Update Task Status:
<ACTION_HTML>
<form class="coach-form" method="post" data-endpoint="/api/okrt/[TASK_UUID_FROM_CONTEXT]" data-method="PUT">
  <input type="hidden" name="task_status" value="[todo|in_progress|done|blocked]"/>
  <button type="submit">Update Task Status</button>
</form>
</ACTION_HTML>
 
- Update KR Progress:
<ACTION_HTML>
<form class="coach-form" method="post" data-endpoint="/api/okrt/[KR_UUID_FROM_CONTEXT]" data-method="PUT">
  <input type="hidden" name="progress" value="[0-100]"/>
  <button type="submit">Update KR Progress</button>
</form>
</ACTION_HTML>
 
- Update Description (KR or Task):
<ACTION_HTML>
<form class="coach-form" method="post" data-endpoint="/api/okrt/[UUID_FROM_CONTEXT]" data-method="PUT">
  <input type="hidden" name="description" value="[NEW_DESCRIPTION]"/>
  <button type="submit">Update Description</button>
</form>
</ACTION_HTML>
 
- Delete (any item):
<ACTION_HTML>
<form class="coach-form" method="post" data-endpoint="/api/okrt/[UUID_FROM_CONTEXT]" data-method="DELETE">
  <button type="submit">Delete Item</button>
</form>
</ACTION_HTML>
 
Intent policy
- Map user requests precisely (e.g., “add a KR” → ADD_KR; “update description” → UPDATE_DESCRIPTION).
- If ANY required field is missing, ask ONE targeted question and DO NOT output ACTION_HTML yet.
- Otherwise, output exactly one ACTION_HTML block as the LAST thing in the reply.
- ALWAYS use actual UUIDs from CONTEXT, never placeholder text like "UUID_FROM_CONTEXT".
 
${timeBlock}${contextBlock}`;
}
 
 
export async function POST(request) {
  try {
    // Check authentication
    const session = await getSession();
    console.log('\n=== SECURITY DEBUG - Session Check ===');
    console.log('Session object:', session);
    console.log('Session.sub:', session?.sub);
    
    if (!session?.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = parseInt(session.sub);
 
    const { messages } = await request.json();
 
    console.log('\n=== LLM Chat Request ===');
    console.log('User ID from session:', userId);
    console.log('Session sub raw:', session.sub);
    console.log('Messages:', JSON.stringify(messages, null, 2));
 
    
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages array required' }, { status: 400 });
    }
 
    // Get OKRT context
    const okrtContext = await getOKRTContext(userId);
    const systemPrompt = getSystemPrompt(okrtContext);
 
    console.log('\n=== OKRT Context Debug ===');
    console.log('User ID:', userId);
    console.log('Current Quarter:', getCurrentQuarter());
    console.log('OKRT Context:', JSON.stringify(okrtContext, null, 2));
    console.log('\n=== System Prompt ===');
    console.log('System prompt length:', systemPrompt.length);
    console.log('CONTEXT section:', systemPrompt.substring(systemPrompt.indexOf('CONTEXT'), systemPrompt.indexOf('CONTEXT') + 500));
    console.log('\nFull system prompt:');
    console.log(systemPrompt);
 
   
    // Prepare messages for LLM
    const llmMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.slice(-10).map(msg => ({
        role: msg.role,
        content: msg.content
      }))
    ];
 
    const provider = process.env.LLM_PROVIDER || 'ollama';
    console.log('\n=== LLM Provider Configuration ===');
    console.log('Provider:', provider);
    console.log('Model Name:', process.env.LLM_MODEL_NAME);
    
    if (provider === 'ollama') {
      const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
 
      const model = process.env.LLM_MODEL_NAME || process.env.LLM_CHAT_MODEL || 'llama3:latest';
      
      console.log('Ollama URL:', ollamaUrl);
      console.log('Ollama Model:', model);
 
      
      const response = await fetch(`${ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: llmMessages,
          stream: true // Enable streaming
        })
      });
 
      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }
 
      // Create a readable stream for the client
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const reader = response.body.getReader();
          
          try {
            while (true) {
              const { done, value } = await reader.read();
              
              if (done) {
                controller.close();
                break;
              }
              
              // Parse the streaming response chunks
              const chunk = new TextDecoder().decode(value);
              const lines = chunk.split('\n').filter(line => line.trim());
              
              for (const line of lines) {
                try {
                  const data = JSON.parse(line);
                  if (data.message?.content) {
                    // Send each content chunk to the client
                    const streamData = JSON.stringify({
                      type: 'content',
                      data: data.message.content
                    }) + '\n';
                    controller.enqueue(encoder.encode(streamData));
                  }
                  
                  if (data.done) {
                    // Signal completion
                    const doneData = JSON.stringify({ type: 'done' }) + '\n';
                    controller.enqueue(encoder.encode(doneData));
                  }
                } catch (e) {
                  console.error('Error parsing chunk:', e);
                }
              }
            }
          } catch (error) {
            console.error('Streaming error:', error);
            controller.error(error);
          }
        }
      });
 
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
      
    } else if (provider === 'openai') {
      const apiKey = process.env.OPEN_AI_API_KEY;
      const model = process.env.LLM_MODEL_NAME || 'gpt-4';
      
      console.log('OpenAI Model:', model);
      console.log('OpenAI API Key configured:', !!apiKey);
      
      if (!apiKey) {
        throw new Error('OpenAI API key not configured');
      }
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: llmMessages,
          stream: true
        })
      });
 
      if (!response.ok) {
        const errorBody = await response.text();
        console.error('OpenAI API Error Details:', errorBody);
        throw new Error(`OpenAI API error: ${response.status} - ${errorBody}`);
      }
 
      // Create a readable stream for the client
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const reader = response.body.getReader();
          
          try {
            while (true) {
              const { done, value } = await reader.read();
              
              if (done) {
                controller.close();
                break;
              }
              
              // Parse the streaming response chunks
              const chunk = new TextDecoder().decode(value);
              const lines = chunk.split('\n').filter(line => line.trim());
              
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6);
                  
                  if (data === '[DONE]') {
                    const doneData = JSON.stringify({ type: 'done' }) + '\n';
                    controller.enqueue(encoder.encode(doneData));
                    continue;
                  }
                  
                  try {
                    const parsed = JSON.parse(data);
                    if (parsed.choices?.[0]?.delta?.content) {
                      // Send each content chunk to the client
                      const streamData = JSON.stringify({
                        type: 'content',
                        data: parsed.choices[0].delta.content
                      }) + '\n';
                      controller.enqueue(encoder.encode(streamData));
                    }
                  } catch (e) {
                    console.error('Error parsing OpenAI chunk:', e);
                  }
                }
              }
            }
          } catch (error) {
            console.error('OpenAI streaming error:', error);
            controller.error(error);
          }
        }
      });
 
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    } else {
      return NextResponse.json({
        error: 'Invalid LLM provider'
      }, { status: 400 });
    }
    
  } catch (error) {
    console.error('LLM chat error:', error);
    return NextResponse.json({
      error: 'Failed to process chat request'
    }, { status: 500 });
  }
}