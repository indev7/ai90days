'use client';

import React, { useMemo, useState, useEffect } from "react";
import { useSearchParams } from 'next/navigation';
import { MdOutlineSelfImprovement } from 'react-icons/md';
import styles from './page.module.css';
import OKRTModal from '../../components/OKRTModal';
import ShareModal from '../../components/ShareModal';
import CommentsSection from '../../components/CommentsSection';
import { processCacheUpdateFromData } from '@/lib/apiClient';
import { computeObjectiveConfidence } from '@/lib/okrtConfidence';
import useMainTreeStore from '@/store/mainTreeStore';
import { useMainTree } from '@/hooks/useMainTree';
import { useUser } from '@/hooks/useUser';
import { getThemeColorPalette } from '@/lib/clockUtils';
import {
  ObjectiveHeader,
  KeyResultCard,
  AddKeyResultCard
} from '@/components/OKRTCards';

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

export default function OKRTPage() {
  const searchParams = useSearchParams();
  const selectedObjectiveId = searchParams.get('objective');
  const showAddModal = searchParams.get('showAddModal');
  const view = searchParams.get('view');
  const showArchived = view === 'archived';
  
  const { user } = useUser();
  const [objectives, setObjectives] = useState([]);
  const [keyResults, setKeyResults] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [visibilityFilter, setVisibilityFilter] = useState('all');
  const [openKR, setOpenKR] = useState(null);
  const [expandedObjectives, setExpandedObjectives] = useState(new Set());
  const [focusedObjectiveId, setFocusedObjectiveId] = useState(null);
  const [krExpansionState, setKrExpansionState] = useState({});
  const [commentsExpanded, setCommentsExpanded] = useState({});
  const [modalState, setModalState] = useState({
    isOpen: false,
    mode: 'create',
    okrt: null,
    parentOkrt: null
  });

  // Debug: Log modal state changes
  useEffect(() => {
    console.log('Modal state changed:', modalState);
  }, [modalState]);
  const [shareModalState, setShareModalState] = useState({
    isOpen: false,
    objective: null
  });

  // Load mainTree data (will use cached data if available)
  const { isLoading: mainTreeLoading } = useMainTree();
  
  // Subscribe to mainTree from Zustand store
  const mainTree = useMainTreeStore((state) => state.mainTree);
  const lastUpdated = useMainTreeStore((state) => state.lastUpdated);

  // Process mainTree data whenever it changes (from cross-tab sync or initial load)
  useEffect(() => {
    if (mainTree && mainTree.myOKRTs) {
      console.log('Processing mainTree data for My OKRs page');
      const allItems = mainTree.myOKRTs || [];
      const objs = allItems.filter(item => item.type === 'O');
      const krs = allItems.filter(item => item.type === 'K');
      const tsks = allItems.filter(item => item.type === 'T');
      
      setObjectives(objs);
      setKeyResults(krs);
      setTasks(tsks);
      setLoading(false);
    }
  }, [mainTree]);

  // Initial loading state management
  useEffect(() => {
    if (!mainTreeLoading && (!mainTree || !mainTree.myOKRTs)) {
      setLoading(false);
    }
  }, [mainTreeLoading, mainTree]);

  // Listen for create objective events from LeftMenu (kept for backward compatibility)
  useEffect(() => {
    const handleCreateObjectiveEvent = () => {
      console.log('createObjective event received!');
      setModalState({
        isOpen: true,
        mode: 'create',
        okrt: null,
        parentOkrt: null
      });
    };

    console.log('Setting up createObjective event listener');
    window.addEventListener('createObjective', handleCreateObjectiveEvent);
    
    return () => {
      console.log('Removing createObjective event listener');
      window.removeEventListener('createObjective', handleCreateObjectiveEvent);
    };
  }, []);

  // Handle showAddModal query parameter
  useEffect(() => {
    console.log('showAddModal effect:', showAddModal, 'loading:', loading);
    if (showAddModal === 'true' && !loading) {
      console.log('Opening modal from query parameter');
      setModalState({
        isOpen: true,
        mode: 'create',
        okrt: null,
        parentOkrt: null
      });
      // Clear the query parameter after opening modal
      window.history.replaceState({}, '', '/okrt');
    }
  }, [showAddModal, loading]);

  // Listen for left menu toggle events to collapse OKRTs when menu expands
  useEffect(() => {
    const handleMenuToggle = () => {
      // Collapse all expanded objectives
      setExpandedObjectives(new Set());
      // Collapse all expanded KRs
      setKrExpansionState({});
      // Collapse all comments
      setCommentsExpanded({});
      // Exit focus mode if active
      setFocusedObjectiveId(null);
    };

    // Listen for both hamburger menu and desktop menu toggle events
    window.addEventListener('menuToggleToExpanded', handleMenuToggle);
    
    return () => {
      window.removeEventListener('menuToggleToExpanded', handleMenuToggle);
    };
  }, []);

  // Keep objectives collapsed by default; only auto-expand when a specific objective is requested
  useEffect(() => {
    if (!selectedObjectiveId) return;
    setExpandedObjectives(new Set([selectedObjectiveId]));
  }, [selectedObjectiveId]);

  // Group key results by their parent objective
  const getKeyResultsForObjective = (objId) => {
    return keyResults.filter(kr => kr.parent_id === objId);
  };

  const objectivesWithConfidence = useMemo(() => {
    return objectives.map((objective) => ({
      ...objective,
      confidence: computeObjectiveConfidence(objective, keyResults, tasks)
    }));
  }, [objectives, keyResults, tasks]);

  // Group tasks by their parent key result
  const getTasksForKeyResult = (krId) => {
    return tasks.filter(task => task.parent_id === krId);
  };

  // Build ordered objectives grouped by top-level family to keep siblings together
  const { orderedObjectives, objectiveRootMap, familyColorMap } = useMemo(() => {
    if (!objectivesWithConfidence || objectivesWithConfidence.length === 0) {
      return { orderedObjectives: [], objectiveRootMap: new Map(), familyColorMap: new Map() };
    }

    const palette = getThemeColorPalette();
    const hashToIndex = (value) => {
      const str = String(value ?? '');
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
      }
      return palette.length > 0 ? hash % palette.length : 0;
    };

    const childrenMap = new Map();
    const objectiveMap = new Map(objectivesWithConfidence.map((o) => [o.id, o]));

    objectivesWithConfidence.forEach((objective) => {
      const parentKey = objective.parent_id || null;
      if (!childrenMap.has(parentKey)) {
        childrenMap.set(parentKey, []);
      }
      childrenMap.get(parentKey).push(objective);
    });

    const sortObjectives = (a, b) => {
      const orderA = a.order_index ?? 0;
      const orderB = b.order_index ?? 0;
      if (orderA !== orderB) return orderA - orderB;
      return (a.title || '').localeCompare(b.title || '');
    };

    childrenMap.forEach((list) => list.sort(sortObjectives));

    const roots = (childrenMap.get(null) || []).concat(
      objectivesWithConfidence.filter((o) => o.parent_id && !objectiveMap.has(o.parent_id))
    );

    const ordered = [];
    const rootMap = new Map();
    const colorMap = new Map();

    const traverse = (node, rootId) => {
      rootMap.set(node.id, rootId);
      ordered.push(node);
      const kids = childrenMap.get(node.id) || [];
      kids.forEach((child) => traverse(child, rootId));
    };

    roots.forEach((root) => {
      traverse(root, root.id);
      const color = palette[hashToIndex(root.id)] || '#a78bfa';
      colorMap.set(root.id, color);
    });

    return { orderedObjectives: ordered, objectiveRootMap: rootMap, familyColorMap: colorMap };
  }, [objectivesWithConfidence]);

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

      // Process cache update from response
      const data = await response.json();
      processCacheUpdateFromData(data);

      // Update local state from mainTree store
      const { mainTree } = useMainTreeStore.getState();
      const allItems = mainTree.myOKRTs || [];
      const objs = allItems.filter(item => item.type === 'O');
      const krs = allItems.filter(item => item.type === 'K');
      const tsks = allItems.filter(item => item.type === 'T');
      
      setObjectives(objs);
      setKeyResults(krs);
      setTasks(tsks);
    } catch (error) {
      console.error('Error saving OKRT:', error);
      throw error;
    }
  };

  const handleDeleteOkrt = async () => {
    try {
      const url = `/api/okrt/${modalState.okrt.id}`;
      
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete OKRT');
      }

      // Process cache update from response
      const data = await response.json();
      processCacheUpdateFromData(data);

      // Update local state from mainTree store
      const { mainTree } = useMainTreeStore.getState();
      const allItems = mainTree.myOKRTs || [];
      const objs = allItems.filter(item => item.type === 'O');
      const krs = allItems.filter(item => item.type === 'K');
      const tsks = allItems.filter(item => item.type === 'T');
      
      setObjectives(objs);
      setKeyResults(krs);
      setTasks(tsks);
    } catch (error) {
      console.error('Error deleting OKRT:', error);
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

  const handleShareObjective = (objective) => {
    setShareModalState({
      isOpen: true,
      objective: objective
    });
  };

  const handleCloseShareModal = () => {
    setShareModalState({
      isOpen: false,
      objective: null
    });
  };

  const handleFocusObjective = (objectiveId) => {
    if (focusedObjectiveId === objectiveId) {
      // Exit focus mode
      setFocusedObjectiveId(null);
      // Collapse the objective itself (hide KRs and Comments)
      setExpandedObjectives(prev => {
        const newSet = new Set(prev);
        newSet.delete(objectiveId);
        return newSet;
      });
      // Collapse all KRs for this objective
      setKrExpansionState(prev => {
        const newState = { ...prev };
        const objectiveKRs = getKeyResultsForObjective(objectiveId);
        objectiveKRs.forEach(kr => {
          delete newState[kr.id];
        });
        return newState;
      });
      // Collapse comments for this objective
      setCommentsExpanded(prev => ({
        ...prev,
        [objectiveId]: false
      }));
      // Dispatch event to expand left menu
      window.dispatchEvent(new CustomEvent('exitFocusMode'));
      // Also dispatch the menu toggle event to ensure consistency
      window.dispatchEvent(new CustomEvent('menuToggleToExpanded'));
    } else {
      // Enter focus mode
      setFocusedObjectiveId(objectiveId);
      // Ensure the focused objective is expanded
      setExpandedObjectives(prev => new Set([...prev, objectiveId]));
      // Expand all KRs for this objective
      setKrExpansionState(prev => {
        const newState = { ...prev };
        const objectiveKRs = getKeyResultsForObjective(objectiveId);
        objectiveKRs.forEach(kr => {
          newState[kr.id] = true;
        });
        return newState;
      });
      // Expand comments for this objective
      setCommentsExpanded(prev => ({
        ...prev,
        [objectiveId]: true
      }));
      // Dispatch event to minimize left menu
      window.dispatchEvent(new CustomEvent('enterFocusMode'));
    }
  };

  // Filter objectives based on URL parameter or focus mode while preserving family order
  const filteredObjectives = useMemo(() => {
    return orderedObjectives.filter((objective) => {
      if (selectedObjectiveId) {
        return objective.id === selectedObjectiveId;
      }
      if (focusedObjectiveId) {
        return objective.id === focusedObjectiveId;
      }
      return true;
    });
  }, [orderedObjectives, selectedObjectiveId, focusedObjectiveId]);

  const visibleObjectives = useMemo(() => {
    return filteredObjectives.filter((objective) => {
      if (showArchived) {
        return objective.status === 'R';
      }
      if (objective.status === 'R') {
        return false;
      }
      if (visibilityFilter === 'shared') {
        return objective.visibility === 'shared';
      }
      if (visibilityFilter === 'private') {
        return objective.visibility !== 'shared';
      }
      return true;
    });
  }, [filteredObjectives, visibilityFilter, showArchived]);

  const familyGroups = useMemo(() => {
    const groups = [];
    const groupMap = new Map();

    visibleObjectives.forEach((objective) => {
      const rootId = objectiveRootMap.get(objective.id) || objective.id;
      if (!groupMap.has(rootId)) {
        const group = { rootId, objectives: [] };
        groupMap.set(rootId, group);
        groups.push(group);
      }
      groupMap.get(rootId).objectives.push(objective);
    });

    return groups;
  }, [visibleObjectives, objectiveRootMap]);

  const showFamilyBorders = useMemo(() => {
    // Only show colored grouping when at least one family has a hierarchy
    return familyGroups.some((group) => group.objectives.length > 1);
  }, [familyGroups]);

  if (loading) {
    return (
      <div className={styles.loading}>
        <div>Loading OKRT data...</div>
      </div>
    );
  }

  // Don't return early - render empty state with modal support
  const hasNoObjectives = visibleObjectives.length === 0;
  const headerCount = visibleObjectives.length;
  const headerTitle = showArchived ? 'Archived OKRs' : 'My OKRs';

  return (
    <div className={styles.container}>
      <div className="app-pageHeader">
        <div className="app-titleSection">
          <MdOutlineSelfImprovement className="app-pageIcon" />
          <h1 className="app-pageTitle">{headerTitle}</h1>
          <span className="app-pageCount">({headerCount})</span>
        </div>
        <div className="app-filterSwitcher" role="group" aria-label="Visibility filter">
          <div
            className={`app-filterThumb ${
              visibilityFilter === 'private'
                ? styles.thumbPrivate
                : visibilityFilter === 'shared'
                  ? styles.thumbShared
                  : styles.thumbAll
            }`}
            aria-hidden="true"
          />
          <button
            type="button"
            className={`app-filterButton ${visibilityFilter === 'all' ? 'app-filterButtonActive' : ''}`}
            onClick={() => setVisibilityFilter('all')}
            aria-pressed={visibilityFilter === 'all'}
          >
            All
          </button>
          <button
            type="button"
            className={`app-filterButton ${visibilityFilter === 'private' ? 'app-filterButtonActive' : ''}`}
            onClick={() => setVisibilityFilter('private')}
            aria-pressed={visibilityFilter === 'private'}
          >
            Private
          </button>
          <button
            type="button"
            className={`app-filterButton ${visibilityFilter === 'shared' ? 'app-filterButtonActive' : ''}`}
            onClick={() => setVisibilityFilter('shared')}
            aria-pressed={visibilityFilter === 'shared'}
          >
            Shared
          </button>
        </div>
      </div>
      {/* Main Content */}
      <main className={styles.main}>
        {/* Show empty state if no objectives */}
        {hasNoObjectives ? (
          <div className={styles.empty}>
            <div>
              <div className={styles.emptyTitle}>
                {showArchived ? 'No archived objectives' : 'No objectives found'}
              </div>
              <div className={styles.emptyText}>
                {showArchived
                  ? 'Archive an objective to see it here.'
                  : 'Create your first objective to get started.'}
              </div>
            </div>
          </div>
        ) : (
          /* Stack objectives by family, preserving pre-order traversal */
          familyGroups.map((group) => {
            const familyColor = familyColorMap.get(group.rootId) || '#a78bfa';
            const wrapperStyle = showFamilyBorders ? { borderColor: familyColor } : {};
            return (
              <div
                key={group.rootId}
                className={`${styles.objectiveFamily} ${showFamilyBorders ? '' : styles.objectiveFamilyNoBorder}`}
                style={wrapperStyle}
              >
                {group.objectives.map((objective) => {
                  const objectiveKRs = getKeyResultsForObjective(objective.id);
                  return (
                    <div key={objective.id} className={`${styles.objectiveSection} ${focusedObjectiveId === objective.id ? styles.focusedObjective : ''}`}>
                      <ObjectiveHeader
                        objective={objective}
                        onEditObjective={handleEditObjective}
                        isExpanded={expandedObjectives.has(objective.id)}
                        onToggleExpanded={() => handleToggleObjective(objective.id)}
                        onShareObjective={handleShareObjective}
                        onFocusObjective={handleFocusObjective}
                        isFocused={focusedObjectiveId === objective.id}
                        comments={objective.comments || []}
                      />

                      {/* Key Results Grid for this objective - only show when expanded */}
                      {expandedObjectives.has(objective.id) && (
                        <>
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
                                forceExpanded={krExpansionState[kr.id]}
                              />
                            ))}
                            <AddKeyResultCard onAddKeyResult={() => handleAddKeyResult(objective)} />
                          </div>
                          
                          {/* Single Comments Section for the entire Objective */}
                          {user?.id && (
                          <div className={styles.objectiveCommentsSection}>
                          <CommentsSection
                          okrtId={objective.id}
                          currentUserId={user.id}
                          okrtOwnerId={objective.owner_id}
                            isExpanded={commentsExpanded[objective.id]}
                            comments={objective.comments || []}
                            onRewardUpdate={() => {
                              // Trigger mainTree refresh when comments are added
                              window.dispatchEvent(new CustomEvent('refreshMainTree'));
                            }}
                            />
                            </div>
                            )}
                        </>
                     )}
                   </div>
                 );
               })}
             </div>
           );
         })
       )}
      </main>

      {/* OKRT Modal */}
      <OKRTModal
        isOpen={modalState.isOpen}
        onClose={handleCloseModal}
        onSave={handleSaveOkrt}
        onDelete={modalState.mode === 'edit' ? handleDeleteOkrt : null}
        okrt={modalState.okrt}
        parentOkrt={modalState.parentOkrt}
        mode={modalState.mode}
      />

      {/* Share Modal */}
      <ShareModal
        isOpen={shareModalState.isOpen}
        onClose={handleCloseShareModal}
        okrtId={shareModalState.objective?.id}
        currentVisibility={shareModalState.objective?.visibility}
      />
    </div>
  );
}
