# Summary: app/api/llm/route.js

This document summarizes the functions and their purposes in `app/api/llm/route.js`.

## Functions

### logHumanReadable(title, obj)
Logs a labeled JSON object in a more readable form by unescaping common escape sequences before printing.

### getCurrentQuarter()
Returns a string for the current quarter in `YYYY-QN` format based on the current date.

### getTimeContext()
Builds a detailed time context object (ISO timestamp, timezone/UTC offset, current quarter, quarter range, day-of-quarter, and quarter month span).

### cleanObject(obj)
Recursively removes empty, null, or undefined values from objects and arrays, returning a cleaned structure.

### getCoachSystemPrompt(okrtContext)
Constructs the system prompt for the AI coach, embedding time context and OKRT context with strict output and action rules.

### getActionsTool()
Defines the `emit_actions` tool schema used by the OpenAI Responses API, including payload validation patterns and required fields.

### extractActionsFromArgs(argsStr)
Parses tool call arguments and normalizes a variety of possible shapes into a consistent `actions` array.

### POST(request)
Route handler that authenticates the user, validates input, builds messages, selects the LLM provider, and streams the response:
- `ollama` path: calls the Ollama chat API with streaming and relays content chunks.
- `openai` path: calls the OpenAI Responses API with tool support, parses SSE events, aggregates tool calls, and streams content and action payloads.
- Returns errors for invalid providers or failures.

## Notes
- There is a commented-out `getOKRTContext` implementation that would fetch OKRT data from a database.
- The handler uses `getSession()` for auth and relies on request-provided `okrtContext` for context.
