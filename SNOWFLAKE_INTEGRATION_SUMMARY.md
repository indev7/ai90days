# Snowflake Integration for AIME - COMPLETE

## Overview
Successfully integrated Snowflake data warehouse access into AIME, following the same pattern as the JIRA JQL integration. AIME can now generate SQL queries, **automatically execute them** via a Next.js proxy API, and process the results without user confirmation.

## Implementation Details

### 1. Knowledge Base File
**File:** [`lib/knowledgeBase/snowflakeDomain.js`](lib/knowledgeBase/snowflakeDomain.js)

Contains comprehensive domain knowledge for AIME including:
- **View Schema**: `RP_TRP_REVIEWS_TEST` with 10 columns for Trustpilot reviews
  - REVIEWID, NUMBEROFREVIEWS, STARS, LOCATION, CREATEDDATETIME
  - SOURCE, COMPANYREPLYCREATEDATETIME, STATUS, DOMAIN, REVIEWDATE
- **SQL Guidance**: Rules for generating safe, efficient SELECT queries
- **Examples**: Common query patterns for weekly summaries, aggregations, and analysis
- **Best Practices**: Date filtering, aggregations, result limiting

### 2. Tool Schema File
**File:** [`lib/toolSchemas/snowflakeQueryActions.js`](lib/toolSchemas/snowflakeQueryActions.js)

Defines the tool schema for AIME to emit Snowflake query actions:
- **Tool Name**: `emit_snowflake_query_actions`
- **Intents**: SNOWFLAKE_QUERY_DATA, SNOWFLAKE_AGGREGATE_DATA, SNOWFLAKE_ANALYZE_REVIEWS
- **Endpoint**: `/api/snowflake/query`
- **Method**: POST
- **Payload**: `{ sql: "SELECT ..." }`
- **Validation**: Only SELECT statements allowed, UPPERCASE column names required

### 3. AIME Route Updates
**File:** [`app/api/aime/route.js`](app/api/aime/route.js)

Added Snowflake integration to AIME backend:
- Imported `SNOWFLAKE_DOMAIN` from knowledge base
- Imported `SNOWFLAKE_QUERY_ACTIONS_SCHEMA` from tool schemas
- Registered in `knowledgeBaseMap` as 'snowflake-domain'
- Registered in `toolMap` as 'emit_snowflake_query_actions'

### 4. LLM Helper Updates
**File:** [`app/api/aime/llm/bedrockHelper.js`](app/api/aime/llm/bedrockHelper.js)

Updated Bedrock helper to recognize Snowflake tool:
- Added `'emit_snowflake_query_actions'` to `ACTION_TOOL_NAMES` set
- Enables proper action handling in the streaming response

### 5. AIME Page Auto-Execution (CRITICAL FIX)
**File:** [`app/aime/page.js`](app/aime/page.js)

**This was the missing piece!** Updated the AIME page to auto-execute Snowflake queries:
- Added Snowflake intents to `AUTO_READONLY_INTENTS` set:
  - `'SNOWFLAKE_QUERY_DATA'`
  - `'SNOWFLAKE_AGGREGATE_DATA'`
  - `'SNOWFLAKE_ANALYZE_REVIEWS'`
- Added `/api/snowflake/` to `AUTO_READONLY_ENDPOINT_PREFIXES` array

**This enables automatic query execution without user confirmation, just like JIRA and Confluence!**

### 6. Existing Proxy API
**File:** [`app/api/snowflake/query/route.js`](app/api/snowflake/query/route.js)

Already implemented and tested:
- Accepts POST requests with `{ sql: "..." }` payload
- Validates SELECT-only queries
- Executes via `runSnowflakeQuery()` helper
- Returns `{ data: [...] }` response

## Data Flow Pattern (Auto-Execute - Same as JIRA)

1. **User Query**: "Can you count and summarize the trust pilot reviews received for each week in January 2026"

2. **AIME Analysis**: 
   - User requests `snowflake-domain` knowledge via req_more_info
   - AIME loads RP_TRP_REVIEWS_TEST schema
   - Generates appropriate SQL query

3. **Tool Call**: AIME emits `emit_snowflake_query_actions` with:
   ```json
   {
     "actions": [{
       "intent": "SNOWFLAKE_AGGREGATE_DATA",
       "endpoint": "/api/snowflake/query",
       "method": "POST",
       "payload": {
         "sql": "SELECT DATE_TRUNC('week', REVIEWDATE) AS week_start, COUNT(*) AS review_count, AVG(STARS) AS avg_rating FROM RP_TRP_REVIEWS_TEST WHERE REVIEWDATE >= '2026-01-01' AND REVIEWDATE < '2026-02-01' GROUP BY DATE_TRUNC('week', REVIEWDATE) ORDER BY week_start"
       }
     }]
   }
   ```

4. **Auto-Execution**: Frontend detects intent in `AUTO_READONLY_INTENTS` and **automatically executes** the query

5. **Backend Query**: Snowflake proxy API executes the SQL and returns results

6. **Auto-Reply**: Frontend automatically sends results back to AIME in a new message

7. **AIME Analysis**: AIME receives the data and provides human-readable summary

**NO USER CONFIRMATION REQUIRED!** The query executes automatically just like JIRA/Confluence queries.

## Example Queries AIME Can Handle

### Weekly Review Summary
```sql
SELECT DATE_TRUNC('week', REVIEWDATE) AS week_start, 
       COUNT(*) AS review_count, 
       AVG(STARS) AS avg_rating 
FROM RP_TRP_REVIEWS_TEST 
WHERE REVIEWDATE >= '2026-01-01' AND REVIEWDATE < '2026-02-01' 
GROUP BY DATE_TRUNC('week', REVIEWDATE) 
ORDER BY week_start
```

### Reviews by Location
```sql
SELECT LOCATION, 
       COUNT(*) AS review_count, 
       AVG(STARS) AS avg_rating 
FROM RP_TRP_REVIEWS_TEST 
WHERE REVIEWDATE >= '2026-01-01' 
GROUP BY LOCATION 
ORDER BY review_count DESC 
LIMIT 20
```

### Company Reply Rate
```sql
SELECT DATE_TRUNC('month', REVIEWDATE) AS month, 
       COUNT(*) AS total_reviews, 
       COUNT(CASE WHEN COMPANYREPLYCREATEDATETIME IS NOT NULL THEN 1 END) AS replied_count,
       ROUND(100.0 * COUNT(CASE WHEN COMPANYREPLYCREATEDATETIME IS NOT NULL THEN 1 END) / COUNT(*), 2) AS reply_rate_pct
FROM RP_TRP_REVIEWS_TEST 
WHERE REVIEWDATE >= '2025-01-01' 
GROUP BY DATE_TRUNC('month', REVIEWDATE) 
ORDER BY month
```

## Security Features

1. **SELECT-only**: Proxy API validates and rejects non-SELECT statements
2. **No DDL/DML**: Cannot create, modify, or delete data
3. **Read-only access**: All queries are read-only by design
4. **SQL injection protection**: Parameterized queries via Snowflake SDK

## Testing

To test the integration:

1. Navigate to `/aime` page (NOT `/coach` - that uses old API)
2. Ask AIME: "Can you count and summarize the trust pilot reviews received for each week in January 2026"
3. AIME should:
   - Request snowflake-domain knowledge
   - Generate appropriate SQL query
   - **Automatically execute the query** (no button click needed)
   - Receive and analyze results
   - Provide human-readable summary

## Future Enhancements

1. **Additional Views**: Add more Snowflake views to the knowledge base as needed
2. **Advanced Analytics**: Support for window functions, CTEs, and complex aggregations
3. **Data Visualization**: Integrate with chart rendering for visual analytics
4. **Query Optimization**: Add query performance hints and best practices
5. **Caching**: Implement result caching for frequently-run queries

## Files Modified

1. ✅ `lib/knowledgeBase/snowflakeDomain.js` - Created
2. ✅ `lib/toolSchemas/snowflakeQueryActions.js` - Created
3. ✅ `app/api/aime/route.js` - Updated (imports and registrations)
4. ✅ `app/api/aime/llm/bedrockHelper.js` - Updated (ACTION_TOOL_NAMES)
5. ✅ `app/aime/page.js` - **Updated (AUTO_READONLY_INTENTS and AUTO_READONLY_ENDPOINT_PREFIXES)**
6. ✅ `app/api/snowflake/query/route.js` - Already exists (tested)

## Key Difference from Initial Implementation

**Initial mistake**: I thought queries would show an "Accept" button like OKRT actions.

**Correct behavior**: Snowflake queries (like JIRA/Confluence queries) are **read-only** and execute **automatically** without user confirmation. This is controlled by:
- `AUTO_READONLY_INTENTS` set in `app/aime/page.js`
- `AUTO_READONLY_ENDPOINT_PREFIXES` array in `app/aime/page.js`

The frontend checks if an action's intent is in the auto-readonly set OR if the endpoint starts with an auto-readonly prefix, and if so, executes it immediately and sends the results back to AIME for analysis.

## Conclusion

The Snowflake integration is complete and follows the established JIRA/Confluence pattern with **automatic query execution**. AIME can now query Trustpilot review data and provide insights on customer feedback, ratings, response rates, and trends over time - all without requiring user confirmation for read-only queries.
