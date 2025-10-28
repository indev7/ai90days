# MainTree Cache Update Implementation

## Overview
This implementation adds automatic mainTree cache updates after database mutations (Create, Update, Delete operations) to reduce database calls and improve app performance.

## Architecture

### Components

1. **Helper Library**: [`lib/mainTreeUpdater.js`](../../lib/mainTreeUpdater.js)
   - Contains utility functions for updating the Zustand store
   - Provides specialized functions for each data type (OKRTs, comments, time blocks, groups)

2. **API Response Format**: All mutation endpoints now return a `_cacheUpdate` object
   ```javascript
   {
     data: { /* normal response data */ },
     _cacheUpdate: {
       action: 'actionName',
       data: { /* update payload */ }
     }
   }
   ```

3. **Client-Side Integration**: Frontend code should check for `_cacheUpdate` and apply changes to Zustand store

## Updated API Endpoints

### OKRT Operations
- **POST** [`/api/okrt`](../../app/api/okrt/route.js:131-140) - Create OKRT
  - Action: `addMyOKRT`
  - Data: Complete OKRT object
  
- **PUT** [`/api/okrt/[id]`](../../app/api/okrt/[id]/route.js:127-134) - Update OKRT
  - Action: `updateMyOKRT`
  - Data: `{ id, updates: updatedOKRT }`
  
- **DELETE** [`/api/okrt/[id]`](../../app/api/okrt/[id]/route.js:163-170) - Delete OKRT
  - Action: `removeMyOKRT`
  - Data: `{ id }`

### Comment Operations
- **POST** [`/api/comments`](../../app/api/comments/route.js:152-162) - Create Comment
  - Action: `updateComment`
  - Data: `{ okrtId, comment }`
  
- **PUT** [`/api/comments/[id]`](../../app/api/comments/[id]/route.js:98-110) - Update Comment
  - Action: `updateComment`
  - Data: `{ okrtId, comment }`
  
- **DELETE** [`/api/comments/[id]`](../../app/api/comments/[id]/route.js:133-142) - Delete Comment
  - Action: `removeComment`
  - Data: `{ okrtId, commentId }`

### Time Block Operations
- **POST** [`/api/time-blocks`](../../app/api/time-blocks/route.js:75-85) - Create Time Block
  - Action: `addTimeBlock`
  - Data: Complete time block object
  
- **PUT** [`/api/time-blocks/[id]`](../../app/api/time-blocks/[id]/route.js:85-92) - Update Time Block
  - Action: `updateTimeBlock`
  - Data: `{ id, updates: updatedTimeBlock }`
  
- **DELETE** [`/api/time-blocks/[id]`](../../app/api/time-blocks/[id]/route.js:125-132) - Delete Time Block
  - Action: `removeTimeBlock`
  - Data: `{ id }`

### Group Operations
- **POST** [`/api/groups`](../../app/api/groups/route.js:197-210) - Create Group
  - Action: `addGroup`
  - Data: `{ ...group, is_admin: true, members }`
  
- **PUT** [`/api/groups/[id]`](../../app/api/groups/[id]/route.js:105-112) - Update Group
  - Action: `updateGroup`
  - Data: `{ id, updates: group }`
  
- **DELETE** [`/api/groups/[id]`](../../app/api/groups/[id]/route.js:150-157) - Delete Group
  - Action: `removeGroup`
  - Data: `{ id }`

### Group Member Operations
- **POST** [`/api/groups/[id]/members`](../../app/api/groups/[id]/members/route.js:59-73) - Add Member
  - Action: `updateGroupMembership`
  - Data: `{ groupId, userId, isMember: true, role }`
  
- **DELETE** [`/api/groups/[id]/members/[userId]`](../../app/api/groups/[id]/members/[userId]/route.js:70-84) - Remove Member
  - Action: `updateGroupMembership`
  - Data: `{ groupId, userId, isMember: false, role: null }`

## Helper Functions

### OKRT Functions
```javascript
updateOKRTInStore(updateMyOKRT, addMyOKRT, myOKRTs, okrtData)
removeOKRTFromStore(removeMyOKRT, okrtId)
```

### Comment Functions
```javascript
updateCommentInStore(updateMyOKRT, myOKRTs, okrtId, commentData)
removeCommentFromStore(updateMyOKRT, myOKRTs, okrtId, commentId)
```

### Time Block Functions
```javascript
updateTimeBlockInStore(updateTimeBlock, addTimeBlock, timeBlocks, timeBlockData)
removeTimeBlockFromStore(removeTimeBlock, timeBlockId)
```

### Group Functions
```javascript
updateGroupInStore(updateGroup, addGroup, groups, groupData)
removeGroupFromStore(setGroups, groups, groupId)
updateGroupMembershipInStore(updateGroup, groups, groupId, membershipData)
```

## Client-Side Usage Example

```javascript
import useMainTreeStore from '@/store/mainTreeStore';
import {
  updateOKRTInStore,
  removeOKRTFromStore,
  updateCommentInStore,
  // ... other imports
} from '@/lib/mainTreeUpdater';

function MyComponent() {
  const { 
    mainTree, 
    updateMyOKRT, 
    addMyOKRT, 
    removeMyOKRT 
  } = useMainTreeStore();

  const handleCreateOKRT = async (okrtData) => {
    const response = await fetch('/api/okrt', {
      method: 'POST',
      body: JSON.stringify(okrtData)
    });
    
    const result = await response.json();
    
    // Apply cache update if present
    if (result._cacheUpdate) {
      const { action, data } = result._cacheUpdate;
      
      switch (action) {
        case 'addMyOKRT':
          addMyOKRT(data);
          break;
        case 'updateMyOKRT':
          updateMyOKRT(data.id, data.updates);
          break;
        case 'removeMyOKRT':
          removeMyOKRT(data.id);
          break;
        // ... handle other actions
      }
    }
    
    return result;
  };
}
```

## Benefits

1. **Reduced Database Calls**: Cache is updated immediately after mutations
2. **Improved Performance**: No need to refetch entire mainTree after each operation
3. **Consistent State**: Zustand store stays in sync with database
4. **Optimistic Updates**: Can be extended to support optimistic UI updates
5. **Scalability**: Reduces server load as app grows

## Notes

- Cache updates are included in API responses but don't fail the request if not processed
- Frontend should handle `_cacheUpdate` gracefully (optional processing)
- All mutations return the updated data along with cache instructions
- The `_cacheUpdate` object is a convention and can be ignored by clients that don't use caching

## Future Enhancements

1. Add optimistic updates for better UX
2. Implement cache invalidation strategies
3. Add WebSocket support for real-time multi-user updates
4. Implement partial cache updates for large datasets
5. Add cache versioning for conflict resolution