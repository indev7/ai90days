import { createNotification } from './db';
import { broadcastToUser, broadcastUnreadCount } from '../app/api/notifications/sse/route';

/**
 * Create and broadcast a notification to a user
 * @param {Object} notificationData - The notification data
 * @param {number} notificationData.user_id - The user ID to send notification to
 * @param {string} notificationData.type - The notification type
 * @param {string} notificationData.title - The notification title
 * @param {string} notificationData.message - The notification message
 * @param {string} [notificationData.related_okrt_id] - Related OKRT ID
 * @param {string} [notificationData.related_group_id] - Related group ID
 * @param {number} [notificationData.related_user_id] - Related user ID
 */
export async function sendNotification(notificationData) {
  try {
    // Create notification in database
    const notification = await createNotification(notificationData);
    
    // Broadcast to user via SSE
    broadcastToUser(notificationData.user_id, notification);
    
    // Update unread count
    const { getUnreadNotificationCount } = await import('./db');
    const unreadCount = await getUnreadNotificationCount(notificationData.user_id);
    broadcastUnreadCount(notificationData.user_id, unreadCount);
    
    return notification;
  } catch (error) {
    console.error('Error sending notification:', error);
    throw error;
  }
}

/**
 * Send notification when a comment is added to an OKRT
 */
export async function notifyComment(okrtOwnerId, commenterName, okrtTitle, okrtId) {
  return sendNotification({
    user_id: okrtOwnerId,
    type: 'comment',
    title: 'New comment on your goal',
    message: `${commenterName} commented on "${okrtTitle}"`,
    related_okrt_id: okrtId
  });
}

/**
 * Send notification when someone replies to a comment
 */
export async function notifyReply(originalCommenterId, replierName, okrtTitle, okrtId) {
  return sendNotification({
    user_id: originalCommenterId,
    type: 'reply',
    title: 'Reply to your comment',
    message: `${replierName} replied to your comment on "${okrtTitle}"`,
    related_okrt_id: okrtId
  });
}

/**
 * Send notification when someone is mentioned in a comment
 */
export async function notifyMention(mentionedUserId, mentionerName, okrtTitle, okrtId) {
  return sendNotification({
    user_id: mentionedUserId,
    type: 'mention',
    title: 'You were mentioned',
    message: `${mentionerName} mentioned you in a comment on "${okrtTitle}"`,
    related_okrt_id: okrtId
  });
}

/**
 * Send notification when user is added to a group
 */
export async function notifyGroupAdded(userId, groupName, groupId, addedByName) {
  return sendNotification({
    user_id: userId,
    type: 'group_added',
    title: 'Added to group',
    message: `${addedByName} added you to the group "${groupName}"`,
    related_group_id: groupId
  });
}

/**
 * Send notification when an OKRT is shared to a group
 */
export async function notifyOKRTShared(userIds, sharerName, okrtTitle, okrtId, groupName) {
  const notifications = userIds.map(userId => 
    sendNotification({
      user_id: userId,
      type: 'okrt_shared',
      title: 'Goal shared with your group',
      message: `${sharerName} shared "${okrtTitle}" with ${groupName}`,
      related_okrt_id: okrtId
    })
  );
  
  return Promise.all(notifications);
}

/**
 * Send notification when ownership of an OKRT changes
 */
export async function notifyOwnershipChanged(newOwnerId, previousOwnerName, okrtTitle, okrtId) {
  return sendNotification({
    user_id: newOwnerId,
    type: 'ownership_changed',
    title: 'You are now owner of a goal',
    message: `${previousOwnerName} transferred ownership of "${okrtTitle}" to you`,
    related_okrt_id: okrtId
  });
}

/**
 * Send notification when progress is updated on a followed OKRT
 */
export async function notifyProgressUpdate(followerIds, ownerName, okrtTitle, okrtId, newProgress) {
  const notifications = followerIds.map(userId => 
    sendNotification({
      user_id: userId,
      type: 'progress_update',
      title: 'Progress update on followed goal',
      message: `${ownerName} updated progress on "${okrtTitle}" to ${newProgress}%`,
      related_okrt_id: okrtId
    })
  );
  
  return Promise.all(notifications);
}

/**
 * Send notification when a task is due today
 */
export async function notifyTaskDue(userId, taskTitle, taskId) {
  return sendNotification({
    user_id: userId,
    type: 'task_due',
    title: 'Task due today',
    message: `Your task "${taskTitle}" is due today`,
    related_okrt_id: taskId
  });
}

/**
 * Send notification when a KR is due
 */
export async function notifyKRDue(userId, krTitle, krId) {
  return sendNotification({
    user_id: userId,
    type: 'kr_due',
    title: 'Key Result due',
    message: `Your Key Result "${krTitle}" is due soon`,
    related_okrt_id: krId
  });
}

/**
 * Send notification for weekly review reminder
 */
export async function notifyWeeklyReviewDue(userId) {
  return sendNotification({
    user_id: userId,
    type: 'weekly_review_due',
    title: 'Weekly review due',
    message: 'Time for your weekly goal review and check-in'
  });
}

/**
 * Send notification when weekly review is missed
 */
export async function notifyWeeklyReviewMissed(userId) {
  return sendNotification({
    user_id: userId,
    type: 'weekly_review_missed',
    title: 'Weekly review missed',
    message: 'You missed your weekly review. Consider doing a quick check-in on your goals.'
  });
}

/**
 * Send notification for new quarter start
 */
export async function notifyQuarterStart(userId, quarter) {
  return sendNotification({
    user_id: userId,
    type: 'quarter_start',
    title: 'New quarter started',
    message: `${quarter} has begun! Time to set your quarterly objectives.`
  });
}

/**
 * Send notification for mid-cycle checkpoint
 */
export async function notifyMidCycleCheckpoint(userId) {
  return sendNotification({
    user_id: userId,
    type: 'mid_cycle_checkpoint',
    title: 'Mid-cycle checkpoint',
    message: 'You\'re halfway through the quarter. How are your goals progressing?'
  });
}

/**
 * Send notification when quarter is ending soon
 */
export async function notifyQuarterEnding(userId, quarter) {
  return sendNotification({
    user_id: userId,
    type: 'quarter_ending',
    title: 'Quarter ending soon',
    message: `${quarter} is ending soon. Time to wrap up your objectives and plan for next quarter.`
  });
}

/**
 * Send notification when visibility of an item changes
 */
export async function notifyVisibilityChanged(affectedUserIds, ownerName, okrtTitle, okrtId, oldVisibility, newVisibility) {
  const notifications = affectedUserIds.map(userId => 
    sendNotification({
      user_id: userId,
      type: 'visibility_changed',
      title: 'Goal visibility changed',
      message: `${ownerName} changed "${okrtTitle}" from ${oldVisibility} to ${newVisibility}`,
      related_okrt_id: okrtId
    })
  );
  
  return Promise.all(notifications);
}