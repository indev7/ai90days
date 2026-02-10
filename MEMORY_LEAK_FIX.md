# Memory Leak Fix - LLM API Logger

## Problem Identified

The Vercel deployment was experiencing increasing memory usage due to the LLM API logging implementation attempting to write to files in a serverless environment.

### Root Cause

1. **File System Limitations**: Vercel's serverless functions have a read-only filesystem (except `/tmp`)
2. **Failed Write Attempts**: The logger in [`lib/llmApiLogger.js`](lib/llmApiLogger.js) was calling `fs.promises.appendFile()` on every LLM request/response
3. **Memory Accumulation**: Failed file operations don't throw errors immediately but accumulate in memory buffers
4. **Large Payloads**: Each log entry included:
   - Full request body (system prompt + messages + tools)
   - Full response body (up to 200KB per response)
   - Headers and metadata

### Affected Code Locations

The logger was invoked in multiple LLM helpers:
- `app/api/aime/llm/bedrockHelper.js` (lines 124, 180)
- `app/api/aime/llm/openAIHelper.js`
- `app/api/aime/llm/anthropicHelper.js`
- `app/api/aime/llm/ollamaHelper.js`

## Solution Implemented

Modified [`lib/llmApiLogger.js`](lib/llmApiLogger.js) to:

1. **Added Environment Variable Control**: `ENABLE_LLM_FILE_LOGGING`
   - Defaults to `false` (disabled)
   - Set to `'true'` to enable file logging in local development

2. **Early Return for Serverless**: When file logging is disabled, the function returns immediately without attempting file operations

3. **Error-Only Console Logging**: Still logs errors to console for debugging without the memory overhead

## Usage

### Production (Vercel)
No action needed - file logging is disabled by default, preventing memory leaks.

### Local Development
To enable file logging for debugging:

```bash
# Add to .env.local
ENABLE_LLM_FILE_LOGGING=true
```

## Expected Results

- **Memory Usage**: Should stabilize and no longer increase over time
- **Performance**: Slight improvement due to eliminated file I/O attempts
- **Debugging**: Error cases still logged to console (visible in Vercel logs)

## Verification

Monitor Vercel dashboard "Fluid Provisioned Memory" metric after deployment. Memory usage should:
1. Stop increasing over time
2. Remain stable during normal operation
3. Scale appropriately with actual request load

## Alternative Solutions Considered

1. **Write to `/tmp`**: Would work but still accumulates files until function cold start
2. **External Logging Service**: Adds complexity and cost (Datadog, LogDNA, etc.)
3. **Vercel Log Drains**: Requires paid plan and additional setup

The implemented solution is the simplest and most effective for this use case.
