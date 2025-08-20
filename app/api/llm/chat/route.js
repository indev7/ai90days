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

// Fetch user's OKRT context for the coach
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
      LIMIT 3
    `, [userId, currentQuarter]);

    const context = [];
    
    for (const obj of objectives) {
      const objData = {
        id: obj.id,
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
        LIMIT 3
      `, [userId, obj.id]);
      
      objData.krs = [];
      
      for (const kr of krs) {
        const krData = {
          id: kr.id,
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
          ORDER BY task_status = 'in_progress' DESC, created_at DESC
          LIMIT 3
        `, [userId, kr.id]);
        
        krData.tasks = tasks.map(task => ({
          id: task.id,
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
function getSystemPrompt(okrtContext) {
  const timeCtx = getTimeContext();
  const contextBlock = okrtContext.length > 0 ? 
    `\n\nCONTEXT - Current OKRTs:\n${JSON.stringify(okrtContext, null, 2)}` : 
    '\n\nCONTEXT: No OKRTs found for current quarter.';

  const timeBlock = `\n\nTIME CONTEXT:
- Now (ISO): ${timeCtx.nowISO}
- Timezone: ${timeCtx.timezone} (UTC${timeCtx.utcOffset})
- Current quarter: ${timeCtx.currentQuarter}
- Quarter window: ${timeCtx.quarterStart} → ${timeCtx.quarterEnd}
- Day in cycle: ${timeCtx.dayOfQuarter}/${timeCtx.totalQuarterDays}
- Quarter months: ${timeCtx.quarterMonths}`;

  return `You are "an OKRT coach inside the 90-Days app.

Method in this app:
- 90-day cycle (quarter): Users work in fixed quarters (e.g., 2025-Q3). Current quarter: ${timeCtx.currentQuarter}.
- Objective (O): Inspiring, directional outcome. Fields: title, description, area (Life/Work/Health), cycle_qtr, status (D/A/C), visibility (private/team/org), objective_kind (committed/stretch).
- Key Result (K): Must be measurable. Fields: description, kr_target_number, kr_unit (%, $, count, hrs), optional kr_baseline_number, weight (default 1.0).
- Task (T): Action step for a KR. Fields: description, optional due_date, task_status (todo/in_progress/done/blocked), optional recurrence_json, weight.
- Progress: progress is 0–100. The coach may propose updates but never writes to DB.

Rules:
- Do not include mardown or back ticks in your response
- Be brief and practical.
- Be helpful and proactive - suggest specific titles, descriptions, and key results based on user input rather than just asking for them.
- Never write to the database yourself.
- IMPORTANT: When deleting a parent (Objective or KR), you MUST generate separate delete actions for ALL children first, then the parent last. The API only deletes single items, not cascades.
- If the user's intent is to CREATE/UPDATE/DELETE an OKRT item, propose it and ALWAYS append exactly one fenced block:
BLOCK FORMAT (must match exactly)
- The block MUST start with "<ACTIONS_JSON>" on its own line and end with "</ACTIONS_JSON>" on its own line.
- !!!VERY IMPORTANT!!!Do NOT wrap out put in backticks or markdown. No bold, no code fences, no extra braces.
- The block MUST be the last thing in the reply (no text after it).
- Do NOT print any other JSON outside this block.

<ACTIONS_JSON>{
  "intent": "<CREATE_OBJECTIVE|ADD_KR|ADD_TASK|UPDATE_TASK_STATUS|UPDATE_KR_PROGRESS|RENAME|DELETE|GENERAL_CHAT>",
  "status": "<COLLECTING|READY>",
  "actions": [
    {
      "id": "string-id",
      "label": "Button label",
      "endpoint": "/delete|/update|/create",
      "method": "DELETE|PUT|POST",
      "body": { "id": "number for delete/update", "other": "fields for create/update" }
    }
  ],
  "missing": ["field1", "field2"],
  "options": [ { "label": "Disambiguation text", "value": "entity_id" } ],
  "followups": [ { "label": "Add another task", "intent": "ADD_TASK" } ]
}</ACTIONS_JSON>

API Examples:
- DELETE: endpoint="/delete", method="DELETE", body={"id": 123}
- UPDATE: endpoint="/update", method="PUT", body={"id": 123, "title": "new title"}  
- CREATE: endpoint="/create", method="POST", body={"type": "O", "title": "objective"}

- When users provide vague requests, suggest specific titles and descriptions based on their input, then offer action buttons with your suggestions.
- You should be proactive in filling in reasonable defaults and suggestions rather than asking users to provide every detail.
- If you can reasonably infer missing information from context, suggest it and include action buttons.
- If the user is not requesting OKRT changes, answer helpfully and set "intent":"GENERAL_CHAT".
- Keep responses short. Use only information given in the conversation; do not invent IDs.${timeBlock}${contextBlock}`
;
}

export async function POST(request) {
  try {
    // Check authentication
    const session = await getSession();
    if (!session?.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = parseInt(session.sub);

    const { messages } = await request.json();

    console.log('\n=== LLM Chat Request ===');
    console.log('User ID:', userId);
    console.log('Messages:', JSON.stringify(messages, null, 2));

    
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages array required' }, { status: 400 });
    }

    // Get OKRT context
    const okrtContext = await getOKRTContext(userId);
    const systemPrompt = getSystemPrompt(okrtContext);

    console.log('\n=== System Prompt ===');
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
    
    if (provider === 'ollama') {
      const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
      const model = process.env.LLM_CHAT_MODEL || 'llama3:latest';
      
      const response = await fetch(`${ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: llmMessages,
          stream: false
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const data = await response.json();
            // Log raw LLM response
      console.log('\n=== LLM Raw Response ===');
      console.log(data.message?.content || '');
      const text = data.message?.content || '';
      
      // Parse ACTIONS_JSON block
      let actions = [];
      const actionsMatch = text.match(/<ACTIONS_JSON>\s*([\s\S]*?)\s*<\/ACTIONS_JSON>/);
      if (actionsMatch) {
        try {
          const jsonStr = actionsMatch[1].trim();
          console.log('Parsing ACTIONS_JSON:', jsonStr);
          const actionsData = JSON.parse(jsonStr);
          actions = actionsData.actions || [];
        } catch (e) {
          console.error('Failed to parse ACTIONS_JSON:', e);
          console.error('Raw JSON:', actionsMatch[1]);
        }
      }
      
      // Remove ACTIONS_JSON block from response text
      const cleanText = text.replace(/<ACTIONS_JSON>[\s\S]*?<\/ACTIONS_JSON>/g, '').trim();
      
      return NextResponse.json({ text: cleanText, actions });
      
    } else if (provider === 'openai') {
      // Stub for OpenAI - will implement later
      return NextResponse.json({ 
        error: 'OpenAI provider not implemented yet' 
      }, { status: 501 });
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
