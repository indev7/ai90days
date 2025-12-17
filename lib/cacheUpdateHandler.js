/**
 * cacheUpdateHandler.js
 * Utility to process _cacheUpdate instructions from API responses
 * and update the Zustand mainTree store accordingly
 */

import useMainTreeStore from '@/store/mainTreeStore';
import {
  updateCommentInStore,
  removeCommentFromStore
} from '@/lib/mainTreeUpdater';

/**
 * Process cache update instruction from API response
 * @param {Object} response - API response object
 * @returns {Object} - The response data without _cacheUpdate
 */
export function processCacheUpdate(response) {
  if (!response || typeof response !== 'object') {
    return response;
  }

  const { _cacheUpdate, ...data } = response;

  if (_cacheUpdate && _cacheUpdate.action) {
    const store = useMainTreeStore.getState();
    
    switch (_cacheUpdate.action) {
      case 'updateMyOKRT':
        if (_cacheUpdate.data?.id && _cacheUpdate.data?.updates) {
          store.updateMyOKRT(_cacheUpdate.data.id, _cacheUpdate.data.updates);
          console.log('Cache updated: OKRT', _cacheUpdate.data.id);
        }
        break;
        
      case 'removeMyOKRT':
        if (_cacheUpdate.data?.id) {
          store.removeMyOKRT(_cacheUpdate.data.id);
          console.log('Cache updated: Removed OKRT', _cacheUpdate.data.id);
        }
        break;
        
      case 'addMyOKRT':
        if (_cacheUpdate.data) {
          store.addMyOKRT(_cacheUpdate.data);
          console.log('Cache updated: Added OKRT', _cacheUpdate.data.id);
        }
        break;
        
      case 'updateTimeBlock':
        if (_cacheUpdate.data?.id && _cacheUpdate.data?.updates) {
          store.updateTimeBlock(_cacheUpdate.data.id, _cacheUpdate.data.updates);
          console.log('Cache updated: Time block', _cacheUpdate.data.id);
        }
        break;
        
      case 'removeTimeBlock':
        if (_cacheUpdate.data?.id) {
          store.removeTimeBlock(_cacheUpdate.data.id);
          console.log('Cache updated: Removed time block', _cacheUpdate.data.id);
        }
        break;
        
      case 'addTimeBlock':
        if (_cacheUpdate.data) {
          store.addTimeBlock(_cacheUpdate.data);
          console.log('Cache updated: Added time block', _cacheUpdate.data.id);
        }
        break;
        
      case 'updateGroup':
        if (_cacheUpdate.data?.id && _cacheUpdate.data?.updates) {
          store.updateGroup(_cacheUpdate.data.id, _cacheUpdate.data.updates);
          console.log('Cache updated: Group', _cacheUpdate.data.id);
        }
        break;
        
      case 'addGroup':
        if (_cacheUpdate.data) {
          store.addGroup(_cacheUpdate.data);
          console.log('Cache updated: Added group', _cacheUpdate.data.id);
        }
        break;
        
      case 'removeGroup':
        if (_cacheUpdate.data?.id) {
          const currentGroups = store.mainTree.groups;
          store.setGroups(currentGroups.filter(g => g.id !== _cacheUpdate.data.id));
          console.log('Cache updated: Removed group', _cacheUpdate.data.id);
        }
        break;
        
      case 'addNotification':
        if (_cacheUpdate.data) {
          store.addNotification(_cacheUpdate.data);
          console.log('Cache updated: Added notification', _cacheUpdate.data.id);
        }
        break;
        
      case 'markNotificationRead':
        if (_cacheUpdate.data?.id) {
          store.markNotificationRead(_cacheUpdate.data.id);
          console.log('Cache updated: Marked notification read', _cacheUpdate.data.id);
        }
        break;
        
      case 'setCalendar':
        if (_cacheUpdate.data) {
          store.setCalendar(_cacheUpdate.data);
          console.log('Cache updated: Calendar events', _cacheUpdate.data.events?.length || 0);
        }
        break;

      case 'updateComment': {
        const { okrtId, comment } = _cacheUpdate.data || {};
        if (okrtId && comment) {
          const normalizedComment = normalizeCommentForUI(comment, store.currentUserId);
          updateCommentInStore(store.updateMyOKRT, store.mainTree.myOKRTs, okrtId, normalizedComment);
          updateSharedOKRTComments(store, okrtId, (comments) =>
            mergeComment(comments, normalizedComment)
          );
          console.log('Cache updated: Comment added/updated for OKRT', okrtId);
        }
        break;
      }

      case 'removeComment': {
        const { okrtId, commentId } = _cacheUpdate.data || {};
        if (okrtId && commentId) {
          removeCommentFromStore(store.updateMyOKRT, store.mainTree.myOKRTs, okrtId, commentId);
          updateSharedOKRTComments(store, okrtId, (comments) =>
            comments.filter((c) => c.id !== commentId)
          );
          console.log('Cache updated: Comment removed for OKRT', okrtId);
        }
        break;
      }
      
      default:
        console.warn('Unknown cache update action:', _cacheUpdate.action);
    }
  }

  return data;
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
