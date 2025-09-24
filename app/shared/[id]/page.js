'use client';

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from '../../okrt/page.module.css'; // Reuse the same styles
import { GoTrophy } from "react-icons/go";
import { GrTrophy } from 'react-icons/gr';
import { GiGolfFlag } from "react-icons/gi";
import { LiaGolfBallSolid } from "react-icons/lia";
import { LuExpand } from "react-icons/lu";
import { BiCollapse } from "react-icons/bi";
import CommentsSection from '../../../components/CommentsSection';
import RewardsDisplay from '../../../components/RewardsDisplay';

/* =========================
   Reused Utility Components from OKRT page
   ========================= */

const Chip = ({ text, variant = "default" }) => (
  <span className={`${styles.chip} ${styles[`chip--${variant}`]}`}>
    {text}
  </span>
);

function ProgressRing({ value = 0, size = 40, stroke = 6, color = "var(--brand-primary)" }) {
  const v = Math.max(0, Math.min(1, value ?? 0));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - v) + 0.0001;

  return (
    <div className={styles.progressRing}>
      <svg width={size} height={size} className={styles.progressSvg}>
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle
            stroke="var(--border-light)"
            strokeOpacity="0.3"
            fill="transparent"
            strokeWidth={stroke}
            r={radius}
            cx={size / 2}
            cy={size / 2}
          />
          <circle
            stroke={color}
            fill="transparent"
            strokeLinecap="round"
            strokeWidth={stroke}
            r={radius}
            cx={size / 2}
            cy={size / 2}
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={offset}
            className={styles.progressCircle}
          />
        </g>
        <text
          x="50%"
          y="50%"
          dominantBaseline="central"
          textAnchor="middle"
          className={styles.progressText}
        >
          {Math.round(v * 100)}%
        </text>
      </svg>
    </div>
  );
}

function ProgressBar({ value }) {
  return (
    <div className={styles.progressBar}>
      <div
        className={styles.progressBarFill}
        style={{ width: `${Math.min(100, Math.max(0, Math.round((value || 0) * 100)))}%` }}
      />
    </div>
  );
}

/* =========================
   Reused Components from OKRT page (modified for shared view)
   ========================= */

function ObjectiveHeader({ objective, isExpanded, onToggleExpanded, onFocusObjective, isFocused }) {
  const getStatusVariant = (status) => {
    switch (status) {
      case 'A': return 'active';
      case 'C': return 'complete';
      case 'D': return 'draft';
      default: return 'default';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'A': return 'in progress';
      case 'C': return 'Complete';
      case 'D': return 'Draft';
      default: return 'Unknown';
    }
  };

  return (
    <div className={`${styles.objectiveHeader} ${!isExpanded ? styles.collapsed : ''}`}>
      <div className={styles.objectiveMainContent}>
        <div className={styles.objectiveInfo}>
          <div className={styles.objectiveIcon}>
            <GrTrophy size={20} />
          </div>
          <div>
            <h1 className={styles.objectiveTitle} style={{ cursor: 'default' }}>
              {objective.title}
            </h1>
            <div className={styles.objectiveMeta}>
              <div className={styles.chipGroup} title={`Quarter: ${objective.cycle_qtr}`}>
                <Chip text={objective.cycle_qtr} variant="default" />
              </div>
              <div className={styles.chipGroup} title={`Area: ${objective.area || "Personal"}`}>
                <Chip text={objective.area || "Personal"} variant="area" />
              </div>
              <div className={styles.chipGroup} title={`Status: ${getStatusLabel(objective.status)}`}>
                <Chip text={getStatusLabel(objective.status)} variant={getStatusVariant(objective.status)} />
              </div>
              <div className={styles.chipGroup} title={`Visibility: ${objective.visibility === 'shared' ? 'Shared' : 'Private'}`}>
                <Chip text={objective.visibility === 'shared' ? 'Shared' : 'Private'} variant={objective.visibility === 'shared' ? 'shared' : 'private'} />
              </div>
              {objective.owner_name && (
                <div className={styles.chipGroup} title={`Owner: ${objective.owner_name}`}>
                  <Chip text={objective.owner_name} variant="owner" />
                </div>
              )}
              {objective.shared_groups && objective.shared_groups.length > 0 && objective.shared_groups
                .filter(group => group && group.name)
                .map((group) => (
                  <div key={group.id} className={styles.chipGroup} title={`Shared with group: ${group.name}`}>
                    <Chip text={group.name} variant="group" />
                  </div>
                ))}
            </div>
          </div>
        </div>
        <div className={styles.objectiveActions}>
          <div className={styles.progressSection}>
            <div className={styles.progressItem}>
              <ProgressRing value={(objective.confidence || 30) / 100} size={64} color="var(--brand-secondary)" />
              <div className={styles.progressLabel}>confidence</div>
            </div>
            <div className={styles.progressItem}>
              <ProgressRing value={objective.progress / 100} size={64} color="var(--brand-primary)" />
              <div className={styles.progressLabel}>progress</div>
            </div>
          </div>
          <div className={styles.objectiveRightSection}>
            <div className={styles.objectiveButtons}>
              {/* Show Focus button but hide Share button for shared view */}
              <button
                className={`${styles.focusButton} ${isFocused ? styles.focusButtonActive : ''}`}
                onClick={() => onFocusObjective(objective.id)}
              >
                {isFocused ? <BiCollapse size={16} /> : <LuExpand size={16} />}
              </button>
      
              <button
                className={styles.objectiveToggleButton}
                onClick={onToggleExpanded}
                aria-label={isExpanded ? 'Collapse objective' : 'Expand objective'}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className={`${styles.objectiveChevron} ${isExpanded ? styles.objectiveChevronExpanded : ''}`}
                >
                  <polyline points="6,9 12,15 18,9"/>
                </svg>
              </button>
            </div>
            <div className={styles.objectiveRewards}>
              <RewardsDisplay okrtId={objective.id} />
            </div>
          </div>
        </div>
      </div>
      {isExpanded && objective.description && (
        <div className={styles.objectiveDescriptionContainer}>
          <p className={styles.objectiveDescription}>{objective.description}</p>
        </div>
      )}
    </div>
  );
}

function KeyResultCard({ kr, tasks = [], forceExpanded = false }) {
  const [expanded, setExpanded] = useState(false);
  const atRisk = kr.progress < 35;

  // Update expanded state when forceExpanded prop changes
  useEffect(() => {
    if (forceExpanded !== undefined) {
      setExpanded(forceExpanded);
    }
  }, [forceExpanded]);
  
  const formatDate = (dateStr) => {
    if (!dateStr) return 'No due date';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const handleExpandClick = (e) => {
    e.stopPropagation();
    setExpanded(!expanded);
  };

  return (
    <div className={`${styles.keyResultCard} ${atRisk ? styles.atRisk : ''}`}>
      <div className={styles.cardHeader}>
        <div className={styles.cardIcon}>
          <GiGolfFlag size={20} />
        </div>
        <div className={styles.cardContent}>
          <div className={styles.cardTitle} style={{ cursor: 'default' }}>
            {kr.description}
          </div>
          <div className={styles.cardProgress}>
            <ProgressBar value={kr.progress / 100} />
          </div>
          <div className={styles.cardMeta}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <span>{formatDate(kr.due_date)}</span>
            <span>•</span>
            <span>in progress</span>
            {atRisk && (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.warningIcon}>
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <span className={styles.atRiskText}>at-risk</span>
              </>
            )}
          </div>
        </div>
        {tasks.length > 0 && (
          <button
            className={styles.expandButton}
            onClick={handleExpandClick}
            aria-label={expanded ? 'Collapse tasks' : 'Expand tasks'}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={`${styles.chevron} ${expanded ? styles.chevronExpanded : ''}`}
            >
              <polyline points="9,18 15,12 9,6"/>
            </svg>
          </button>
        )}
      </div>
      
      {expanded && tasks.length > 0 && (
        <div className={styles.tasksList}>
          <div className={styles.tasksHeader}>TASKS</div>
          {tasks.map((task) => (
            <div key={task.id} className={styles.taskItem}>
              <div className={styles.taskIcon}>
                <LiaGolfBallSolid size={20} />
              </div>
              <div className={styles.taskContent}>
                <span
                  className={`${styles.taskText} ${task.task_status === 'done' ? styles.taskTextCompleted : ''}`}
                  style={{ cursor: 'default' }}
                >
                  {task.description || task.title}
                </span>
                <div className={styles.taskMeta}>
                  {task.due_date && (
                    <span>Due: {formatDate(task.due_date)}</span>
                  )}
                  {task.due_date && task.task_status && <span>•</span>}
                  {task.task_status && (
                    <span>{task.task_status.replace('_', ' ')}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* =========================
   Main Shared Detail Page Component
   ========================= */

export default function SharedOKRTDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [objective, setObjective] = useState(null);
  const [keyResults, setKeyResults] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [focusedObjectiveId, setFocusedObjectiveId] = useState(null);
  const [krExpansionState, setKrExpansionState] = useState({});
  const [commentsExpanded, setCommentsExpanded] = useState(false);

  // Fetch user data
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch('/api/me');
        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
        }
      } catch (error) {
        console.error('Error fetching user:', error);
      }
    };

    fetchUser();
  }, []);

  // Fetch shared OKRT data
  useEffect(() => {
    const fetchSharedOKRT = async () => {
      if (!params.id) return;

      try {
        const response = await fetch(`/api/okrt/shared?id=${params.id}`);
        const data = await response.json();
        
        if (response.ok) {
          const allItems = data.okrts || [];
          const obj = allItems.find(item => item.type === 'O' && item.id === params.id);
          const krs = allItems.filter(item => item.type === 'K' && item.parent_id === params.id);
          const tsks = allItems.filter(item => item.type === 'T');
          
          if (obj) {
            setObjective(obj);
            setKeyResults(krs);
            setTasks(tsks);
          } else {
            setError('Shared objective not found');
          }
        } else {
          setError(data.error || 'Failed to fetch shared objective');
        }
      } catch (error) {
        console.error('Error fetching shared OKRT:', error);
        setError('Network error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchSharedOKRT();
  }, [params.id]);

  // Listen for left menu toggle events to collapse OKRTs when menu expands
  useEffect(() => {
    const handleMenuToggle = () => {
      // Collapse the objective
      setIsExpanded(false);
      // Collapse all expanded KRs
      setKrExpansionState({});
      // Collapse comments
      setCommentsExpanded(false);
      // Exit focus mode if active
      setFocusedObjectiveId(null);
    };

    // Listen for both hamburger menu and desktop menu toggle events
    window.addEventListener('menuToggleToExpanded', handleMenuToggle);
    
    return () => {
      window.removeEventListener('menuToggleToExpanded', handleMenuToggle);
    };
  }, []);

  // Group tasks by their parent key result
  const getTasksForKeyResult = (krId) => {
    return tasks.filter(task => task.parent_id === krId);
  };

  const handleFocusObjective = (objectiveId) => {
    if (focusedObjectiveId === objectiveId) {
      // Exit focus mode
      setFocusedObjectiveId(null);
      // Collapse the objective itself (hide KRs and Comments)
      setIsExpanded(false);
      // Collapse all KRs for this objective
      setKrExpansionState({});
      // Collapse comments
      setCommentsExpanded(false);
      // Dispatch event to expand left menu
      window.dispatchEvent(new CustomEvent('exitFocusMode'));
      // Also dispatch the menu toggle event to ensure consistency
      window.dispatchEvent(new CustomEvent('menuToggleToExpanded'));
    } else {
      // Enter focus mode
      setFocusedObjectiveId(objectiveId);
      // Ensure the focused objective is expanded
      setIsExpanded(true);
      // Expand all KRs for this objective
      const newState = {};
      keyResults.forEach(kr => {
        newState[kr.id] = true;
      });
      setKrExpansionState(newState);
      // Expand comments
      setCommentsExpanded(true);
      // Dispatch event to minimize left menu
      window.dispatchEvent(new CustomEvent('enterFocusMode'));
    }
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div>Loading shared objective...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.empty}>
        <div>
          <div className={styles.emptyTitle}>Error</div>
          <div className={styles.emptyText}>{error}</div>
          <Link href="/shared" className={styles.backLink}>
            ← Back to Shared Goals
          </Link>
        </div>
      </div>
    );
  }

  if (!objective) {
    return (
      <div className={styles.empty}>
        <div>
          <div className={styles.emptyTitle}>Objective not found</div>
          <div className={styles.emptyText}>The shared objective you're looking for doesn't exist.</div>
          <Link href="/shared" className={styles.backLink}>
            ← Back to Shared Goals
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header with back link */}
      <div className={styles.header}>
        <Link href="/shared" className={styles.backLink}>
          ← Back to Shared Goals
        </Link>
      </div>

      {/* Main Content */}
      <main className={styles.main}>
        <div className={`${styles.objectiveSection} ${focusedObjectiveId === objective.id ? styles.focusedObjective : ''}`}>
          <ObjectiveHeader
            objective={objective}
            isExpanded={isExpanded}
            onToggleExpanded={() => setIsExpanded(!isExpanded)}
            onFocusObjective={handleFocusObjective}
            isFocused={focusedObjectiveId === objective.id}
          />

          {/* Key Results Grid - only show when expanded */}
          {isExpanded && (
            <>
              <div className={styles.keyResultsGrid}>
                {keyResults.map((kr) => (
                  <KeyResultCard
                    key={kr.id}
                    kr={kr}
                    tasks={getTasksForKeyResult(kr.id)}
                    forceExpanded={krExpansionState[kr.id]}
                  />
                ))}
              </div>
              
              {/* Comments Section */}
              {user?.id && (
                <div className={styles.objectiveCommentsSection}>
                  <CommentsSection
                    okrtId={objective.id}
                    currentUserId={user.id}
                    okrtOwnerId={objective.owner_id}
                    isExpanded={commentsExpanded}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}