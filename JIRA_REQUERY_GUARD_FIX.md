# Jira Requery Guard - Fix Implementation

## Summary
Fixed critical issues in the Jira requery guard that was blocking legitimate queries and stopping valid retries prematurely.

## Changes Made

### 1. Added Query Fingerprinting (Primary Fix)
**Files Modified:** [`app/aime/page.js`](app/aime/page.js)

**New State Variables:**
- `lastJiraQueryFingerprintRef` - Stores fingerprint of the last Jira query
- `lastJiraQueryTimeRef` - Tracks timestamp of last Jira query attempt

**Logic Changes:**
```javascript
// Before: Blocked ANY Jira query after a previous Jira query
if (hasJiraToolResultsInHistory && hasPendingJiraAutoRead && !jiraHasMorePages) {
  jiraRequeryGuardRef.current += 1;
  if (jiraRequeryGuardRef.current > 1) { // Blocked on 2nd occurrence
    // STOP
  }
}

// After: Only blocks IDENTICAL queries
const currentJiraFingerprint = getAutoReadActionFingerprint(pendingJiraActions);

if (currentJiraFingerprint === lastJiraQueryFingerprintRef.current) {
  jiraRequeryGuardRef.current += 1; // Same query
} else {
  lastJiraQueryFingerprintRef.current = currentJiraFingerprint;
  jiraRequeryGuardRef.current = 0; // Different query - reset
}
```

**Impact:** Now distinguishes between:
- Different JQL queries
- Different projects
- Different field selections
- Different filters

### 2. Time-Based Reset
**Configuration:** [`lib/jiraConfig.js`](lib/jiraConfig.js:40)
```javascript
JIRA_GUARD_RESET_MS: 30000, // Reset guard after 30 seconds
```

**Logic:**
```javascript
if (now - lastJiraQueryTimeRef.current > JIRA_CONFIG.JIRA_GUARD_RESET_MS) {
  jiraRequeryGuardRef.current = 0;
  lastJiraQueryFingerprintRef.current = '';
}
```

**Impact:** Automatically resets the guard after 30 seconds, preventing stale state from blocking new queries.

### 3. Increased Retry Threshold
**Configuration:** [`lib/jiraConfig.js`](lib/jiraConfig.js:39)
```javascript
MAX_JIRA_REQUERY_ATTEMPTS: 2, // Allow up to 3 total attempts (0, 1, 2) before blocking
```

**Before:** Blocked after `jiraRequeryGuardRef.current > 1` (2nd occurrence)
**After:** Blocks after `jiraRequeryGuardRef.current > 2` (3rd occurrence)

**Impact:** Allows more legitimate retries before blocking, especially useful for:
- LLM auto-retries after system notices
- Network/timeout retries
- Auth refresh scenarios

### 4. Proper State Reset
**Locations:**
- Line 793-794: Reset on new user message
- Line 1201-1202: Reset after successful auto-read execution

**Added resets for:**
```javascript
lastJiraQueryFingerprintRef.current = '';
lastJiraQueryTimeRef.current = 0;
```

**Impact:** Ensures clean state between conversation turns and after successful queries.

### 5. Conditional System Notice
**Before:** Always showed system notice on first detection
**After:** Only shows notice if counter > 0 (i.e., we've seen this exact query before)

```javascript
if (jiraRequeryGuardRef.current > 0) {
  // Show system notice and retry
}
```

**Impact:** Reduces unnecessary system notices for legitimate new queries.

## Fixed Scenarios

### ✅ Scenario 1: User Refines Question
```
User: "Show me approved leave requests"
→ Jira query executes (fingerprint A)
User: "Now show me rejected leave requests"
→ NEW query (fingerprint B) - counter resets to 0 ✅
```

### ✅ Scenario 2: Different Projects
```
User: "Check project ILT"
→ Jira query for ILT (fingerprint A)
User: "Now check project DEMO"
→ NEW query (fingerprint B) - counter resets to 0 ✅
```

### ✅ Scenario 3: LLM Auto-Retry
```
Turn 1: LLM calls Jira (counter = 0)
Turn 2: LLM tries same query (counter = 1, system notice sent)
Turn 3: LLM retries same query (counter = 2, system notice sent)
Turn 4: LLM tries again (counter = 3, NOW blocked) ✅
```

### ✅ Scenario 4: Time-Based Reset
```
User: "Show approved leaves"
→ Query executes (counter = 1)
[User waits 35 seconds]
User: "Show approved leaves again"
→ Time reset triggered, counter = 0 ✅
```

## Testing Recommendations

1. **Different Queries Test:**
   - Ask for approved leaves
   - Ask for rejected leaves
   - Verify both queries execute without blocking

2. **Same Query Test:**
   - Ask same question 4 times rapidly
   - Verify it blocks on 4th attempt (after 3 attempts)

3. **Time Reset Test:**
   - Execute query
   - Wait 35 seconds
   - Execute same query
   - Verify counter reset

4. **Mixed Queries Test:**
   - Query project A
   - Query project B
   - Query project A again
   - Verify each different query resets counter

## Configuration

All thresholds are configurable in [`lib/jiraConfig.js`](lib/jiraConfig.js):

```javascript
MAX_JIRA_REQUERY_ATTEMPTS: 2,  // Max retries for same query
JIRA_GUARD_RESET_MS: 30000,    // Time-based reset (30s)
```

## Migration Notes

- **Backward Compatible:** Existing functionality preserved
- **No Database Changes:** Only client-side state management
- **No API Changes:** No changes to Jira API integration
- **Automatic:** No user action required

## Performance Impact

- **Minimal:** Added fingerprint comparison is O(1) JSON stringify
- **Memory:** Two additional refs per session (negligible)
- **Network:** No additional API calls

## Related Files

- [`app/aime/page.js`](app/aime/page.js) - Main implementation
- [`lib/jiraConfig.js`](lib/jiraConfig.js) - Configuration constants
- [`JIRA_REQUERY_GUARD_ANALYSIS.md`](JIRA_REQUERY_GUARD_ANALYSIS.md) - Problem analysis
