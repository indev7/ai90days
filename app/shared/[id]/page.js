'use client';

import React, { useMemo, useState, useEffect } from "react";
import { useParams, useRouter } from 'next/navigation';
import styles from '../../okrt/page.module.css';
import CommentsSection from '../../../components/CommentsSection';
import { ObjectiveHeader, KeyResultCard, ObjectiveInsights } from '@/components/OKRTCards';
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
  const [jiraAuth, setJiraAuth] = useState({
    checked: false,
    authenticated: false,
    siteUrl: ''
  });
  const [jiraIssueByKey, setJiraIssueByKey] = useState({});

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

  // Hydrate shared OKRT data from mainTree (avoid extra DB calls)
  useEffect(() => {
    if (!params.id) return;
    if (mainTreeLoading || !mainTree?.sharedOKRTs) return;

    setLoading(true);
    setObjective(null);
    setKeyResults([]);
    setTasks([]);
    const sharedObj = mainTree?.sharedOKRTs?.find(
      (okrt) => okrt.id === params.id && okrt.type === 'O'
    );

    if (sharedObj) {
      const krs = Array.isArray(sharedObj.keyResults) ? sharedObj.keyResults : [];
      const flattenedTasks = krs.flatMap((kr) =>
        (kr.tasks || []).map((task) => ({
          ...task,
          parent_id: task.parent_id || kr.id
        }))
      );

      setObjective(sharedObj);
      setKeyResults(krs);
      setTasks(flattenedTasks);
      setError(null);
      setLoading(false);
    } else {
      setError('Shared objective not found');
      setLoading(false);
    }
  }, [params.id, mainTree?.sharedOKRTs, mainTreeLoading]);

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

  const linkedTicketKeys = useMemo(() => {
    if (!objective) return [];
    const rawLinks = objective.jira_links || objective.jiraLinks || [];
    const normalizeKey = (value) => String(value || '').trim().toUpperCase();
    const isValidKey = (value) => /^[A-Z][A-Z0-9]+-\d+$/.test(value);
    return rawLinks
      .map((link) => (typeof link === 'string' ? link : link?.jira_ticket_id))
      .map(normalizeKey)
      .filter((key) => isValidKey(key));
  }, [objective]);

  useEffect(() => {
    let cancelled = false;
    const checkJiraAuth = async () => {
      if (linkedTicketKeys.length === 0) {
        setJiraAuth({ checked: true, authenticated: false, siteUrl: '' });
        return;
      }
      try {
        const response = await fetch('/api/jira/auth/status');
        const data = response.ok ? await response.json() : null;
        if (!cancelled) {
          setJiraAuth({
            checked: true,
            authenticated: Boolean(data?.authenticated),
            siteUrl: data?.siteUrl || ''
          });
        }
      } catch (_error) {
        if (!cancelled) {
          setJiraAuth({ checked: true, authenticated: false, siteUrl: '' });
        }
      }
    };
    checkJiraAuth();
    return () => {
      cancelled = true;
    };
  }, [linkedTicketKeys.length]);

  useEffect(() => {
    let cancelled = false;

    const fetchLinkedInitiatives = async () => {
      if (!jiraAuth.authenticated || linkedTicketKeys.length === 0) {
        setJiraIssueByKey({});
        return;
      }

      const uniqueKeys = Array.from(new Set(linkedTicketKeys)).slice(0, 200);
      const batches = [];
      for (let i = 0; i < uniqueKeys.length; i += 50) {
        batches.push(uniqueKeys.slice(i, i + 50));
      }

      const nextIssueMap = {};

      for (const batch of batches) {
        const jql = `key in (${batch.join(',')})`;
        const params = new URLSearchParams({
          jql,
          fields: 'summary,status,priority,duedate,project,issuetype,customfield_11331',
          maxResults: String(batch.length)
        });

        const response = await fetch(`/api/jira/query?${params.toString()}`);
        if (!response.ok) {
          if (response.status === 401 && !cancelled) {
            setJiraAuth({ checked: true, authenticated: false, siteUrl: '' });
          }
          continue;
        }
        const data = await response.json();
        const issues = Array.isArray(data?.issues) ? data.issues : [];
        issues.forEach((issue) => {
          if (issue?.key) {
            nextIssueMap[issue.key.toUpperCase()] = issue;
          }
        });
      }

      if (!cancelled) {
        setJiraIssueByKey(nextIssueMap);
      }
    };

    fetchLinkedInitiatives();

    return () => {
      cancelled = true;
    };
  }, [jiraAuth.authenticated, linkedTicketKeys.join('|')]);

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
      <div className="app-page">
        <div className="app-pageContent">
          <div className={styles.loading}>
            <div>Loading shared objective...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-page">
        <div className="app-pageContent">
          <div className={styles.empty}>
            <div>
              <div className={styles.emptyTitle}>Error</div>
              <div className={styles.emptyText}>{error}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!objective) {
    return (
      <div className="app-page">
        <div className="app-pageContent">
          <div className={styles.empty}>
            <div>
              <div className={styles.emptyTitle}>Objective not found</div>
              <div className={styles.emptyText}>The shared objective you're looking for doesn't exist.</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`app-page ${styles.container}`}>
      {/* Main Content */}
      <main className={`app-pageContent ${styles.main}`}>
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
              <ObjectiveInsights
                objective={objectiveWithConfidence}
                jiraAuth={jiraAuth}
                jiraIssueByKey={jiraIssueByKey}
              />
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
