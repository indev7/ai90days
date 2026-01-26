# Ollama Helper Upgrade Summary

**Date:** January 26, 2026  
**Objective:** Enhance Ollama helper to support JIRA actions, req_more_info, and sophisticated action extraction

---

## Changes Made

### 1. Enhanced [app/api/aime/llm/ollamaHelper.js](app/api/aime/llm/ollamaHelper.js)

#### Added Parameters
- `extractActionsFromArgs`: Function to parse action payloads
- `extractReqMoreInfoFromArgs`: Function to parse req_more_info requests

#### Performance Optimizations
Added Ollama-specific options for better performance:
```javascript
options: {
  temperature: 0.1,      // More deterministic
  top_p: 0.9,           // Nucleus sampling
  num_predict: 3000,    // Larger output buffer
  num_ctx: 8192,        // Larger context window
  num_thread: 8,        // More CPU threads
  repeat_penalty: 1.1,  // Avoid repetition
}
```

#### New Helper Functions

##### `validateJsonStructure(text)`
Comprehensively validates JSON structure:
- Tracks opening/closing braces `{}`
- Tracks opening/closing brackets `[]`
- Handles escaped characters and strings
- Reports specific errors (unclosed braces, unmatched brackets)
- Returns `isComplete` flag to detect incomplete JSON

**Why needed:** Ollama models sometimes output incomplete JSON, so we need to validate before parsing.

##### `convertNestedToActions(obj)`
Converts legacy nested format to flat actions array:
```javascript
// Legacy format (WRONG):
{
  objective: { title: "Learn Piano", ... },
  kr: { description: "Practice 30 min daily", ... },
  task: { description: "Buy piano book", ... }
}

// Correct format:
{
  actions: [
    { intent: "CREATE_OKRT", endpoint: "/api/okrt", method: "POST", payload: {...} },
    { intent: "CREATE_OKRT", endpoint: "/api/okrt", method: "POST", payload: {...} },
    { intent: "CREATE_OKRT", endpoint: "/api/okrt", method: "POST", payload: {...} }
  ]
}
```

**Why needed:** Some models still output the old nested format, so we convert it for backwards compatibility.

##### `tryExtractData(raw)`
Main extraction logic that handles multiple formats:

**Priority 1: REQ_MORE_INFO Extraction**
```javascript
// Looks for this pattern:
REQ_MORE_INFO:
{
  "domainKnowledge": { "ids": ["jira-domain"] },
  "tools": { "ids": ["emit_jira_actions"] }
}
```

**Priority 2: ACTIONS_JSON Extraction**
```javascript
// Looks for this pattern:
ACTIONS_JSON:
{"actions":[{...}]}
```

**Features:**
- Removes markdown code fences (```json, ```)
- Finds opening `{` and matches closing `}`
- Validates JSON structure before parsing
- Attempts to fix incomplete JSON (adds missing `}`)
- Handles nested format and converts it
- Performs fallback search if markers not found

**Post-Processing:**
1. **ID Regeneration**: Replaces duplicate or example IDs
   - Example IDs: `gen-a1b2c3d4`, `gen-x7m9k2p4`, etc.
   - Generates new random IDs: `gen-` + 8 random chars
   - Updates `parent_id` references in child actions

2. **Endpoint Correction**: Fixes endpoints missing IDs
   - `UPDATE_OKRT` with `/api/okrt` → `/api/okrt/{id}`
   - `UPDATE_JIRA` with `/api/jira/tickets` → `/api/jira/tickets/{key}`

#### Enhanced Streaming Logic

**During Streaming:**
```javascript
// Accumulate text
accumText += content;
send({ type: 'content', data: content });

// Try extraction on each chunk (early detection)
if (!actionsSent && !reqMoreInfoSent) {
  const { actions, reqMoreInfo } = tryExtractData(accumText);
  
  if (reqMoreInfo && !reqMoreInfoSent) {
    send({ type: 'req_more_info', data: reqMoreInfo });
    reqMoreInfoSent = true;
  }
  
  if (actions && actions.length > 0 && !actionsSent) {
    send({ type: 'actions', data: actions });
    actionsSent = true;
  }
}
```

**On Stream Complete:**
```javascript
// Final attempt if nothing extracted during streaming
if (!actionsSent && !reqMoreInfoSent) {
  const { actions, reqMoreInfo } = tryExtractData(accumText);
  // Send whatever we found
}
```

#### Debug Logging
Comprehensive console logging for troubleshooting:
```
🔍 OLLAMA EXTRACTION DEBUG:
Raw text length: 1234
Contains ACTIONS_JSON: true
Contains REQ_MORE_INFO: false
✓ Found ACTIONS_JSON marker at position 567
✅ Extracted 3 action(s) from ACTIONS_JSON
⚠️  Replaced duplicate/example ID gen-abc12345 → gen-k3x7m9p2
🔧 Corrected endpoint for UPDATE_OKRT: /api/okrt/gen-k3x7m9p2
```

---

### 2. Updated [app/api/aime/route.js](app/api/aime/route.js)

Changed Ollama handler invocation to pass extraction functions:

**Before:**
```javascript
if (provider === 'ollama') {
  return handleOllama({ llmMessages, logHumanReadable, logLlmApiInteraction });
}
```

**After:**
```javascript
if (provider === 'ollama') {
  return handleOllama({ 
    llmMessages, 
    logHumanReadable, 
    logLlmApiInteraction,
    extractActionsFromArgs,
    extractReqMoreInfoFromArgs
  });
}
```

---

## Supported Formats

### 1. OKRT Actions
```javascript
ACTIONS_JSON:
{"actions":[
  {"intent":"CREATE_OKRT","endpoint":"/api/okrt","method":"POST","payload":{...}},
  {"intent":"UPDATE_OKRT","endpoint":"/api/okrt/gen-abc","method":"PUT","payload":{...}},
  {"intent":"DELETE_OKRT","endpoint":"/api/okrt/gen-xyz","method":"DELETE","payload":{...}}
]}
```

### 2. JIRA Actions (NEW)
```javascript
ACTIONS_JSON:
{"actions":[
  {"intent":"CREATE_JIRA","endpoint":"/api/jira/tickets/create","method":"POST","payload":{
    "project":"90D","summary":"Fix login bug","issueType":"Task"
  }},
  {"intent":"UPDATE_JIRA","endpoint":"/api/jira/tickets/90D-123","method":"PUT","payload":{
    "summary":"Updated title"
  }},
  {"intent":"COMMENT_JIRA","endpoint":"/api/jira/tickets/90D-123/comments","method":"POST","payload":{
    "comment":"Work in progress"
  }},
  {"intent":"TRANSITION_JIRA","endpoint":"/api/jira/tickets/90D-123/transition","method":"POST","payload":{
    "transitionName":"In Progress"
  }},
  {"intent":"CREATE_LEAVE","endpoint":"/api/jira/tickets/create","method":"POST","payload":{
    "project":"ILT","issueType":"Leave-Request","leaveType":"Casual Leaves 2026",
    "startDate":"2026-02-01","days":2,"parent":{"key":"ILT-11602"}
  }},
  {"intent":"LIST_JIRA_TICKETS","endpoint":"/api/jira/tickets?assignee=currentUser()&status=Open","method":"GET"},
  {"intent":"BULK_TRANSITION_JIRA","endpoint":"/api/jira/tickets/bulk-transition","method":"POST","payload":{
    "ticketKeys":["ILT-123","ILT-124"],"transitionName":"Approve"
  }}
]}
```

### 3. Request More Info (Knowledge-On-Demand)
```javascript
REQ_MORE_INFO:
{
  "data": { "sections": [{"sectionId": "myOKRTs"}] },
  "domainKnowledge": { "ids": ["jira-domain"] },
  "tools": { "ids": ["emit_jira_actions"] }
}
```

---

## Benefits

### 1. **JIRA Support**
- ✅ Create, update, comment, transition JIRA tickets
- ✅ Create subtasks and link tickets
- ✅ Special leave request workflow (CREATE_LEAVE)
- ✅ List tickets with filtering
- ✅ Bulk operations (BULK_TRANSITION_JIRA)

### 2. **Knowledge-On-Demand**
- ✅ LLM can request JIRA domain knowledge dynamically
- ✅ LLM can request JIRA action tools on-demand
- ✅ Prevents over-fetching and reduces token usage

### 3. **Robust JSON Parsing**
- ✅ Validates JSON structure before parsing
- ✅ Attempts to fix incomplete JSON
- ✅ Handles multiple formats (ACTIONS_JSON, REQ_MORE_INFO)
- ✅ Converts legacy nested format

### 4. **Smart Post-Processing**
- ✅ Regenerates duplicate/example IDs
- ✅ Fixes missing IDs in endpoints
- ✅ Updates parent_id references
- ✅ Comprehensive debug logging

### 5. **Performance Optimizations**
- ✅ Optimized Ollama parameters for speed
- ✅ Early extraction during streaming
- ✅ Efficient JSON parsing with validation
- ✅ Model stays loaded for 15 minutes

---

## Testing Checklist

### OKRT Actions
- [ ] Create objective with KRs and tasks
- [ ] Update existing OKRT (check ID handling)
- [ ] Delete OKRT
- [ ] Progress propagation updates
- [ ] Verify IDs not shown in coaching messages

### JIRA Actions
- [ ] Create regular ticket (Task/Bug/Story)
- [ ] Update ticket summary/description
- [ ] Add comment to ticket
- [ ] Transition ticket status
- [ ] Create subtask
- [ ] Link tickets
- [ ] List tickets with status filter
- [ ] List tickets with project filter
- [ ] Create leave request (Medical/Casual/Annual)
- [ ] Bulk transition leaves

### req_more_info (Knowledge-On-Demand)
- [ ] Request JIRA domain knowledge
- [ ] Request JIRA action tools
- [ ] Request data sections (myOKRTs, etc.)
- [ ] Verify follow-up request with augmented context

### Edge Cases
- [ ] Incomplete JSON (missing final `}`)
- [ ] Nested format conversion
- [ ] Duplicate ID regeneration
- [ ] Missing endpoint IDs correction
- [ ] Multiple actions in one request
- [ ] Mixed OKRT and JIRA actions

---

## Error Handling

### Invalid JSON
```
❌ Failed to parse ACTIONS_JSON: Unexpected token } in JSON at position 123
⚠️  Attempting to fix incomplete JSON...
✅ Extracted 2 action(s) from fixed JSON
```

### Nested Format
```
⚠️  Found nested format, converting...
✅ Converted nested format to 3 actions
```

### Duplicate IDs
```
⚠️  Replaced duplicate/example ID gen-abc12345 → gen-k3x7m9p2
⚠️  Updated parent_id reference: gen-abc12345 → gen-k3x7m9p2
```

### Missing Endpoint IDs
```
🔧 Corrected endpoint for UPDATE_OKRT: /api/okrt/gen-xyz123
🔧 Corrected endpoint for UPDATE_JIRA: /api/jira/tickets/90D-529
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        COACH PAGE (Frontend)                     │
│  - User: "Create a JIRA ticket for fixing the login bug"        │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 │ POST /api/aime
                 │
┌────────────────▼────────────────────────────────────────────────┐
│                   AIME API ROUTE (/api/aime)                    │
│  - Builds system prompt with basic instructions                 │
│  - Detects Ollama provider                                      │
│  - Passes extractActionsFromArgs, extractReqMoreInfoFromArgs    │
└────────────────┬────────────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────────────┐
│                      OLLAMA HELPER                               │
│                                                                  │
│  1. Send request to Ollama with optimized parameters            │
│  2. Stream response and accumulate text                         │
│  3. Look for markers:                                           │
│     - REQ_MORE_INFO: (for knowledge-on-demand)                  │
│     - ACTIONS_JSON: (for action execution)                      │
│  4. Validate JSON structure                                     │
│  5. Parse and extract data                                      │
│  6. Post-process:                                               │
│     - Regenerate duplicate IDs                                  │
│     - Fix missing endpoint IDs                                  │
│     - Convert nested format if needed                           │
│  7. Stream back to client:                                      │
│     - { type: 'content', data: '...' }                          │
│     - { type: 'req_more_info', data: {...} }                    │
│     - { type: 'actions', data: [...] }                          │
│     - { type: 'done' }                                          │
└────────────────┬────────────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────────────┐
│                        COACH PAGE (Frontend)                     │
│  - Renders coaching message                                     │
│  - If req_more_info: automatically sends follow-up request      │
│  - If actions: shows "Accept" buttons                           │
│  - On accept: executes actions via /api/okrt or /api/jira/*     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Next Steps

1. **Test thoroughly** with various JIRA action scenarios
2. **Monitor console logs** for extraction issues
3. **Update system prompts** to use JIRA domain knowledge and tools
4. **Document** JIRA workflows for users
5. **Add analytics** to track JIRA action usage

---

## Related Files

- [lib/knowledgeBase/jiraDomain.js](lib/knowledgeBase/jiraDomain.js) - JIRA domain knowledge
- [lib/toolSchemas/jiraActions.js](lib/toolSchemas/jiraActions.js) - JIRA action schemas
- [app/api/aime/route.js](app/api/aime/route.js) - Main AIME route
- [app/api/aime/llm/ollamaHelper.js](app/api/aime/llm/ollamaHelper.js) - Enhanced Ollama helper
- [AIME_ARCHITECTURE_RESEARCH.md](AIME_ARCHITECTURE_RESEARCH.md) - Full architecture documentation
