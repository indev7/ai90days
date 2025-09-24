'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Share2, Focus } from 'lucide-react';
import ShareModal from '@/components/ShareModal';
import CommentsSection from '@/components/CommentsSection';
import styles from './page.module.css';

export default function OKRTDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [user, setUser] = useState(null);
  const [okrt, setOkrt] = useState(null);
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [childrenExpanded, setChildrenExpanded] = useState({});

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

  const toggleFocusMode = () => {
    const newFocusMode = !isFocusMode;
    setIsFocusMode(newFocusMode);
    
    if (newFocusMode) {
      // Expand all children when entering focus mode
      const expandedState = {};
      children.forEach(child => {
        expandedState[child.id] = true;
      });
      setChildrenExpanded(expandedState);
    } else {
      // Collapse all children when exiting focus mode
      setChildrenExpanded({});
    }
  };

  const toggleChildExpanded = (childId) => {
    setChildrenExpanded(prev => ({
      ...prev,
      [childId]: !prev[childId]
    }));
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
        <div className={styles.headerActions}>
          <button
            className={`${styles.focusButton} ${isFocusMode ? styles.focusButtonActive : ''}`}
            onClick={toggleFocusMode}
            title={isFocusMode ? "Exit focus mode" : "Enter focus mode"}
          >
            <Focus className={styles.focusIcon} />
            {isFocusMode ? 'Exit Focus' : 'Focus'}
          </button>
          {user && okrt && user.id.toString() === okrt.owner_id && (
            <button
              className={styles.shareButton}
              onClick={() => setShowShareModal(true)}
              title="Share this objective"
            >
              <Share2 className={styles.shareIcon} />
              Share
            </button>
          )}
          <button className={styles.editButton}>
            Edit
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className={`${styles.mainContent} ${isFocusMode ? styles.focusMode : ''}`}>
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
          {/* Basic Info */}
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
              {okrt.kr_baseline_number !== null && (
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Baseline:</span>
                  <span className={styles.detailValue}>
                    {okrt.kr_baseline_number} {okrt.kr_unit}
                  </span>
                </div>
              )}
            </div>
          )}

          {okrt.type === 'T' && (
            <div className={styles.detailCard}>
              <h3>Task Details</h3>
              {okrt.due_date && (
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Due Date:</span>
                  <span className={styles.detailValue}>{okrt.due_date}</span>
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
                {new Date(okrt.created_at).toLocaleDateString()}
              </span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Updated:</span>
              <span className={styles.detailValue}>
                {new Date(okrt.updated_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        {/* Children */}
        {children.length > 0 && (
          <div className={styles.childrenSection}>
            <div className={styles.childrenHeader}>
              <h2>
                {okrt.type === 'O' ? 'Key Results & Tasks' :
                 okrt.type === 'K' ? 'Tasks' : 'Sub-tasks'}
              </h2>
            </div>
            <div className={styles.childrenList}>
              {children.map(child => (
                <div key={child.id} className={styles.childItem}>
                  <div className={styles.childHeader}>
                    <button
                      className={styles.childExpandButton}
                      onClick={(e) => {
                        e.preventDefault();
                        toggleChildExpanded(child.id);
                      }}
                      aria-label={childrenExpanded[child.id] ? 'Collapse' : 'Expand'}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className={`${styles.childChevron} ${childrenExpanded[child.id] ? styles.childChevronExpanded : ''}`}
                      >
                        <polyline points="9,18 15,12 9,6"></polyline>
                      </svg>
                    </button>
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
                  {childrenExpanded[child.id] && (
                    <div className={styles.childDetails}>
                      <p className={styles.childDescription}>
                        {child.description || 'No additional details available.'}
                      </p>
                      {child.type === 'K' && (
                        <div className={styles.childKrDetails}>
                          <span>Target: {child.kr_target_number} {child.kr_unit}</span>
                          {child.kr_baseline_number && (
                            <span>Baseline: {child.kr_baseline_number} {child.kr_unit}</span>
                          )}
                        </div>
                      )}
                      {child.type === 'T' && child.due_date && (
                        <div className={styles.childTaskDetails}>
                          <span>Due: {child.due_date}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Comments Section */}
        {user && okrt && (
          <CommentsSection
            okrtId={params.id}
            currentUserId={user.id}
            okrtOwnerId={okrt.owner_id}
            isExpanded={isFocusMode}
          />
        )}
      </div>

      {/* Share Modal */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        okrtId={params.id}
        currentVisibility={okrt?.visibility}
      />
    </div>
  );
}
