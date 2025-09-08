'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import styles from './page.module.css';

// Date formatting utility
const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const year = date.getFullYear();
  const month = months[date.getMonth()];
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function OKRTDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [user, setUser] = useState(null);
  const [okrt, setOkrt] = useState(null);
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const checkAuthAndFetchData = async () => {
      try {
        const response = await fetch('/api/me');
        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
          if (params.id) {
            fetchOkrt();
            fetchChildren();
          }
        } else {
          router.push('/login');
        }
      } catch (err) {
        console.error('Auth check failed:', err);
        router.push('/login');
      }
    };

    checkAuthAndFetchData();
  }, [router, params.id]);

  const fetchOkrt = async () => {
    try {
      const response = await fetch(`/api/okrt/${params.id}`);
      const data = await response.json();
      
      if (response.ok) {
        setOkrt(data.okrt);
      } else {
        setError(data.error || 'Failed to fetch OKRT');
      }
    } catch (err) {
      setError('Network error while fetching OKRT');
    } finally {
      setLoading(false);
    }
  };

  const fetchChildren = async () => {
    try {
      const response = await fetch('/api/okrt');
      const data = await response.json();
      
      if (response.ok) {
        // Filter children of current OKRT
        const childOkrts = data.okrts?.filter(item => item.parent_id === params.id) || [];
        setChildren(childOkrts);
      }
    } catch (err) {
      console.error('Error fetching children:', err);
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'O': return '🏆';
      case 'K': return '📍';
      case 'T': return '⛳';
      default: return '';
    }
  };

  const getTypeName = (type) => {
    switch (type) {
      case 'O': return 'Objective';
      case 'K': return 'Key Result';
      case 'T': return 'Task';
      default: return 'Unknown';
    }
  };

  const getStatusInfo = (status) => {
    const statuses = {
      'D': { label: 'Draft', className: styles.statusDraft },
      'A': { label: 'Active', className: styles.statusActive },
      'C': { label: 'Complete', className: styles.statusComplete }
    };
    return statuses[status] || { label: 'Unknown', className: '' };
  };

  const getTaskStatusInfo = (taskStatus) => {
    const statuses = {
      'todo': { label: 'To Do', className: styles.taskTodo },
      'in_progress': { label: 'In Progress', className: styles.taskInProgress },
      'done': { label: 'Done', className: styles.taskDone },
      'blocked': { label: 'Blocked', className: styles.taskBlocked }
    };
    return statuses[taskStatus];
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading OKRT details...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>Error: {error}</div>
        <Link href="/okrt" className={styles.backLink}>
          ← Back to OKRTs
        </Link>
      </div>
    );
  }

  if (!okrt) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>OKRT not found</div>
        <Link href="/okrt" className={styles.backLink}>
          ← Back to OKRTs
        </Link>
      </div>
    );
  }

  const statusInfo = getStatusInfo(okrt.status);
  const taskStatusInfo = okrt.type === 'T' ? getTaskStatusInfo(okrt.task_status) : null;

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <Link href="/okrt" className={styles.backLink}>
          ← Back to OKRTs
        </Link>
        <button className={styles.editButton}>
          Edit
        </button>
      </div>

      {/* Main Content */}
      <div className={styles.mainContent}>
        {/* OKRT Header */}
        <div className={styles.okrtHeader}>
          <div className={styles.okrtHeaderLeft}>
            <div className={styles.okrtTitleRow}>
              <span className={styles.okrtIcon}>{getIcon(okrt.type)}</span>
              <div>
                <div className={styles.typeLabel}>{getTypeName(okrt.type)}</div>
                {okrt.title && <h1 className={styles.okrtTitle}>{okrt.title}</h1>}
              </div>
            </div>
            
            {okrt.description && (
              <p className={styles.okrtDescription}>{okrt.description}</p>
            )}
          </div>

          <div className={styles.okrtHeaderRight}>
            <div className={styles.progressSection}>
              <div className={styles.progressBar}>
                <div 
                  className={styles.progressFill} 
                  style={{ width: `${okrt.progress || 0}%` }}
                ></div>
              </div>
              <span className={styles.progressText}>{okrt.progress || 0}%</span>
            </div>
            
            <div className={styles.badges}>
              <span className={`${styles.statusBadge} ${statusInfo.className}`}>
                {statusInfo.label}
              </span>
              {taskStatusInfo && (
                <span className={`${styles.taskStatusBadge} ${taskStatusInfo.className}`}>
                  {taskStatusInfo.label}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Details Grid */}
        <div className={styles.detailsGrid}>
          {/* Basic Info (Objectives only) */}
          {okrt.type === 'O' && (
            <div className={styles.detailCard}>
              <h3>Basic Information</h3>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Area:</span>
                <span className={styles.detailValue}>{okrt.area || 'Not specified'}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Cycle:</span>
                <span className={styles.detailValue}>{okrt.cycle_qtr || 'Not specified'}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Visibility:</span>
                <span className={styles.detailValue}>{okrt.visibility}</span>
              </div>
              {okrt.weight !== null && (
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Weight:</span>
                  <span className={styles.detailValue}>{okrt.weight}</span>
                </div>
              )}
            </div>
          )}

          {/* Type-specific Details */}
          {okrt.type === 'O' && okrt.objective_kind && (
            <div className={styles.detailCard}>
              <h3>Objective Details</h3>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Kind:</span>
                <span className={styles.detailValue}>
                  {okrt.objective_kind === 'committed' ? 'Committed' : 'Stretch'}
                </span>
              </div>
            </div>
          )}

          {okrt.type === 'K' && (
            <div className={styles.detailCard}>
              <h3>Key Result Details</h3>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Target:</span>
                <span className={styles.detailValue}>
                  {okrt.kr_target_number} {okrt.kr_unit}
                </span>
              </div>
            </div>
          )}

          {okrt.type === 'T' && (
            <div className={styles.detailCard}>
              <h3>Task Details</h3>
              {okrt.due_date && (
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Due Date:</span>
                  <span className={styles.detailValue}>{formatDate(okrt.due_date)}</span>
                </div>
              )}
              {okrt.blocked_by && (
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Blocked By:</span>
                  <span className={styles.detailValue}>Task #{okrt.blocked_by}</span>
                </div>
              )}
            </div>
          )}

          {/* Timestamps */}
          <div className={styles.detailCard}>
            <h3>Timeline</h3>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Created:</span>
              <span className={styles.detailValue}>
                {formatDate(okrt.created_at)}
              </span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Updated:</span>
              <span className={styles.detailValue}>
                {formatDate(okrt.updated_at)}
              </span>
            </div>
          </div>
        </div>

        {/* Children */}
        {children.length > 0 && (
          <div className={styles.childrenSection}>
            <h2>
              {okrt.type === 'O' ? 'Key Results & Tasks' : 
               okrt.type === 'K' ? 'Tasks' : 'Sub-tasks'}
            </h2>
            <div className={styles.childrenList}>
              {children.map(child => (
                <div key={child.id} className={styles.childItem}>
                  <Link href={`/okrt/${child.id}`} className={styles.childLink}>
                    <span className={styles.childIcon}>{getIcon(child.type)}</span>
                    <div className={styles.childContent}>
                      <div className={styles.childTitle}>
                        {child.title || child.description}
                      </div>
                      <div className={styles.childMeta}>
                        {getTypeName(child.type)} • {child.progress || 0}% complete
                      </div>
                    </div>
                    <div className={styles.childProgress}>
                      <div className={styles.childProgressBar}>
                        <div 
                          className={styles.childProgressFill}
                          style={{ width: `${child.progress || 0}%` }}
                        ></div>
                      </div>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
