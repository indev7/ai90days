# Cache Update Implementation Guide

## The Problem
When you update an objective title or delete a time block, the LeftMenu doesn't update immediately because the mainTree cache isn't being updated.

## The Solution
Use `apiFetch` instead of `fetch` for ALL API calls. It automatically processes `_cacheUpdate` instructions from API responses.

## How It Works

### Current Flow (BROKEN ❌)
```javascript
// Component makes API call
const response = await fetch('/api/okrt/123', {
  method: 'PUT',
  body: JSON.stringify({ title: 'New Title' })
});

const data = await response.json();
// data contains: { okrt: {...}, _cacheUpdate: { action: 'updateMyOKRT', data: {...} } }
// BUT _cacheUpdate is IGNORED!
// mainTree stays stale
// LeftMenu shows old data
```

### New Flow (FIXED ✅)
```javascript
import { apiFetch } from '@/lib/apiClient';

// Component makes API call
const response = await apiFetch('/api/okrt/123', {
  method: 'PUT',
  body: JSON.stringify({ title: 'New Title' })
});

const data = await response.json();
// apiFetch automatically:
// 1. Detects _cacheUpdate in response
// 2. Calls store.updateMyOKRT(id, updates)
// 3. mainTree updates
// 4. LeftMenu's useEffect triggers
// 5. LeftMenu re-renders with new data
```

## Implementation Steps

### Step 1: Replace `fetch` with `apiFetch`

**Before:**
```javascript
const response = await fetch('/api/okrt/123', { method: 'PUT', ... });
```

**After:**
```javascript
import { apiFetch } from '@/lib/apiClient';
const response = await apiFetch('/api/okrt/123', { method: 'PUT', ... });
```

### Step 2: That's it!

No other changes needed. The cache updates automatically.

## Files That Need Updates

Search for all `fetch('/api/` calls and replace with `apiFetch`:

1. **OKRTModal** - When saving/deleting objectives
2. **TaskUpdateModal** - When updating tasks  
3. **Calendar components** - When creating/deleting time blocks
4. **Any component** that calls:
   - `/api/okrt/*` (POST, PUT, DELETE)
   - `/api/time-blocks/*` (POST, PUT, DELETE)
   - `/api/groups/*` (POST, PUT, DELETE)
   - `/api/comments/*` (POST, PUT, DELETE)

## Why This Works

1. **APIs already return `_cacheUpdate`** - No API changes needed
2. **LeftMenu already watches mainTree** - No LeftMenu changes needed
3. **apiFetch processes updates automatically** - Just replace fetch calls

## Example: Updating Objective Title

```javascript
// In OKRTModal or wherever objectives are edited
import { apiFetch } from '@/lib/apiClient';

const handleSave = async (okrtData) => {
  const response = await apiFetch(`/api/okrt/${okrtId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(okrtData)
  });
  
  if (response.ok) {
    const data = await response.json();
    // Cache is already updated!
    // LeftMenu already refreshed!
    // Close modal
    onClose();
  }
};
```

## Example: Deleting Time Block

```javascript
import { apiFetch } from '@/lib/apiClient';

const handleDeleteTimeBlock = async (timeBlockId) => {
  const response = await apiFetch(`/api/time-blocks/${timeBlockId}`, {
    method: 'DELETE'
  });
  
  if (response.ok) {
    // Cache is already updated!
    // LeftMenu's Schedule section already refreshed!
  }
};
```

## No Additional API Calls

The beauty of this solution:
- ✅ Only ONE API call (the mutation itself)
- ✅ NO separate refresh/reload calls
- ✅ NO `fetchData()` or `refreshMainTree()` needed
- ✅ Automatic, instant UI updates

## Testing

After implementing:
1. Update objective title → LeftMenu shows new title immediately
2. Delete time block → LeftMenu removes it from Schedule immediately
3. Create new objective → LeftMenu shows it in My OKRs immediately
4. All without any additional API calls!