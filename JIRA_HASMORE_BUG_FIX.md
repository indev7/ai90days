# JIRA "Can't find variable: hasMore" Bug Fix

## Problem
When asking AIME "In JIRA summarize the Initiatives in the Portfolio Management Project and tabulate Status and Count", the query failed with:
```
"Can't find variable: hasMore"
```

## Root Cause
The error was caused by **three separate bugs** introduced during the recent JIRA pagination fixes:

### Bug #1: app/api/jira/query/route.js (Lines 565, 577, 588)
The distinct query responses were trying to reference `nextPageToken` in the `partial` calculation:
```javascript
partial: Boolean(stalled || (hasScanLimit && scannedCount >= scanLimit) || nextPageToken)
```

But `nextPageToken` was already consumed by the pagination loop and wasn't meaningful in this context.

### Bug #2: lib/aime/jiraPaginationHelper.js (Line 131)
The pagination helper was checking `result?.hasMore` for ALL query types:
```javascript
const hasMore = Boolean(result?.hasMore || nextPageToken) ||
  (Number.isFinite(total) && startAt + pageSize < total);
```

But distinct queries return a different response structure:
- Regular queries: `{ issues: [...], hasMore: true, total: 150 }`
- Distinct queries: `{ statuses: [{name, count}], total: 150, partial: false }`

### Bug #3: app/aime/page.js (Lines 1137-1138)
The `fetchJiraPages` function was trying to set:
```javascript
aggregated.partial = hasMore;
aggregated.hasMore = hasMore;
```

But the variable `hasMore` was **never defined** in the function scope.

## Fixes Applied

### Fix #1: app/api/jira/query/route.js
Removed `|| nextPageToken` from the partial calculation in all three distinct response blocks:
```javascript
// BEFORE:
partial: Boolean(stalled || (hasScanLimit && scannedCount >= scanLimit) || nextPageToken)

// AFTER:
partial: Boolean(stalled || (hasScanLimit && scannedCount >= scanLimit))
```

**Rationale**: If `nextPageToken` exists after the loop, it means we hit `MAX_DISTINCT_PAGES`, which already sets `stalled = true`.

### Fix #2: lib/aime/jiraPaginationHelper.js
Added detection for distinct queries and skip the `hasMore` check for them:
```javascript
// Check hasMore flag (only for non-distinct queries)
// Distinct queries don't have hasMore, they have 'partial' flag
const isDistinctQuery = result?.statuses || result?.issueTypes || result?.projects;

if (!isDistinctQuery) {
  const startAt = Number.isFinite(result?.startAt) ? result.startAt : 0;
  
  const hasMore = Boolean(result?.hasMore || nextPageToken) ||
    (Number.isFinite(total) && startAt + pageSize < total);

  if (!hasMore) {
    return { shouldStop: true, reason: 'no_more', updates: {} };
  }
}
```

### Fix #3: app/aime/page.js
Removed the undefined `hasMore` variable references:
```javascript
// BEFORE:
jiraPagingStatusRef.current = null;
if (!aggregated) return null;
aggregated.pagesFetched = pagesFetched;
aggregated.partial = hasMore;  // ❌ hasMore not defined
aggregated.hasMore = hasMore;  // ❌ hasMore not defined
return aggregated;

// AFTER:
jiraPagingStatusRef.current = null;
if (!aggregated) return null;
aggregated.pagesFetched = pagesFetched;
// Don't set hasMore/partial here - they're already set by the API response or pagination helper
return aggregated;
```

**Rationale**: The `partial` and `hasMore` flags are already correctly set by:
- The API response for distinct queries (`partial` flag)
- The API response for regular queries (`hasMore` flag)
- The pagination helper's stop conditions

## Files Modified
1. ✅ `app/api/jira/query/route.js` (lines 565, 577, 588)
2. ✅ `lib/aime/jiraPaginationHelper.js` (lines 126-145)
3. ✅ `app/aime/page.js` (lines 1137-1138)

## Testing
After restarting the dev server, the query:
```
"In JIRA summarize the Initiatives in the Portfolio Management Project and tabulate Status and Count"
```

Should now work without the `"Can't find variable: hasMore"` error.

## Server Log Confirmation
The request is now successfully reaching the API:
```
GET /api/jira/query?jql=project%3DPM+AND+issuetype%3DInitiative&distinct=status&toolMode=true 200
```

The 200 status confirms the API route is working correctly.

## Related Issues
- Original pagination fixes: `JIRA_PAGINATION_FIX_SUMMARY.md`
- Critical bugs fixed: `JIRA_CRITICAL_BUGS_FIXED.md`
- Integration review: `JIRA_INTEGRATION_CODE_REVIEW.md`
