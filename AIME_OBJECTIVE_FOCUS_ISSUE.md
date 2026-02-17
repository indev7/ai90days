# AIME Objective Focus Issue Analysis

## Problem Summary
AIME is unable to fetch detailed information about objectives when the user provides a "user-supplied" objective context. The system keeps requesting `objectiveFocus` with the same `objectiveId`, but returns only minimal data (counts) instead of the full detailed context (actual children, key results, tasks, etc.).

## Root Cause

### The Issue
Looking at the log entries from `llm_api_req_res.txt` (timestamp: 2026-02-17T08:34:58.347Z):

1. **User provides minimal context**: The user sends a "CONTEXT - Objective Focus (user-supplied)" block with only:
   - Basic objective data
   - **Counts only**: `childObjectives: 6, initiatives: 0, keyResults: 3, tasks: 0`
   - No actual children data

2. **AIME requests more info**: AIME correctly calls `req_more_info` with:
   ```json
   {
     "data": {
       "sections": [{
         "sectionId": "objectiveFocus",
         "objectiveId": "434d07d0-b16c-4222-99a0-b551e988d07b"
       }]
     }
   }
   ```

3. **System prompt contradiction**: The system prompt tells AIME:
   > "The user may also include a block labeled 'CONTEXT - Objective Focus (user-supplied)' with <DATA:objective_focus> JSON. If present, treat it as authoritative for that objective and avoid req_more_info for overlapping fields."

4. **The conflict**: AIME is told to treat user-supplied context as "authoritative" and avoid requesting more info, but the user-supplied context only contains **counts**, not the actual **detailed data** (children objectives, key results, tasks).

## Code Analysis

### Two Different Context Builders

In [`lib/aime/contextBuilders.js`](lib/aime/contextBuilders.js:235):

1. **`buildObjectiveContextBlock`** (lines 235-305): Returns FULL detailed context
   - objective
   - ancestors
   - **childObjectives** (full array)
   - **keyResults** (full array)
   - **tasks** (full array)
   - initiatives
   - sharedGroups

2. **`buildObjectiveMinimalContextBlock`** (lines 307-350): Returns MINIMAL context
   - objective
   - **counts only**: `{ childObjectives: 6, initiatives: 0, keyResults: 3, tasks: 0 }`

### Where User-Supplied Context Comes From

In [`app/aime/page.js`](app/aime/page.js:59):
```javascript
const formatObjectiveContextDraft = (context) => {
  if (!context) return '';
  const payload = { objectiveFocus: context };
  return [
    'CONTEXT - Objective Focus (user-supplied)',
    `<DATA:objective_focus>\n${JSON.stringify(payload)}\n</DATA:objective_focus>`
  ].join('\n');
};
```

The user-supplied context appears to be using the **minimal** version (with counts only), but AIME needs the **full detailed** version to answer questions about children.

### Where req_more_info Response is Built

In [`app/aime/page.js`](app/aime/page.js:262):
```javascript
const rawData =
  entry.sectionId === 'memberDirectory'
    ? buildMemberDirectory(mainTree)
    : entry.sectionId === 'objectiveFocus'
      ? buildObjectiveContextBlock(mainTree, entry.objectiveId)  // ✅ Uses FULL version
      : (mainTree || {})[entry.sectionId];
```

When AIME requests `objectiveFocus` via `req_more_info`, it correctly calls `buildObjectiveContextBlock` (the full version).

## The Problem

The issue is **NOT a semantic mismatch** - the code is actually correct! The real problem is:

1. User-supplied context uses **minimal** data (counts only) - this is intentional for initial context
2. AIME correctly recognizes it needs more data and calls `req_more_info` with `objectiveFocus` + `objectiveId`
3. Client-side code (line 263 in `app/aime/page.js`) correctly calls `buildObjectiveContextBlock(mainTree, entry.objectiveId)` to get **full detailed** data
4. **BUT**: The `buildObjectiveContextBlock` function requires the `mainTree` to contain all the OKRTs (myOKRTs + sharedOKRTs) to build the children, key results, and tasks arrays
5. **Root Cause**: If `mainTree` is not fully populated with the necessary OKRTs, `buildObjectiveContextBlock` will return `null` or incomplete data, and AIME won't get the children information it needs

## Actual Root Cause

After analyzing the latest log entry (2026-02-17T08:45:46.909Z), AIME is working correctly:

1. ✅ AIME recognizes it only has counts, not actual children
2. ✅ AIME correctly calls `req_more_info` with `objectiveFocus` + `objectiveId`
3. ✅ Client-side code calls `buildObjectiveContextBlock(mainTree, entry.objectiveId)` to fetch full data

**The real issue**: The `buildObjectiveContextBlock` function (lines 235-305 in `contextBuilders.js`) needs the `mainTree` to contain:
- `myOKRTs`: User's own OKRTs
- `sharedOKRTs`: Shared OKRTs the user can view

If the `mainTree` passed to `buildSystemPromptPayload` doesn't have these sections populated, `buildObjectiveContextBlock` will return `null` or incomplete data because it can't find the child objectives.

## Solution

**Ensure `mainTree` is fully loaded before AIME requests `objectiveFocus`**:

1. Check where `mainTree` is passed to the `sendMessage` function in the AIME page
2. Verify that `mainTree` includes both `myOKRTs` and `sharedOKRTs` arrays
3. If `mainTree` is not loaded, the app should load it before allowing AIME to request objective focus data

### Debug Steps

1. Add console logging in `buildObjectiveContextBlock` to see what data it receives:
   ```javascript
   console.log('buildObjectiveContextBlock called:', {
     objectiveId,
     myOKRTsCount: myOKRTs.length,
     sharedOKRTsCount: sharedOKRTs.length,
     foundObjective: !!objective
   });
   ```

2. Check if the objective with the given ID exists in either `myOKRTs` or `sharedOKRTs`

3. If the objective is found but children are not, check if the child objectives exist in the combined `allOKRTs` array

### Alternative: Request myOKRTs/sharedOKRTs Instead

If `mainTree` is not available, AIME should request `myOKRTs` or `sharedOKRTs` sections instead of `objectiveFocus`:
- This would populate the mainTree with all OKRTs
- Then `buildObjectiveContextBlock` would have the data it needs to build the full context
