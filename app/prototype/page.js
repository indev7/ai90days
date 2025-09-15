'use client';

import React, { useMemo, useState, useEffect } from "react";
import styles from './page.module.css';
import { GoTrophy } from "react-icons/go";
import { GiGolfFlag } from "react-icons/gi";
import { LiaGolfBallSolid } from "react-icons/lia";
import OKRTModal from '../../components/OKRTModal';

/* =========================
   Utility Components
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
   Main Components
   ========================= */

function ObjectiveHeader({ objective, onEditObjective, isExpanded, onToggleExpanded }) {
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
            <GoTrophy size={20} />
          </div>
          <div>
            <h1
              className={styles.objectiveTitle}
              onClick={() => onEditObjective(objective)}
            >
              {objective.title}
            </h1>
            <div className={styles.objectiveMeta}>
              <div className={styles.chipGroup} title={`Quarter: ${objective.cycle_qtr}`}>
                <Chip text={objective.cycle_qtr} variant="default" />
              </div>
              <div className={styles.chipGroup} title={`Area: ${objective.area || "Personal"}`}>
                <Chip text={objective.area || "Personal"} variant="area" />
              </div>
              <div className={styles.chipGroup} title="Visibility: Team">
                <Chip text="Team" variant="team" />
              </div>
              <div className={styles.chipGroup} title={`Status: ${getStatusLabel(objective.status)}`}>
                <Chip text={getStatusLabel(objective.status)} variant={getStatusVariant(objective.status)} />
              </div>
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
          <button className={styles.shareButton}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
              <polyline points="16,6 12,2 8,6"/>
              <line x1="12" y1="2" x2="12" y2="15"/>
            </svg>
            Share)
          </button>
          <button className={styles.focusButton}>Focus</button>
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
      </div>
      {isExpanded && objective.description && (
        <div className={styles.objectiveDescriptionContainer}>
          <p className={styles.objectiveDescription}>{objective.description}</p>
        </div>
      )}
    </div>
  );
}

function KeyResultCard({ kr, selected, onOpen, onEditKR, onEditTask, onAddTask, tasks = [] }) {
  const [expanded, setExpanded] = useState(false);
  const atRisk = kr.progress < 35;
  
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
    // Only open modal if not clicking on expand button or KR title
    if (!e.target.closest(`.${styles.expandButton}`) && !e.target.closest(`.${styles.cardTitle}`)) {
      onOpen(kr);
    }
  };

  const handleExpandClick = (e) => {
    e.stopPropagation();
    setExpanded(!expanded);
  };

  const handleKRTitleClick = (e) => {
    e.stopPropagation();
    onEditKR(kr);
  };

  const handleTaskClick = (e, task) => {
    e.stopPropagation();
    onEditTask(task);
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
                  onClick={(e) => handleTaskClick(e, task)}
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
          <button className={styles.addTaskButton} onClick={(e) => {
            e.stopPropagation();
            onAddTask(kr);
          }}>
            + Add task
          </button>
        </div>
      )}
    </div>
  );
}

function AddKeyResultCard({ onAddKeyResult }) {
  return (
    <button className={styles.addKeyResultCard} onClick={onAddKeyResult}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="12" y1="5" x2="12" y2="19"/>
        <line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
      Add Key Result
    </button>
  );
}

/* =========================
   Demo Data (fallback)
   ========================= */

const demoData = {
  objectives: [
    {
      id: "demo-obj-1",
      title: "Start My AI-first App Development Journey",
      description: "Build foundational knowledge and practical experience in AI/ML development by creating a working application and completing structured learning. This objective focuses on hands-on learning through building, experimenting, and documenting the development process.",
      type: "O",
      cycle_qtr: "2025-Q3",
      visibility: "team",
      status: "A",
      progress: 30,
      area: "Work"
    }
  ],
  keyResults: [
    {
      id: "demo-kr-1",
      parent_id: "demo-obj-1",
      type: "K",
      description: "Brainstorm simple app ideas (chatbot, recommendation tool, etc.)",
      progress: 90,
      due_date: "2025-09-30"
    },
    {
      id: "demo-kr-2",
      parent_id: "demo-obj-1",
      type: "K",
      description: "Build a basic AI-powered app and share a demo or code online",
      progress: 30,
      due_date: "2025-10-10"
    },
    {
      id: "demo-kr-3",
      parent_id: "demo-obj-1",
      type: "K",
      description: "Complete an Intro course on AI/ML (Coursera/Udemy) and notes",
      progress: 0,
      due_date: "2025-10-25"
    }
  ]
};

/* =========================
   Main Page Component
   ========================= */

export default function PrototypePage() {
  const [objectives, setObjectives] = useState([]);
  const [keyResults, setKeyResults] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openKR, setOpenKR] = useState(null);
  const [expandedObjectives, setExpandedObjectives] = useState(new Set());
  const [modalState, setModalState] = useState({
    isOpen: false,
    mode: 'create',
    okrt: null,
    parentOkrt: null
  });

  // Fetch OKRT data using the same pattern as the working OKRT page
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/okrt');
        const data = await response.json();
        
        if (response.ok) {
          console.log('API Response:', data); // Debug log
          const allItems = data.okrts || [];
          const objs = allItems.filter(item => item.type === 'O');
          const krs = allItems.filter(item => item.type === 'K');
          const tsks = allItems.filter(item => item.type === 'T');
          
          setObjectives(objs);
          setKeyResults(krs);
          setTasks(tsks);
        } else {
          console.error('API Error:', data.error || 'Failed to fetch OKRTs');
        }
      } catch (error) {
        console.error('Error fetching OKRT data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Listen for create objective events from LeftMenu
  useEffect(() => {
    const handleCreateObjectiveEvent = () => {
      handleCreateObjective();
    };

    window.addEventListener('createObjective', handleCreateObjectiveEvent);
    
    return () => {
      window.removeEventListener('createObjective', handleCreateObjectiveEvent);
    };
  }, []);

  // Initialize all objectives as expanded when data loads
  useEffect(() => {
    if (objectives.length > 0) {
      setExpandedObjectives(new Set(objectives.map(obj => obj.id)));
    }
  }, [objectives]);

  // Group key results by their parent objective
  const getKeyResultsForObjective = (objId) => {
    return keyResults.filter(kr => kr.parent_id === objId);
  };

  // Group tasks by their parent key result
  const getTasksForKeyResult = (krId) => {
    return tasks.filter(task => task.parent_id === krId);
  };

  // Modal handlers
  const handleEditObjective = (objective) => {
    setModalState({
      isOpen: true,
      mode: 'edit',
      okrt: objective,
      parentOkrt: null
    });
  };

  const handleEditKR = (kr) => {
    setModalState({
      isOpen: true,
      mode: 'edit',
      okrt: kr,
      parentOkrt: null
    });
  };

  const handleEditTask = (task) => {
    setModalState({
      isOpen: true,
      mode: 'edit',
      okrt: task,
      parentOkrt: null
    });
  };

  const handleAddKeyResult = (objective) => {
    setModalState({
      isOpen: true,
      mode: 'create',
      okrt: null,
      parentOkrt: objective
    });
  };

  const handleAddTask = (keyResult) => {
    setModalState({
      isOpen: true,
      mode: 'create',
      okrt: null,
      parentOkrt: keyResult
    });
  };

  const handleCreateObjective = () => {
    setModalState({
      isOpen: true,
      mode: 'create',
      okrt: null,
      parentOkrt: null
    });
  };

  const handleCloseModal = () => {
    setModalState({
      isOpen: false,
      mode: 'create',
      okrt: null,
      parentOkrt: null
    });
  };

  const handleSaveOkrt = async (okrtData) => {
    try {
      const url = modalState.mode === 'edit'
        ? `/api/okrt/${modalState.okrt.id}`
        : '/api/okrt';
      
      const method = modalState.mode === 'edit' ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(okrtData),
      });

      if (!response.ok) {
        throw new Error('Failed to save OKRT');
      }

      // Refresh data after successful save
      const fetchResponse = await fetch('/api/okrt');
      const data = await fetchResponse.json();
      
      if (fetchResponse.ok) {
        const allItems = data.okrts || [];
        const objs = allItems.filter(item => item.type === 'O');
        const krs = allItems.filter(item => item.type === 'K');
        const tsks = allItems.filter(item => item.type === 'T');
        
        setObjectives(objs);
        setKeyResults(krs);
        setTasks(tsks);
      }
    } catch (error) {
      console.error('Error saving OKRT:', error);
      throw error;
    }
  };

  const handleToggleObjective = (objectiveId) => {
    setExpandedObjectives(prev => {
      const newSet = new Set(prev);
      if (newSet.has(objectiveId)) {
        newSet.delete(objectiveId);
      } else {
        newSet.add(objectiveId);
      }
      return newSet;
    });
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div>Loading OKRT data...</div>
      </div>
    );
  }

  if (objectives.length === 0) {
    return (
      <div className={styles.empty}>
        <div>
          <div className={styles.emptyTitle}>No objectives found</div>
          <div className={styles.emptyText}>Create your first objective to get started.</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Main Content */}
      <main className={styles.main}>
        {/* Stack all objectives vertically */}
        {objectives.map((objective) => {
          const objectiveKRs = getKeyResultsForObjective(objective.id);
          
          return (
            <div key={objective.id} className={styles.objectiveSection}>
              <ObjectiveHeader
                objective={objective}
                onEditObjective={handleEditObjective}
                isExpanded={expandedObjectives.has(objective.id)}
                onToggleExpanded={() => handleToggleObjective(objective.id)}
              />

              {/* Key Results Grid for this objective - only show when expanded */}
              {expandedObjectives.has(objective.id) && (
                <div className={styles.keyResultsGrid}>
                  {objectiveKRs.map((kr) => (
                    <KeyResultCard
                      key={kr.id}
                      kr={kr}
                      selected={openKR?.id === kr.id}
                      onOpen={setOpenKR}
                      onEditKR={handleEditKR}
                      onEditTask={handleEditTask}
                      onAddTask={handleAddTask}
                      tasks={getTasksForKeyResult(kr.id)}
                    />
                  ))}
                  <AddKeyResultCard onAddKeyResult={() => handleAddKeyResult(objective)} />
                </div>
              )}
            </div>
          );
        })}
      </main>

      {/* OKRT Modal */}
      <OKRTModal
        isOpen={modalState.isOpen}
        onClose={handleCloseModal}
        onSave={handleSaveOkrt}
        okrt={modalState.okrt}
        parentOkrt={modalState.parentOkrt}
        mode={modalState.mode}
      />
    </div>
  );
}
