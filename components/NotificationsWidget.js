'use client';

import { useState, useEffect } from 'react';
import { useMainTree } from '@/hooks/useMainTree';
import useMainTreeStore from '@/store/mainTreeStore';
import styles from './NotificationsWidget.module.css';

export default function NotificationsWidget() {
  // Load mainTree data (will use cached data if available)
  useMainTree();
  
  // Get notifications from Zustand store
  const { mainTree, isLoading } = useMainTreeStore();
  const notifications = mainTree.notifications || [];
  const loading = isLoading;

  const formatDateTime = (dateString) => {
    // SQLite CURRENT_TIMESTAMP returns UTC, so we need to parse it as UTC
    // If the string doesn't end with 'Z', append it to indicate UTC
    const utcDateString = dateString.endsWith('Z') ? dateString : dateString + 'Z';
    const date = new Date(utcDateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    return `${monthNames[date.getMonth()]} ${date.getDate()}, ${dayNames[date.getDay()]} ${date.getHours() % 12 || 12}:${date.getMinutes().toString().padStart(2, '0')}${date.getHours() >= 12 ? 'pm' : 'am'}`;
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        Loading notifications...
      </div>
    );
  }

  return (
    <div className={styles.notificationsList}>
      {notifications.length === 0 ? (
        <div className={styles.emptyState}>
          No notifications yet
        </div>
      ) : (
        notifications.map((notification) => (
          <div 
            key={notification.id} 
            className={`${styles.notificationItem} ${!notification.is_read ? styles.unread : ''}`}
          >
            <div className={styles.notificationHeader}>
              <span className={styles.notificationTitle}>
                {notification.title || 'Notification'}
              </span>
              <span className={styles.notificationTime}>
                {formatDateTime(notification.created_at)}
              </span>
            </div>
            <div className={styles.notificationMessage}>
              {notification.message}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
