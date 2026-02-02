# LLM API Route Documentation

## Table of Contents
1. [Big Picture Overview](#big-picture-overview)
2. [Server-Sent Events (SSE) Explained](#server-sent-events-sse-explained)
3. [Code Structure Overview](#code-structure-overview)
4. [Detailed Code Walkthrough](#detailed-code-walkthrough)
5. [Provider-Specific Implementation](#provider-specific-implementation)
6. [Tool Calling & Actions](#tool-calling--actions)
7. [Logging Implementation](#logging-implementation)
8. [Error Handling](#error-handling)

---

## Big Picture Overview

### What This API Does
The `/app/api/llm/route.js` is a Next.js API route that serves as a **streaming AI coach** for the 90Days app. It:

1. **Receives chat messages** from users
2. **Fetches user context** (their OKRTs - Objectives, Key Results, Tasks)
3. **Streams AI responses** back in real-time using Server-Sent Events (SSE)
4. **Handles tool calls** for creating/updating/deleting OKRTs
5. **Supports multiple AI providers** (OpenAI and Ollama)

### The Flow
```
User sends message → API fetches user context → AI processes → Streams response back
                                                              ↓
                                                    May include tool calls for OKRT actions
```

### Key Technologies
- **Next.js API Routes**: Server-side endpoint
- **Server-Sent Events (SSE)**: Real-time streaming
- **JWT Authentication**: User session management
- **PostgreSQL Database**: User and OKRT data storage
- **AI Providers**: OpenAI GPT models or local Ollama models

---

## Server-Sent Events (SSE) Explained

### What is SSE?
Server-Sent Events is a web standard that allows a server to push data to a web page in real-time. Unlike WebSockets (which are bidirectional), SSE is **unidirectional** - only server to client.

### Why Use SSE for AI Chat?
- **Real-time streaming**: Users see AI responses as they're generated (like ChatGPT)
- **Better UX**: No waiting for complete response
- **Efficient**: Lower overhead than WebSockets for one-way communication
- **Built-in reconnection**: Browsers automatically reconnect if connection drops

### SSE Message Format
```
event: message_type
data: {"type": "content", "data": "Hello"}

event: message_type  
data: {"type": "done"}

```

### Our SSE Message Types
- `content`: Text chunks from AI response
- `preparing_actions`: Indicates tool calls are being prepared
- `actions`: Complete tool call data (OKRT actions)
- `done`: Stream is complete

---

## Code Structure Overview

### Main Sections
1. **Helper Functions** (lines 1-250)
   - Time/quarter calculations
   - Database context fetching
   - System prompt generation
   - Tool definitions

2. **Route Handler** (lines 274-604)
   - Authentication
   - Provider routing (Ollama vs OpenAI)
   - Stream processing

3. **Provider Implementations**
   - **Ollama**: Simple streaming (lines 298-351)
   - **OpenAI**: Complex SSE parsing with tool support (lines 354-596)

---

## Detailed Code Walkthrough

### 1. Authentication & Setup (lines 274-288)
```javascript
const session = await getSession();
if (!session?.sub) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
const userId = parseInt(session.sub, 10);
```
- Validates user session using JWT
- Extracts user ID for database queries

### 2. Context Fetching (lines 287-293)
```javascript
const okrtContext = await getOKRTContext(userId);
const systemPrompt = getCoachSystemPrompt(okrtContext);
```
- `getOKRTContext()`: Fetches user's current OKRTs from database
- `getCoachSystemPrompt()`: Creates AI system prompt with user context

### 3. Provider Selection (line 295)
```javascript
const provider = process.env.LLM_PROVIDER || 'ollama';
```
- Determines which AI provider to use
- Defaults to Ollama (local) if not specified

---

## Provider-Specific Implementation

### Ollama Implementation (Simple Streaming)

**How it works:**
1. Makes HTTP request to local Ollama server
2. Processes streaming JSON responses
3. Extracts text content and forwards to client

**Key Code:**
```javascript
const response = await fetch(`${ollamaUrl}/api/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ model, messages: llmMessages, stream: true })
});
```

**Stream Processing:**
- Reads chunks from Ollama response
- Parses JSON lines
- Extracts `data.message.content`
- Forwards as SSE messages

### OpenAI Implementation (Complex SSE Parsing)

**Why Complex?**
OpenAI's Responses API uses Server-Sent Events with multiple event types and complex tool calling support.

**Key Challenges:**
1. **Multi-line SSE parsing**: Events can span multiple lines
2. **Tool call streaming**: Function arguments arrive in chunks
3. **Multiple completion events**: Different ways tools can complete
4. **Buffer management**: Accumulating partial data

**SSE Event Processing:**
```javascript
const handleEvent = (eventName, payloadStr) => {
  switch (eventName) {
    case 'response.output_text.delta': // Text chunks
    case 'response.tool_call.created': // Tool call starts
    case 'response.tool_call.delta': // Tool arguments chunk
    case 'response.tool_call.completed': // Tool call done
    case 'response.completed': // Everything done
  }
}
```

---

## Tool Calling & Actions

### What are Tools?
Tools allow the AI to perform actions beyond just generating text. In our case, the AI can:
- Create new OKRTs
- Update existing OKRTs  
- Delete OKRTs

### Tool Definition
```javascript
function getActionsTool() {
  return {
    type: "function",
    name: "emit_actions",
    description: "Emit an ordered list of OKRT actions (create, update, delete).",
    parameters: {
      // JSON schema defining action structure
    }
  };
}
```

### Action Processing Flow
1. **AI decides** to use tool based on user request
2. **Tool arguments stream** in chunks via SSE
3. **Arguments are buffered** until complete
4. **Actions are parsed** from JSON
5. **Actions are sent** to client for execution

### Buffer Management
```javascript
const toolBuffers = new Map(); // id -> string[]
const toolNames = new Map();   // id -> name
let actionsPayloads = [];      // aggregated actions
```

**Why Buffers?**
- Tool arguments arrive in small chunks
- Must accumulate until complete before parsing JSON
- Multiple tools can be called simultaneously

---

## Logging Implementation

### Text Response Logging
```javascript
let fullTextResponse = '';
let hasLoggedTextResponse = false;

// Accumulate text deltas
case 'response.output_text.delta': {
  fullTextResponse += textDelta;
  // ... send to client
}

// Log complete response
case 'response.output_text.done': {
  if (fullTextResponse.trim() && !hasLoggedTextResponse) {
    console.log('=== OPENAI FULL TEXT RESPONSE ===');
    console.log(fullTextResponse);
    console.log('=== END OPENAI TEXT RESPONSE ===');
    hasLoggedTextResponse = true;
  }
}
```

### Tool Response Logging
```javascript
if (actionsPayloads.length) { 
  console.log('=== OPENAI COMPLETE TOOL RESPONSE ===');
  console.log(JSON.stringify(actionsPayloads, null, 2));
  console.log('=== END OPENAI TOOL RESPONSE ===');
}
```

**Key Points:**
- Only logs **complete** responses, not deltas
- Prevents duplicate logging with flags
- Pretty-prints JSON for readability

---

## Error Handling

### Stream Error Handling
```javascript
try {
  // Stream processing
} catch (err) {
  console.error('OpenAI streaming error:', err);
  controller.error(err);
}
```

### Graceful Degradation
- If tool parsing fails, continues with text response
- If stream breaks, sends 'done' message
- Logs errors but doesn't crash

### Client-Side Considerations
- Client must handle 'done' message to know stream ended
- Client should implement reconnection logic
- Client must parse JSON from SSE data

---

## Key Concepts Summary

### SSE vs WebSocket
- **SSE**: Unidirectional, simpler, auto-reconnect
- **WebSocket**: Bidirectional, more complex, manual reconnection

### Streaming vs Batch
- **Streaming**: Real-time, better UX, more complex
- **Batch**: Simple, but poor UX for long responses

### Tool Calling Flow
1. AI generates text response
2. AI decides to use tools
3. Tool arguments stream in chunks
4. Complete tool calls are executed
5. Results may trigger more AI responses

### Buffer Management
- **Why needed**: Data arrives in chunks
- **How it works**: Accumulate until complete
- **When to flush**: On completion events

This API is the heart of the AI coaching experience, handling real-time streaming communication between users and the AI while managing complex tool calling for OKRT management.
