'use client';

import { useState, useEffect } from 'react';
import { DataView } from 'primereact/dataview';
import { Button } from 'primereact/button';
import { Badge } from 'primereact/badge';
import { Skeleton } from 'primereact/skeleton';
import { Toast } from 'primereact/toast';
import { useRef } from 'react';
import { formatNotificationTime } from '@/lib/dateUtils';
import styles from './page.module.css';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const toast = useRef(null);

  useEffect(() => {
    fetchNotifications();
    setupSSE();
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/notifications');
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
        const unread = data.notifications?.filter(n => !n.is_read).length || 0;
        setUnreadCount(unread);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      toast.current?.show({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to load notifications'
      });
    } finally {
      setLoading(false);
    }
  };

  const setupSSE = () => {
    const eventSource = new EventSource('/api/notifications/sse');
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'notification') {
          setNotifications(prev => [data.notification, ...prev]);
          setUnreadCount(prev => prev + 1);
          toast.current?.show({
            severity: 'info',
            summary: 'New Notification',
            detail: data.notification.title
          });
        } else if (data.type === 'unread_count') {
          setUnreadCount(data.count);
        }
      } catch (error) {
        console.error('Error parsing SSE data:', error);
      }
    };

    return () => eventSource.close();
  };

  const markAsRead = async (notificationId) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_read' })
      });

      if (response.ok) {
        setNotifications(prev => 
          prev.map(n => 
            n.id === notificationId ? { ...n, is_read: true } : n
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_all_read' })
      });

      if (response.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);
        toast.current?.show({
          severity: 'success',
          summary: 'Success',
          detail: 'All notifications marked as read'
        });
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
        toast.current?.show({
          severity: 'success',
          summary: 'Deleted',
          detail: 'Notification deleted'
        });
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const getNotificationIcon = (type) => {
    const iconMap = {
      comment: 'pi pi-comment',
      reply: 'pi pi-reply',
      mention: 'pi pi-at',
      group_added: 'pi pi-users',
      okrt_shared: 'pi pi-share-alt',
      ownership_changed: 'pi pi-user-edit',
      progress_update: 'pi pi-chart-line',
      task_due: 'pi pi-clock',
      kr_due: 'pi pi-exclamation-triangle',
      weekly_review_due: 'pi pi-calendar',
      weekly_review_missed: 'pi pi-times-circle',
      quarter_start: 'pi pi-flag',
      mid_cycle_checkpoint: 'pi pi-check-circle',
      quarter_ending: 'pi pi-flag-fill',
      visibility_changed: 'pi pi-eye'
    };
    return iconMap[type] || 'pi pi-bell';
  };

  const getNotificationSeverity = (type) => {
    const severityMap = {
      task_due: 'warning',
      kr_due: 'danger',
      weekly_review_missed: 'danger',
      quarter_ending: 'warning',
      comment: 'info',
      reply: 'info',
      mention: 'success'
    };
    return severityMap[type] || 'info';
  };

  const itemTemplate = (notification) => {
    return (
      <div className={`${styles.notificationItem} ${!notification.is_read ? styles.unread : ''}`}>
        <div className={styles.notificationIcon}>
          <i className={getNotificationIcon(notification.type)}></i>
        </div>
        <div className={styles.notificationContent}>
          <div className={styles.notificationHeader}>
            <h4 className={styles.notificationTitle}>{notification.title}</h4>
            <div className={styles.notificationMeta}>
              <span className={styles.notificationTime}>
                {formatNotificationTime(notification.created_at)}
              </span>
              {!notification.is_read && (
                <Badge value="New" severity="info" className={styles.newBadge} />
              )}
            </div>
          </div>
          <p className={styles.notificationMessage}>{notification.message}</p>
          <div className={styles.notificationActions}>
            {!notification.is_read && (
              <Button
                label="Mark as Read"
                icon="pi pi-check"
                size="small"
                text
                onClick={() => markAsRead(notification.id)}
              />
            )}
            <Button
              label="Delete"
              icon="pi pi-trash"
              size="small"
              text
              severity="danger"
              onClick={() => deleteNotification(notification.id)}
            />
          </div>
        </div>
      </div>
    );
  };

  const header = (
    <div className={styles.notificationsHeader}>
      <div className={styles.headerTitle}>
        <h1>Notifications</h1>
        {unreadCount > 0 && (
          <Badge value={unreadCount} severity="info" />
        )}
      </div>
      {unreadCount > 0 && (
        <Button
          label="Mark All as Read"
          icon="pi pi-check-circle"
          onClick={markAllAsRead}
          size="small"
        />
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="app-page">
        <div className="app-pageContent">
          <div className={styles.notificationsContainer}>
            <div className={styles.notificationsHeader}>
              <Skeleton width="200px" height="2rem" />
            </div>
            <div className={styles.notificationsList}>
              {[...Array(5)].map((_, i) => (
                <div key={i} className={styles.notificationItem}>
                  <Skeleton shape="circle" size="3rem" />
                  <div className={styles.notificationContent}>
                    <Skeleton width="100%" height="1.5rem" className="mb-2" />
                    <Skeleton width="80%" height="1rem" className="mb-2" />
                    <Skeleton width="60%" height="1rem" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-page">
      <div className="app-pageContent">
        <div className={styles.notificationsContainer}>
          <Toast ref={toast} />
          
          {notifications.length === 0 ? (
            <div className={styles.emptyState}>
              <i className="pi pi-bell" style={{ fontSize: '4rem', color: 'var(--muted)' }}></i>
              <h2>No notifications yet</h2>
              <p>When you have notifications, they'll appear here.</p>
            </div>
          ) : (
            <DataView
              value={notifications}
              itemTemplate={itemTemplate}
              header={header}
              paginator
              rows={10}
              className={styles.notificationsDataView}
            />
          )}
        </div>
      </div>
    </div>
  );
}
