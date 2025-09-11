'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import OKRTModal from '@/components/OKRTModal';
import { useObjective } from '@/contexts/ObjectiveContext';
import styles from './page.module.css';
import { Calendar, Trash2, TrophyIcon, Flag, ClipboardList } from "lucide-react";

// Date formatting utility
const formatDate = (dateString) => {
  if (!dateString) return ' ';
  const date = new Date(dateString);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[date.getMonth()];
  const day = date.getDate().toString().padStart(2, '0');
  return `${month} ${day}`;
};

//ring progress component
function ProgressRing({ value = 62, size = 40, stroke = 6, color = "#6366f1" }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - value / 100);
  return (
    <svg width={size} height={size} className={styles.progressRing}>
      <circle
        stroke="#E5E7EB"
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
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        className={styles.progressRingLabel}
      >
        {Math.round(value)}%
      </text>
    </svg>
  );
}

// OKRT item component for hierarchical display
function OKRTItem({ okrt, children, childrenData, onEdit, onDelete, onCreateChild, onRequestDelete, initialExpanded = false }) {
  const [expanded, setExpanded] = useState(initialExpanded);
  const hasChildren = Array.isArray(children) && children.length > 0;
  const getIcon = (type) => {
    switch (type) {
      case 'O': return <TrophyIcon size={26} strokeWidth={1.5} />/*{'🏆'}*/;
      case 'K': return <Flag size={20} strokeWidth={2} />/*{'⛳'}*/;
      case 'T': return <ClipboardList size={20} strokeWidth={2} />/*{'🏌️'}*/;
      default: return '';
    }
  };

  // Determine status for KR based on child tasks
  const getKRStatus = (krItem, childTasks) => {
    if (!childTasks || childTasks.length === 0) {
      return 'todo'; // Default if no tasks
    }
    
    const hasInProgress = childTasks.some(task => task.task_status === 'in_progress');
    if (hasInProgress) return 'in_progress';
    
    return 'todo';
  };

  // Determine status for Objective based on child KRs
  const getObjectiveStatus = (objectiveItem, childKRs) => {
    if (!childKRs || childKRs.length === 0) {
      return 'todo'; // Default if no KRs
    }
    
    const hasInProgress = childKRs.some(kr => {
      const krStatus = getKRStatus(kr, kr.children);
      return krStatus === 'in_progress';
    });
    if (hasInProgress) return 'in_progress';
    
    return 'todo';
  };

  // Get the appropriate status class for emoji background
  const getEmojiStatusClass = (type, item, childrenData) => {
    let status;
    
    if (type === 'T') {
      status = item.task_status || 'todo';
    } else if (type === 'K') {
      status = getKRStatus(item, childrenData);
    } else if (type === 'O') {
      status = getObjectiveStatus(item, childrenData);
    } else {
      status = 'todo';
    }
    
    switch (status) {
      case 'todo': return styles.emojiTodo;
      case 'in_progress': return styles.emojiInProgress;
      case 'done': return styles.emojiDone;
      case 'blocked': return styles.emojiBlocked;
      default: return styles.emojiTodo;
    }
  };

  const getTaskStatus = (taskStatus) => {
    const statuses = {
      'todo': { label: 'To Do', className: styles.taskTodo },
      'in_progress': { label: 'In Progress', className: styles.taskInProgress },
      'done': { label: 'Done', className: styles.taskDone },
      'blocked': { label: 'Blocked', className: styles.taskBlocked }
    };
    return statuses[taskStatus] || null;
  };

  const statusBadge = getStatusBadge(okrt.status);
  const taskStatus = okrt.type === 'T' ? getTaskStatus(okrt.task_status) : null;

  return (
    <div className={styles.okrtItem}>
      <div className={`${styles.okrtHeader} ${(okrt.type === 'O' || okrt.type === 'K') ? styles.objectiveHeader : ''}`}>
        {okrt.type === 'O' ? (
          <div className={styles.objectiveLayout}>
            <span className={`${styles.okrtIcon} ${getEmojiStatusClass(okrt.type, okrt, childrenData)}`}>{getIcon(okrt.type)}</span>
            <div 
              className={styles.okrtTitleSection} 
              onClick={() => onEdit(okrt)} 
              style={{ cursor: 'pointer' }}
            >
              {okrt.title && <h3 className={styles.okrtTitle}>{okrt.title}</h3>}
              {okrt.description && (
                <p className={`${styles.okrtDescription} ${styles.objectiveDesc}`}>{okrt.description}</p>
              )}
            </div>
            <div className={styles.badges}>
              {okrt.cycle_qtr && (
                <span className={styles.infoBadge}>
                  {okrt.cycle_qtr}
                </span>
              )}
              {okrt.area && (
                <span className={styles.infoBadge}>
                  {okrt.area}
                </span>
              )}
              {okrt.visibility && (
                <span className={styles.infoBadge}>
                  {okrt.visibility === 'private' ? 'Private' : 
                   okrt.visibility === 'team' ? 'Team' : 
                   okrt.visibility === 'org' ? 'Organization' : okrt.visibility}
                </span>
              )}
              <span className={`${styles.statusBadge} ${statusBadge.className}`}>
                {statusBadge.label}
              </span>
            </div>
            <div className={styles.progressContainer}>
              <div className={styles.objProgressWrapper}>
                <div className={styles.objProgress}>
                  <ProgressRing value={okrt.progress} size={35} stroke={3.5} />
                  {/* <div className={styles.progressLabel}>progress</div> */}
                </div>
              
              <button 
                className={styles.addChildButton}
                onClick={(e) => {
                  e.stopPropagation();
                  onCreateChild(okrt);
                }}
                title="Add Key Result"
              >
              <span style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', height: '100%' }}>+ KR</span>

              </button>
              <button
                className={styles.progressDeleteButton}
                title="Delete"
                onClick={(e) => { e.stopPropagation(); onRequestDelete(okrt); }}
                aria-label="Delete"
              >
                {/* <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 6h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  <path d="M8 6l1-2h6l1 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
                  <path d="M10 11v6M14 11v6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg> */}
                <Trash2 size={16} />
              </button>
              
              <span className={styles.toggleSpan}>{hasChildren && (
                <button 
                  className={styles.toggleButton}
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpanded(prev => !prev);
                  }}
                  title={expanded ? 'Collapse' : 'Expand'}
                  aria-label="Toggle children"
                >
                  {expanded ? <img style={{width: '30px', height: '30px', alignSelf: 'center', marginTop: '5px'}} className="styles.expandImage" src="/expand-up-svgrepo-com.svg"/> : <img style={{width: '30px', height: '30px', alignSelf: 'center', marginTop: '5px'}} className="styles.toggleButton" src="/expand-down-svgrepo-com.svg"/>}
                </button>
              )}</span>
              </div>
            </div>
          </div>
        ) : okrt.type === 'K' ? (
          <div className={styles.keyResultLayout}>
            <span className={`${styles.okrtIcon} ${getEmojiStatusClass(okrt.type, okrt, childrenData)}`}>{getIcon(okrt.type)}</span>
            <div 
              className={styles.okrtTitleSection} 
              onClick={() => onEdit(okrt)} 
              style={{ cursor: 'pointer' }}
            >
              {okrt.title && <h3 className={styles.okrtTitle}>{okrt.title}</h3>}
              {okrt.description && (
                <p className={styles.okrtDescription}>{okrt.description}</p>
              )}
              <div className={styles.krDetails}></div>
            </div>
            <div className={styles.krProgressWrapper}>
                <div className={styles.krProgress}>
                  <ProgressRing value={okrt.progress} size={35} stroke={3.5} />
                  {/* <div className={styles.progressLabel}>progress</div> */}
                </div>
              <button 
                className={styles.addChildButton}
                onClick={(e) => {
                  e.stopPropagation();
                  onCreateChild(okrt);
                }}
                title="Add Task"
                >
                <span style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', height: '100%' }}>+ Task</span>
                </button>
                <button
                className={styles.progressDeleteButton}
                title="Delete"
                onClick={(e) => { e.stopPropagation(); onRequestDelete(okrt); }}
                aria-label="Delete"
              >
                <Trash2 size={16} />
              </button>
              
              <span className={styles.toggleSpan}>{hasChildren && (
                <button 
                  className={styles.toggleButton}
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpanded(prev => !prev);
                  }}
                  title={expanded ? 'Collapse' : 'Expand'}
                  aria-label="Toggle children"
                >
                  {expanded ? <img style={{width: '30px', height: '30px', alignSelf: 'center', marginTop: '5px'}} className="styles.expandImage" src="/expand-up-svgrepo-com.svg"/> : <img style={{width: '30px', height: '30px', alignSelf: 'center', marginTop: '5px'}} className="styles.toggleButton" src="/expand-down-svgrepo-com.svg"/>}
                  </button>
              )}</span>
            </div>
          </div>
        ) : (
          <div className={styles.okrtMain}>
            <span className={`${styles.okrtIcon} ${getEmojiStatusClass(okrt.type, okrt, childrenData)}`}>{getIcon(okrt.type)}</span>
            <div className={styles.okrtContent}>
              {okrt.title &&
              <div 
                className={styles.okrtTitleRow} 
                onClick={() => onEdit(okrt)} 
                style={{ cursor: 'pointer' }}
              >
                 <h3 className={styles.okrtTitle}>{okrt.title}</h3>
                 </div>
                 }
              
              
              {okrt.type === 'T' && (
                <div 
                  className={styles.taskMetaRow}
                  onClick={() => onEdit(okrt)}
                  style={{ cursor: 'pointer' }}
                >
                  {okrt.description && (
                    <p className={styles.okrtDescription}>{okrt.description}</p>
                  )}
                  
                  <div className={styles.tProgressWrapper}>
                <div className={styles.tProgress}>
                  <ProgressRing value={okrt.progress} size={35} stroke={3.5} />
                  {/* <div className={styles.progressLabel}>progress</div> */}
                </div>
                    
                    <span className={styles.dueDate}> <Calendar className={styles.calendarIcon} />{formatDate(okrt.due_date)}</span>
                
                    <button
                      className={styles.progressDeleteButton}
                      title="Delete"
                      onClick={(e) => { e.stopPropagation(); onRequestDelete(okrt); }}
                      aria-label="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              )}
              
              {okrt.type !== 'T' && okrt.description && (
                <p className={styles.okrtDescription}>{okrt.description}</p>
              )}
              

            </div>
          </div>
        )}
      </div>
      
      {hasChildren && expanded && (
        <div className={styles.okrtChildren}>
          {children}
        </div>
      )}
    </div>
  );
}

// Helper function to get status badge - moved outside OKRTItem so it can be used in main component
const getStatusBadge = (status) => {
  const badges = {
    'D': { label: 'Draft', className: styles.statusDraft },
    'A': { label: 'Active', className: styles.statusActive },
    'C': { label: 'Complete', className: styles.statusComplete }
  };
  return badges[status] || { label: 'Unknown', className: '' };
};

export default function OKRTPage() {
  const router = useRouter();
  const { selectedObjectiveId, setSelectedObjectiveId } = useObjective();
  const [user, setUser] = useState(null);
  const [okrts, setOkrts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [editingOkrt, setEditingOkrt] = useState(null);
  const [parentOkrt, setParentOkrt] = useState(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState(null);
  const [warningMessage, setWarningMessage] = useState(null);

  useEffect(() => {
    const checkAuthAndFetchData = async () => {
      try {
        const response = await fetch('/api/me');
        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
          fetchOkrts();
        } else {
          router.push('/login');
        }
      } catch (err) {
        console.error('Auth check failed:', err);
        router.push('/login');
      }
    };

    checkAuthAndFetchData();
  }, [router]);

  const fetchOkrts = async () => {
    try {
      const response = await fetch('/api/okrt');
      const data = await response.json();
      
      if (response.ok) {
        const list = data.okrts || [];
        setOkrts(list);
        // pick first Objective as default selection
        const firstObjective = list.find(item => item.type === 'O');
        setSelectedObjectiveId(prev => prev || firstObjective?.id || null);
      } else {
        setError(data.error || 'Failed to fetch OKRTs');
      }
    } catch (err) {
      setError('Network error while fetching OKRTs');
    } finally {
      setLoading(false);
    }
  };

  const buildHierarchy = (items) => {
    const itemMap = {};
    const rootItems = [];

    // First pass: create map
    items.forEach(item => {
      itemMap[item.id] = { ...item, children: [] };
    });

    // Second pass: build hierarchy
    items.forEach(item => {
      if (item.parent_id && itemMap[item.parent_id]) {
        itemMap[item.parent_id].children.push(itemMap[item.id]);
      } else {
        rootItems.push(itemMap[item.id]);
      }
    });

    return rootItems;
  };

  const renderOkrtTree = (items, isRoot = false) => {
    return items.map((item, index) => (
      <OKRTItem
        key={item.id}
        okrt={item}
        childrenData={item.children}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onCreateChild={handleCreateChild}
        onRequestDelete={openDeleteConfirm}
        initialExpanded={isRoot && index === 0}
      >
        {item.children && item.children.length > 0 && renderOkrtTree(item.children, false)}
      </OKRTItem>
    ));
  };

  // Render an OKRT subtree with all levels expanded
  const renderOkrtTreeExpanded = (items) => {
    return items.map((item) => (
      <OKRTItem
        key={item.id}
        okrt={item}
        childrenData={item.children}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onCreateChild={handleCreateChild}
        onRequestDelete={openDeleteConfirm}
        initialExpanded={true}
      >
        {item.children && item.children.length > 0 && renderOkrtTreeExpanded(item.children)}
      </OKRTItem>
    ));
  };

  // Build a focused tree for a specific objective id
  const renderSelectedObjective = (objectiveId) => {
    if (!objectiveId) return null;
    // Build a map to locate the selected objective with its children via hierarchy
    const map = {};
    okrts.forEach(i => { map[i.id] = { ...i, children: [] }; });
    okrts.forEach(i => { if (i.parent_id && map[i.parent_id]) { map[i.parent_id].children.push(map[i.id]); } });
    const selected = map[objectiveId];
    if (!selected) return null;
    return (
      <OKRTItem
        key={selected.id}
        okrt={selected}
        childrenData={selected.children}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onCreateChild={handleCreateChild}
        onRequestDelete={openDeleteConfirm}
        initialExpanded={true}
      >
        {selected.children && selected.children.length > 0 && renderOkrtTreeExpanded(selected.children)}
      </OKRTItem>
    );
  };

  const handleEdit = (okrt) => {
    setEditingOkrt(okrt);
    setModalMode('edit');
    setParentOkrt(null);
    setShowModal(true);
  };

  const openDeleteConfirm = (okrt) => {
    // Always allow the delete confirmation dialog to open
    // The backend will validate if deletion is allowed
    setDeleteConfirmItem(okrt);
  };

  const performDelete = async (okrt) => {
    try {
      const response = await fetch(`/api/okrt/${okrt.id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        fetchOkrts();
      } else {
        const data = await response.json();
        // Show the API error message in a warning modal
        setWarningMessage({
          title: 'Cannot Delete',
          message: data.details || data.error || 'Failed to delete OKRT',
          itemType: okrt.type === 'O' ? 'Objective' : okrt.type === 'K' ? 'Key Result' : 'Task',
          childType: okrt.type === 'O' ? 'Key Results' : okrt.type === 'K' ? 'Tasks' : 'sub-tasks'
        });
      }
    } catch (err) {
      setWarningMessage({
        title: 'Network Error',
        message: 'Network error while deleting OKRT',
        itemType: 'Item',
        childType: 'children'
      });
    } finally {
      setDeleteConfirmItem(null);
    }
  };

  const handleDelete = async (okrt) => {
    if (!confirm('Are you sure you want to delete this OKRT? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/okrt/${okrt.id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        // Refresh the list
        fetchOkrts();
      } else {
        const data = await response.json();
        // Show the API error message in a warning modal
        setWarningMessage({
          title: 'Cannot Delete',
          message: data.details || data.error || 'Failed to delete OKRT',
          itemType: okrt.type === 'O' ? 'Objective' : okrt.type === 'K' ? 'Key Result' : 'Task',
          childType: okrt.type === 'O' ? 'Key Results' : okrt.type === 'K' ? 'Tasks' : 'sub-tasks'
        });
      }
    } catch (err) {
      setWarningMessage({
        title: 'Network Error',
        message: 'Network error while deleting OKRT',
        itemType: 'Item',
        childType: 'children'
      });
    }
  };

  const handleCreateNew = () => {
    router.push('/new');
  };

  const handleCreateChild = (parent) => {
    setEditingOkrt(null);
    setModalMode('create');
    setParentOkrt(parent);
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
      fetchOkrts();
    } catch (error) {
      console.error('Save OKRT error:', error);
      throw error; // Re-throw so modal can handle it
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading your OKRTs...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>Error: {error}</div>
      </div>
    );
  }

  const hierarchicalOkrts = buildHierarchy(okrts);
  const rootObjectives = hierarchicalOkrts.filter(item => item.type === 'O');
  const selectedObjective = selectedObjectiveId;

  // Helper for type label
  const typeLabel = (t) => (t === 'O' ? 'Objective' : t === 'K' ? 'Key Result' : 'Task');

  return (
    <div className={styles.container}>
      {hierarchicalOkrts.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🎯</div>
          <h2>No goals yet</h2>
          <p>Create your first Objective, Key Result, or Task to get started.</p>
          <button 
            className={styles.createButtonPrimary}
            onClick={handleCreateNew}
          >
            Create Your First Goal
          </button>
        </div>
      ) : (
        <div className={styles.detailPane}>
          {renderSelectedObjective(selectedObjective)}
        </div>
      )}

      <OKRTModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSave={handleSaveOkrt}
        okrt={editingOkrt}
        parentOkrt={parentOkrt}
        mode={modalMode}
      />

      {deleteConfirmItem && (
        <div className={styles.confirmOverlay} onClick={() => setDeleteConfirmItem(null)}>
          <div className={styles.confirmModal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.confirmTitle}>Confirm Delete</h3>
            <p className={styles.confirmText}>
              Do you want to delete this {typeLabel(deleteConfirmItem.type)}: {deleteConfirmItem.description || deleteConfirmItem.title || ''}?
            </p>
            <div className={styles.confirmButtons}>
              <button className={styles.cancelButton} onClick={() => setDeleteConfirmItem(null)}>Cancel</button>
              <button className={styles.deleteConfirmButton} onClick={() => performDelete(deleteConfirmItem)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {warningMessage && (
        <div className={styles.confirmOverlay} onClick={() => setWarningMessage(null)}>
          <div className={styles.confirmModal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.confirmTitle}>{warningMessage.title}</h3>
            <p className={styles.confirmText}>
              {warningMessage.message}
            </p>
            <div className={styles.confirmButtons}>
              <button className={styles.cancelButton} onClick={() => setWarningMessage(null)}>OK</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
