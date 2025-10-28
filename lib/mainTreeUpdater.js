/**
 * mainTreeUpdater.js
 * Helper utilities to update mainTree Zustand store after database mutations
 * Handles OKRT records, comments, time blocks, and groups
 */

/**
 * Update or add an OKRT record in myOKRTs
 * @param {Function} updateMyOKRT - Zustand store update function
 * @param {Function} addMyOKRT - Zustand store add function
 * @param {Array} myOKRTs - Current myOKRTs array
 * @param {Object} okrtData - OKRT data from database
 */
export function updateOKRTInStore(updateMyOKRT, addMyOKRT, myOKRTs, okrtData) {
  const existingIndex = myOKRTs.findIndex(okrt => okrt.id === okrtData.id);
  
  if (existingIndex >= 0) {
    // Update existing OKRT
    updateMyOKRT(okrtData.id, okrtData);
  } else {
    // Add new OKRT
    addMyOKRT(okrtData);
  }
}

/**
 * Remove an OKRT record from myOKRTs
 * @param {Function} removeMyOKRT - Zustand store remove function
 * @param {string} okrtId - OKRT ID to remove
 */
export function removeOKRTFromStore(removeMyOKRT, okrtId) {
  removeMyOKRT(okrtId);
}

/**
 * Update or add a comment in an OKRT within myOKRTs
 * @param {Function} updateMyOKRT - Zustand store update function
 * @param {Array} myOKRTs - Current myOKRTs array
 * @param {string} okrtId - OKRT ID
 * @param {Object} commentData - Comment data from database
 */
export function updateCommentInStore(updateMyOKRT, myOKRTs, okrtId, commentData) {
  const okrt = myOKRTs.find(o => o.id === okrtId);
  
  if (okrt) {
    const comments = okrt.comments || [];
    const commentIndex = comments.findIndex(c => c.id === commentData.id);
    
    let updatedComments;
    if (commentIndex >= 0) {
      // Update existing comment
      updatedComments = comments.map(c => 
        c.id === commentData.id ? commentData : c
      );
    } else {
      // Add new comment
      updatedComments = [...comments, commentData];
    }
    
    updateMyOKRT(okrtId, { comments: updatedComments });
  }
}

/**
 * Remove a comment from an OKRT within myOKRTs
 * @param {Function} updateMyOKRT - Zustand store update function
 * @param {Array} myOKRTs - Current myOKRTs array
 * @param {string} okrtId - OKRT ID
 * @param {number} commentId - Comment ID to remove
 */
export function removeCommentFromStore(updateMyOKRT, myOKRTs, okrtId, commentId) {
  const okrt = myOKRTs.find(o => o.id === okrtId);
  
  if (okrt && okrt.comments) {
    const updatedComments = okrt.comments.filter(c => c.id !== commentId);
    updateMyOKRT(okrtId, { comments: updatedComments });
  }
}

/**
 * Update or add a time block
 * @param {Function} updateTimeBlock - Zustand store update function
 * @param {Function} addTimeBlock - Zustand store add function
 * @param {Array} timeBlocks - Current timeBlocks array
 * @param {Object} timeBlockData - Time block data from database
 */
export function updateTimeBlockInStore(updateTimeBlock, addTimeBlock, timeBlocks, timeBlockData) {
  const existingIndex = timeBlocks.findIndex(tb => tb.id === timeBlockData.id);
  
  if (existingIndex >= 0) {
    // Update existing time block
    updateTimeBlock(timeBlockData.id, timeBlockData);
  } else {
    // Add new time block
    addTimeBlock(timeBlockData);
  }
}

/**
 * Remove a time block
 * @param {Function} removeTimeBlock - Zustand store remove function
 * @param {number} timeBlockId - Time block ID to remove
 */
export function removeTimeBlockFromStore(removeTimeBlock, timeBlockId) {
  removeTimeBlock(timeBlockId);
}

/**
 * Update or add a group
 * @param {Function} updateGroup - Zustand store update function
 * @param {Function} addGroup - Zustand store add function
 * @param {Array} groups - Current groups array
 * @param {Object} groupData - Group data from database
 */
export function updateGroupInStore(updateGroup, addGroup, groups, groupData) {
  const existingIndex = groups.findIndex(g => g.id === groupData.id);
  
  if (existingIndex >= 0) {
    // Update existing group
    updateGroup(groupData.id, groupData);
  } else {
    // Add new group
    addGroup(groupData);
  }
}

/**
 * Remove a group
 * @param {Function} setGroups - Zustand store setGroups function
 * @param {Array} groups - Current groups array
 * @param {string} groupId - Group ID to remove
 */
export function removeGroupFromStore(setGroups, groups, groupId) {
  const updatedGroups = groups.filter(g => g.id !== groupId);
  setGroups(updatedGroups);
}

/**
 * Update group membership information
 * @param {Function} updateGroup - Zustand store update function
 * @param {Array} groups - Current groups array
 * @param {string} groupId - Group ID
 * @param {Object} membershipData - Membership data (is_member, role, member_count)
 */
export function updateGroupMembershipInStore(updateGroup, groups, groupId, membershipData) {
  const group = groups.find(g => g.id === groupId);
  
  if (group) {
    updateGroup(groupId, membershipData);
  }
}