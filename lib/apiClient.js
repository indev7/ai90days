/**
 * apiClient.js
 * Enhanced fetch wrapper that automatically processes cache updates
 * from API responses and updates the Zustand mainTree store
 */

import useMainTreeStore from '@/store/mainTreeStore';
import {
  updateCommentInStore,
  removeCommentFromStore
} from '@/lib/mainTreeUpdater';

/**
 * Enhanced fetch that automatically processes _cacheUpdate instructions
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>} - Enhanced response with processed cache updates
 */
export async function apiFetch(url, options = {}) {
  const response = await fetch(url, options);
  
  // Only process successful JSON responses
  if (response.ok) {
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const originalJson = response.json.bind(response);
      
      // Override json() method to process cache updates
      response.json = async function() {
        const data = await originalJson();
        
        // Process cache update if present
        if (data && data._cacheUpdate) {
          processCacheUpdate(data._cacheUpdate);
        }
        
        return data;
      };
    }
  }
  
  return response;
}

/**
 * Process cache update instruction and update Zustand store
 * @param {Object} cacheUpdate - Cache update instruction from API
 */
function processCacheUpdate(cacheUpdate) {
  if (!cacheUpdate || !cacheUpdate.action) {
    return;
  }

  const store = useMainTreeStore.getState();
  
  switch (cacheUpdate.action) {
    // OKRT operations
    case 'updateMyOKRT':
      if (cacheUpdate.data?.id && cacheUpdate.data?.updates) {
        store.updateMyOKRT(cacheUpdate.data.id, cacheUpdate.data.updates);
        console.log('✅ Cache updated: OKRT', cacheUpdate.data.id);
      }
      break;
      
    case 'removeMyOKRT':
      if (cacheUpdate.data?.id) {
        store.removeMyOKRT(cacheUpdate.data.id);
        console.log('✅ Cache updated: Removed OKRT', cacheUpdate.data.id);
      }
      break;

    case 'removeMyOKRTs':
      if (Array.isArray(cacheUpdate.data?.ids) && cacheUpdate.data.ids.length > 0) {
        store.removeMyOKRTs(cacheUpdate.data.ids);
        console.log('✅ Cache updated: Removed OKRTs', cacheUpdate.data.ids.length);
      }
      break;
      
    case 'addMyOKRT':
      if (cacheUpdate.data) {
        store.addMyOKRT(cacheUpdate.data);
        console.log('✅ Cache updated: Added OKRT', cacheUpdate.data.id);
      }
      break;
    
    // Time block operations
    case 'updateTimeBlock':
      if (cacheUpdate.data?.id && cacheUpdate.data?.updates) {
        store.updateTimeBlock(cacheUpdate.data.id, cacheUpdate.data.updates);
        console.log('✅ Cache updated: Time block', cacheUpdate.data.id);
      }
      break;
      
    case 'removeTimeBlock':
      if (cacheUpdate.data?.id) {
        store.removeTimeBlock(cacheUpdate.data.id);
        console.log('✅ Cache updated: Removed time block', cacheUpdate.data.id);
      }
      break;
      
    case 'addTimeBlock':
      if (cacheUpdate.data) {
        store.addTimeBlock(cacheUpdate.data);
        console.log('✅ Cache updated: Added time block', cacheUpdate.data.id);
      }
      break;
    
    // Group operations
    case 'updateGroup':
      if (cacheUpdate.data?.id && cacheUpdate.data?.updates) {
        store.updateGroup(cacheUpdate.data.id, cacheUpdate.data.updates);
        console.log('✅ Cache updated: Group', cacheUpdate.data.id);
      }
      break;
      
    case 'addGroup':
      if (cacheUpdate.data) {
        store.addGroup(cacheUpdate.data);
        console.log('✅ Cache updated: Added group', cacheUpdate.data.id);
      }
      break;
    
    // Notification operations
    case 'addNotification':
      if (cacheUpdate.data) {
        store.addNotification(cacheUpdate.data);
        console.log('✅ Cache updated: Added notification', cacheUpdate.data.id);
      }
      break;
      
    case 'markNotificationRead':
      if (cacheUpdate.data?.id) {
        store.markNotificationRead(cacheUpdate.data.id);
        console.log('✅ Cache updated: Marked notification read', cacheUpdate.data.id);
      }
      break;
    
    // Calendar operations
    case 'setCalendar':
      if (cacheUpdate.data) {
        store.setCalendar(cacheUpdate.data);
        console.log('✅ Cache updated: Calendar events', cacheUpdate.data.events?.length || 0);
      }
      break;

    case 'updateComment': {
      const { okrtId, comment } = cacheUpdate.data || {};
      if (okrtId && comment) {
        const normalizedComment = normalizeCommentForUI(comment, store.currentUserId);
        updateCommentInStore(store.updateMyOKRT, store.mainTree.myOKRTs, okrtId, normalizedComment);
        updateSharedOKRTComments(store, okrtId, (comments) =>
          mergeComment(comments, normalizedComment)
        );
        console.log('✅ Cache updated: Comment added/updated for OKRT', okrtId);
      }
      break;
    }

    case 'removeComment': {
      const { okrtId, commentId } = cacheUpdate.data || {};
      if (okrtId && commentId) {
        removeCommentFromStore(store.updateMyOKRT, store.mainTree.myOKRTs, okrtId, commentId);
        updateSharedOKRTComments(store, okrtId, (comments) =>
          comments.filter((c) => c.id !== commentId)
        );
        console.log('✅ Cache updated: Comment removed for OKRT', okrtId);
      }
      break;
    }
    
    // Refresh entire mainTree (fallback for complex operations)
    case 'refreshMainTree':
      console.log('🔄 Refreshing entire mainTree...');
      // Trigger a full reload by dispatching event
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('refreshMainTree'));
      }
      break;
      
    default:
      console.warn('⚠️ Unknown cache update action:', cacheUpdate.action);
  }
}

/**
 * Standalone function to process cache updates from response data
 * Use this when you already have the response data
 * @param {Object} data - Response data that may contain _cacheUpdate
 * @returns {Object} - Data without _cacheUpdate field
 */
export function processCacheUpdateFromData(data) {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const { _cacheUpdate, ...cleanData } = data;

  if (_cacheUpdate) {
    processCacheUpdate(_cacheUpdate);
  }

  return cleanData;
}

function mergeComment(comments = [], newComment) {
  const filtered = comments.filter((comment) => comment.id !== newComment.id);
  const merged = [...filtered, newComment];
  return merged.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
}

function updateSharedOKRTComments(store, okrtId, updater) {
  const sharedOKRTs = store.mainTree.sharedOKRTs || [];
  if (!sharedOKRTs.some((okrt) => okrt.id === okrtId)) {
    return;
  }

  const updatedSharedOKRTs = sharedOKRTs.map((okrt) => {
    if (okrt.id !== okrtId) return okrt;
    return {
      ...okrt,
      comments: updater(okrt.comments || [])
    };
  });

  store.setSharedOKRTs(updatedSharedOKRTs);
}

function normalizeCommentForUI(comment, currentUserId) {
  if (!comment) return comment;
  const senderName = comment.sender_name || (
    comment.sending_user && currentUserId && String(comment.sending_user) === String(currentUserId)
      ? 'You'
      : comment.sender_name
  );

  return {
    ...comment,
    sender_name: senderName
  };
}
