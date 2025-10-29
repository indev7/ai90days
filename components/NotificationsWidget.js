'use client';

import { useState, useEffect } from 'react';
import { useMainTree } from '@/hooks/useMainTree';
import useMainTreeStore from '@/store/mainTreeStore';
import { formatDateTime } from '@/lib/dateUtils';
import styles from './NotificationsWidget.module.css';

export default function NotificationsWidget() {
  // Load mainTree data (will use cached data if available)
  useMainTree();
  
  // Get notifications from Zustand store
  const { mainTree, isLoading } = useMainTreeStore();
  const notifications = mainTree.notifications || [];
  const loading = isLoading;

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
