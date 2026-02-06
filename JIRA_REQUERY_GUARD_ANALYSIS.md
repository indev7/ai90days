# Jira Requery Guard - Critical Issues Analysis

## Problem Statement
The Jira requery guard is stopping legitimate retry attempts prematurely, blocking valid queries with the error:
> "I stopped repeated Jira reads for this request. If needed, please reconnect Jira at /jira and retry."

## Current Implementation Issues

### Issue 1: Guard Counter Never Resets Between User Messages
**Location:** [`app/aime/page.js:749`](app/aime/page.js:749)

```javascript
const jiraRequeryGuardRef = useRef(0);
```

**Problem:** The counter is only reset in two places:
1. Line 792: When a NEW user message is sent (`!skipAddUserMessage && !useOverride`)
2. Line 1201: After successful auto-read action execution

**Impact:** If the user asks a follow-up question using `skipAddUserMessage: true` (which happens during auto-retries), the counter persists and blocks legitimate queries.

### Issue 2: Overly Aggressive Trigger Condition
**Location:** [`app/aime/page.js:963-974`](app/aime/page.js:963)

```javascript
if (hasJiraToolResultsInHistory && hasPendingJiraAutoRead && !jiraHasMorePages) {
  jiraRequeryGuardRef.current += 1;
  if (jiraRequeryGuardRef.current > 1) {
    // BLOCKS IMMEDIATELY
    addMessage({ content: 'I stopped repeated Jira reads...', error: true });
    return;
  }
}
```

**Problems:**
1. **Doesn't distinguish between different queries** - Any Jira query in history triggers this, even if the new query is completely different
2. **No JQL comparison** - Doesn't check if the pending query is actually the same as previous queries
3. **Blocks after just 2 attempts** - Counter > 1 means it blocks on the 2nd occurrence
4. **Persists across conversation turns** - If user refines their question, the counter doesn't reset

### Issue 3: Conflates "No More Pages" with "Same Query"
**Location:** [`app/aime/page.js:959`](app/aime/page.js:959)

```javascript
const jiraHasMorePages = Boolean(jiraResultData?.hasMore || jiraResultData?.nextPageToken);
```

**Problem:** The logic assumes:
- If `!jiraHasMorePages` AND there's a pending Jira action
- Then it must be a duplicate query

**Reality:** The user might be asking a legitimately different question that requires a new Jira query with different JQL.

## Scenarios Where Legitimate Queries Are Blocked

### Scenario 1: User Refines Their Question
```
User: "Show me approved leave requests"
→ Jira query executes, returns results, hasMore=false
User: "Now show me rejected leave requests"
→ BLOCKED! Counter was at 1, now increments to 2
```

### Scenario 2: LLM Auto-Retry After System Notice
```
Turn 1: LLM calls Jira, gets results
Turn 2: LLM tries to call Jira again (counter = 1)
→ System notice sent, LLM retries with skipAddUserMessage=true
Turn 3: Counter still at 1, LLM tries Jira again (counter = 2)
→ BLOCKED! Even though this might be a legitimate retry
```

### Scenario 3: Multiple Different Jira Projects
```
User: "Check project A"
→ Jira query for project A, hasMore=false
User: "Now check project B"
→ BLOCKED! Even though it's a completely different project
```

## Root Cause Analysis

The guard was designed to prevent infinite loops where the LLM repeatedly calls the same Jira query. However, it:

1. **Doesn't fingerprint the actual query** - No comparison of JQL, project, fields, etc.
2. **Persists state too aggressively** - Doesn't reset between legitimate user questions
3. **Triggers too early** - Blocks after just 2 occurrences without verifying they're actually duplicates
4. **Conflates pagination completion with query duplication** - `!jiraHasMorePages` doesn't mean "same query"

## Recommended Fixes

### Fix 1: Add Query Fingerprinting
Compare the actual pending Jira query with previous queries:

```javascript
// Create fingerprint of Jira query
const getJiraQueryFingerprint = (action) => {
  const { jql, project, fields, maxResults } = action?.payload || {};
  return JSON.stringify({ jql, project, fields, maxResults });
};

// Track last Jira query fingerprint
const lastJiraQueryFingerprintRef = useRef('');

// In the guard logic:
const pendingJiraAction = pendingAutoReadActions.find(a => 
  String(a?.endpoint || '').startsWith('/api/jira/')
);
const currentFingerprint = getJiraQueryFingerprint(pendingJiraAction);

// Only increment if it's actually the same query
if (currentFingerprint === lastJiraQueryFingerprintRef.current) {
  jiraRequeryGuardRef.current += 1;
} else {
  lastJiraQueryFingerprintRef.current = currentFingerprint;
  jiraRequeryGuardRef.current = 0; // Reset for new query
}
```

### Fix 2: Reset Counter on New User Intent
Reset the counter when the user provides new input (even in auto-retry scenarios):

```javascript
// In sendMessage, before the guard check:
if (trimmedContent && !forceSend) {
  // New user input = reset guard
  jiraRequeryGuardRef.current = 0;
}
```

### Fix 3: Increase Threshold
Change from `> 1` to `> 2` to allow more legitimate retries:

```javascript
if (jiraRequeryGuardRef.current > 2) { // Was: > 1
  addMessage({ content: 'I stopped repeated Jira reads...', error: true });
  return;
}
```

### Fix 4: Add Time-Based Reset
Reset the counter if enough time has passed:

```javascript
const lastJiraQueryTimeRef = useRef(0);
const JIRA_GUARD_RESET_MS = 30000; // 30 seconds

// In guard logic:
const now = Date.now();
if (now - lastJiraQueryTimeRef.current > JIRA_GUARD_RESET_MS) {
  jiraRequeryGuardRef.current = 0;
}
lastJiraQueryTimeRef.current = now;
```

## Priority Recommendation

**Implement Fix 1 (Query Fingerprinting) immediately** - This is the most critical fix as it ensures the guard only triggers for actual duplicate queries, not different queries to the same system.

The current implementation is fundamentally flawed because it treats "any Jira query after a previous Jira query" as a duplicate, which is incorrect.
