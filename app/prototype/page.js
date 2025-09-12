'use client';

import React, { useMemo, useState, useEffect } from "react";
import styles from './page.module.css';
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

function ObjectiveHeader({ objective, onEdit }) {
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
    <div className={styles.objectiveHeader}>
      <div className={styles.objectiveMainContent}>
        <div className={styles.objectiveInfo}>
          <div className={styles.objectiveIcon}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
              <line x1="4" y1="22" x2="4" y2="15"/>
            </svg>
          </div>
          <div>
            <h1 className={styles.objectiveTitle}>{objective.title}</h1>
            <div className={styles.objectiveMeta}>
              <div className={styles.chipGroup}>
                <div className={styles.chipLabel}>Quarter</div>
                <Chip text={objective.cycle_qtr} variant="default" />
              </div>
              <div className={styles.chipGroup}>
                <div className={styles.chipLabel}>Area</div>
                <Chip text={objective.area || "Personal"} variant="area" />
              </div>
              <div className={styles.chipGroup}>
                <div className={styles.chipLabel}>Visibility</div>
                <Chip text="Team" variant="team" />
              </div>
              <div className={styles.chipGroup}>
                <div className={styles.chipLabel}>Status</div>
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
            Share (read-only)
          </button>
          <button 
            className={styles.editButton}
            onClick={() => onEdit(objective)}
          >
            Edit
          </button>
        </div>
      </div>
      {objective.description && (
        <div className={styles.objectiveDescriptionContainer}>
          <p className={styles.objectiveDescription}>{objective.description}</p>
        </div>
      )}
    </div>
  );
}

function TaskList({ tasks, onEdit }) {
  const getTaskStatus = (taskStatus) => {
    const statuses = {
      'todo': { label: 'To Do', className: styles.taskTodo },
      'in_progress': { label: 'In Progress', className: styles.taskInProgress },
      'done': { label: 'Done', className: styles.taskDone },
      'blocked': { label: 'Blocked', className: styles.taskBlocked }
    };
    return statuses[taskStatus] || null;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  if (!tasks || tasks.length === 0) {
    return (
      <div className={styles.emptyTasks}>
        <p>No tasks yet</p>
      </div>
    );
  }

  return (
    <div className={styles.taskList}>
      {tasks.map((task) => {
        const taskStatus = getTaskStatus(task.task_status);
        return (
          <button
            key={task.id}
            className={styles.taskItem}
            onClick={() => onEdit(task)}
          >
            <div className={styles.taskIcon}>⛳</div>
            <div className={styles.taskContent}>
              <div className={styles.taskTitle}>{task.description}</div>
              <div className={styles.taskMeta}>
                {taskStatus && (
                  <span className={`${styles.taskStatusBadge} ${taskStatus.className}`}>
                    {taskStatus.label}
                  </span>
                )}
                {task.due_date && (
                  <span className={styles.taskDueDate}>
                    Due: {formatDate(task.due_date)}
                  </span>
                )}
                {task.progress && (
                  <span className={styles.taskProgress}>
                    {task.progress}%
                  </span>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function KeyResultCard({ kr, selected, onOpen, onEdit, tasks, expanded, onToggleExpand }) {
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

  return (
    <div className={`${styles.keyResultCard} ${selected ? styles.selected : ''} ${atRisk ? styles.atRisk : ''}`}>
      <button
        onClick={() => onEdit(kr)}
        className={styles.cardButton}
      >
        <div className={styles.cardHeader}>
          <div className={styles.cardIcon}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22,4 12,14.01 9,11.01"/>
            </svg>
          </div>
          <div className={styles.cardContent}>
            <div className={styles.cardTitle}>{kr.description}</div>
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
          {/* <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.chevron}>
            <polyline points="9,18 15,12 9,6"/>
          </svg> */}
        </div>
      </button>
      
      {/* Expand/Collapse Button and Tasks */}
      {tasks && tasks.length > 0 && (
        <div className={styles.taskSection}>
          <button
            onClick={() => onToggleExpand(kr.id)}
            className={styles.expandButton}
          >
            <span className={styles.taskCount}>{tasks.length} task{tasks.length !== 1 ? 's' : ''}</span>
            <svg 
              width="16" 
              height="16" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              className={`${styles.expandIcon} ${expanded ? styles.expandIconOpen : ''}`}
            >
              <polyline points="6,9 12,15 18,9"/>
            </svg>
          </button>
          
          {expanded && <TaskList tasks={tasks} onEdit={onEdit} />}
        </div>
      )}
    </div>
  );
}

function AddKeyResultCard() {
  return (
    <button className={styles.addKeyResultCard}>
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
  const [expandedKRs, setExpandedKRs] = useState(new Set());
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [editingOkrt, setEditingOkrt] = useState(null);
  const [parentOkrt, setParentOkrt] = useState(null);

  // Fetch OKRT data using the same pattern as the working OKRT page
  const fetchData = async () => {
    try {
      const response = await fetch('/api/okrt');
      const data = await response.json();
      
      if (response.ok) {
        console.log('API Response:', data); // Debug log
        const allItems = data.okrts || [];
        const objs = allItems.filter(item => item.type === 'O');
        const krs = allItems.filter(item => item.type === 'K');
        const tasks = allItems.filter(item => item.type === 'T');
        
        setObjectives(objs);
        setKeyResults(krs);
        setTasks(tasks);
      } else {
        console.error('API Error:', data.error || 'Failed to fetch OKRTs');
      }
    } catch (error) {
      console.error('Error fetching OKRT data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Group key results by their parent objective
  const getKeyResultsForObjective = (objId) => {
    return keyResults.filter(kr => kr.parent_id === objId);
  };

  // Group tasks by their parent key result
  const getTasksForKeyResult = (krId) => {
    return tasks.filter(task => task.parent_id === krId);
  };

  // Toggle expand state for a KR
  const toggleKRExpansion = (krId) => {
    setExpandedKRs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(krId)) {
        newSet.delete(krId);
      } else {
        newSet.add(krId);
      }
      return newSet;
    });
  };

  // Edit handlers
  const handleEdit = (okrt) => {
    setEditingOkrt(okrt);
    setModalMode('edit');
    setParentOkrt(null);
    setShowModal(true);
  };

  const handleSaveOkrt = async (okrtData) => {
    try {
      let response;
      
      if (modalMode === 'edit') {
        // Update existing OKRT
        response = await fetch(`/api/okrt/${editingOkrt.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(okrtData)
        });
      } else {
        // Create new OKRT
        response = await fetch('/api/okrt', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(okrtData)
        });
      }

      if (!response.ok) {
        const data = await response.json();
        console.error('API Error:', data);
        throw new Error(data.error || `Failed to ${modalMode === 'edit' ? 'update' : 'create'} OKRT`);
      }

      // Close modal and refresh the list
      setShowModal(false);
      await fetchData();
    } catch (error) {
      console.error('Save OKRT error:', error);
      throw error; // Re-throw so modal can handle it
    }
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
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.menuButton}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <div className={styles.logo}>OKRT</div>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.quarter}>2025-Q3</span>
        </div>
      </header>

      {/* Main Content */}
      <main className={styles.main}>
        {/* Stack all objectives vertically */}
        {objectives.map((objective) => {
          const objectiveKRs = getKeyResultsForObjective(objective.id);
          
          return (
            <div key={objective.id} className={styles.objectiveSection}>
              <ObjectiveHeader objective={objective} onEdit={handleEdit} />

              {/* Key Results Grid for this objective */}
              <div className={styles.keyResultsGrid}>
                {objectiveKRs.map((kr) => {
                  const krTasks = getTasksForKeyResult(kr.id);
                  const isExpanded = expandedKRs.has(kr.id);
                  
                  return (
                    <KeyResultCard
                      key={kr.id}
                      kr={kr}
                      selected={openKR?.id === kr.id}
                      onOpen={setOpenKR}
                      onEdit={handleEdit}
                      tasks={krTasks}
                      expanded={isExpanded}
                      onToggleExpand={toggleKRExpansion}
                    />
                  );
                })}
                <AddKeyResultCard />
              </div>
            </div>
          );
        })}
      </main>

      <OKRTModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSave={handleSaveOkrt}
        okrt={editingOkrt}
        parentOkrt={parentOkrt}
        mode={modalMode}
      />
    </div>
  );
}