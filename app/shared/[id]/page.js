'use client';

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from '../../okrt/page.module.css';
import CommentsSection from '../../../components/CommentsSection';
import { ObjectiveHeader, KeyResultCard } from '@/components/OKRTCards';

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
            ← Back to Shared OKRs
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
            ← Back to Shared OKRs
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
          ← Back to Shared OKRs
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
            readOnly={true}
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