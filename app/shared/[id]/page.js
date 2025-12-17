'use client';

import React, { useMemo, useState, useEffect } from "react";
import { useParams, useRouter } from 'next/navigation';
import styles from '../../okrt/page.module.css';
import CommentsSection from '../../../components/CommentsSection';
import { ObjectiveHeader, KeyResultCard } from '@/components/OKRTCards';
import { useMainTree } from '@/hooks/useMainTree';
import { useUser } from '@/hooks/useUser';
import { computeObjectiveConfidence } from '@/lib/okrtConfidence';

/* =========================
   Main Shared Detail Page Component
   ========================= */

export default function SharedOKRTDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [objective, setObjective] = useState(null);
  const [keyResults, setKeyResults] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [focusedObjectiveId, setFocusedObjectiveId] = useState(null);
  const [krExpansionState, setKrExpansionState] = useState({});
  const [commentsExpanded, setCommentsExpanded] = useState(false);

  // Use mainTree and user from hooks
  const { mainTree, isLoading: mainTreeLoading } = useMainTree();
  const { user } = useUser();

  // Handle reward/comment updates
  const handleRewardUpdate = async () => {
    // Fetch updated comments for this objective
    try {
      const response = await fetch(`/api/comments?okrtId=${params.id}`);
      if (response.ok) {
        const data = await response.json();
        // Update the objective with new comments
        setObjective(prev => ({
          ...prev,
          comments: data.comments || []
        }));
      }
    } catch (error) {
      console.error('Error fetching updated comments:', error);
    }
  };

  // Fetch shared OKRT data from mainTree or API fallback
  useEffect(() => {
    const fetchSharedOKRT = async () => {
      if (!params.id) return;

      // First try to get from mainTree
      if (!mainTreeLoading && mainTree.sharedOKRTs) {
        const sharedObj = mainTree.sharedOKRTs.find(okrt => okrt.id === params.id && okrt.type === 'O');
        
        if (sharedObj) {
          // Found in mainTree - use it with comments already loaded
          setObjective(sharedObj);
          setLoading(false);
          
          // Fetch KRs and Tasks from API since they're not in mainTree
          try {
            const response = await fetch(`/api/okrt/shared?id=${params.id}`);
            const data = await response.json();
            
            if (response.ok) {
              const allItems = data.okrts || [];
              const krs = allItems.filter(item => item.type === 'K' && item.parent_id === params.id);
              const tsks = allItems.filter(item => item.type === 'T');
              
              setKeyResults(krs);
              setTasks(tsks);
            }
          } catch (error) {
            console.error('Error fetching KRs and tasks:', error);
          }
          return;
        }
      }

      // Fallback: fetch from API if not in mainTree
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
  }, [params.id, mainTree, mainTreeLoading]);

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

  const objectiveWithConfidence = useMemo(() => {
    if (!objective) return null;
    return {
      ...objective,
      confidence: computeObjectiveConfidence(objective, keyResults, tasks)
    };
  }, [objective, keyResults, tasks]);

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
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Main Content */}
      <main className={styles.main}>
        <div className={`${styles.objectiveSection} ${focusedObjectiveId === objectiveWithConfidence.id ? styles.focusedObjective : ''}`}>
          <ObjectiveHeader
            objective={objectiveWithConfidence}
            isExpanded={isExpanded}
            onToggleExpanded={() => setIsExpanded(!isExpanded)}
            onFocusObjective={handleFocusObjective}
            isFocused={focusedObjectiveId === objectiveWithConfidence.id}
            readOnly={true}
            comments={objectiveWithConfidence.comments || []}
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
                    readOnly={true}
                  />
                ))}
              </div>
              
              {/* Comments Section */}
              {user?.id && (
                <div className={styles.objectiveCommentsSection}>
                  <CommentsSection
                    okrtId={objectiveWithConfidence.id}
                    currentUserId={user.id}
                    okrtOwnerId={objectiveWithConfidence.owner_id}
                    isExpanded={commentsExpanded}
                    comments={objectiveWithConfidence.comments || []}
                    onRewardUpdate={handleRewardUpdate}
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
