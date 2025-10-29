import { useState, useEffect } from 'react';
import { GiGolfFlag } from "react-icons/gi";
import { LiaGolfBallSolid } from "react-icons/lia";
import ProgressBar from './ProgressBar';
import styles from '../../app/okrt/page.module.css';

export default function KeyResultCard({ 
  kr, 
  selected, 
  onOpen, 
  onEditKR, 
  onEditTask, 
  onAddTask, 
  tasks = [], 
  forceExpanded = false,
  readOnly = false 
}) {
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

  const handleCardClick = (e) => {
    // Only open modal if not clicking on expand button or KR title, and not in readOnly mode
    if (!readOnly && onOpen && !e.target.closest(`.${styles.expandButton}`) && !e.target.closest(`.${styles.cardTitle}`)) {
      onOpen(kr);
    }
  };

  const handleExpandClick = (e) => {
    e.stopPropagation();
    setExpanded(!expanded);
  };

  const handleKRTitleClick = (e) => {
    e.stopPropagation();
    if (!readOnly && onEditKR) {
      onEditKR(kr);
    }
  };

  const handleTaskClick = (e, task) => {
    e.stopPropagation();
    if (!readOnly && onEditTask) {
      onEditTask(task);
    }
  };

  return (
    <div className={`${styles.keyResultCard} ${selected ? styles.selected : ''} ${atRisk ? styles.atRisk : ''}`}>
      <div className={styles.cardHeader} onClick={handleCardClick}>
        <div className={styles.cardIcon}>
          <GiGolfFlag size={20} />
        </div>
        <div className={styles.cardContent}>
          <div
            className={styles.cardTitle}
            onClick={handleKRTitleClick}
            style={readOnly ? { cursor: 'default' } : undefined}
          >
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
            {tasks.length === 0 && !readOnly && onAddTask && (
              <button
                className={styles.addTaskButtonInline}
                onClick={(e) => {
                  e.stopPropagation();
                  onAddTask(kr);
                }}
              >
                + Add task
              </button>
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
            <div key={task.id} className={`${styles.taskItem} ${task.task_status === 'done' ? styles.taskItemCompleted : ''}`}>
              <div className={styles.taskIcon}>
                <LiaGolfBallSolid size={20} />
              </div>
              <div className={styles.taskContent}>
                <span
                  className={styles.taskText}
                  onClick={(e) => handleTaskClick(e, task)}
                  style={readOnly ? { cursor: 'default' } : undefined}
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
          {!readOnly && onAddTask && (
            <button className={styles.addTaskButton} onClick={(e) => {
              e.stopPropagation();
              onAddTask(kr);
            }}>
              + Add task
            </button>
          )}
        </div>
      )}
    </div>
  );
}