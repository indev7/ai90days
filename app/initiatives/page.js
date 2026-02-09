'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { RiFlag2Line } from 'react-icons/ri';
import InitiativeCard from '@/components/InitiativeCard';
import styles from './page.module.css';

const JIRA_BASE_URL = String(process.env.NEXT_PUBLIC_JIRA_BASE_URL || '').replace(/\/+$/, '');
const PROJECT_KEY = 'PM';
const ISSUE_TYPE = 'Initiative';
const RAG_FIELD_ID = 'customfield_11331';
const MAX_INITIATIVES = 300;
const PAGE_SIZE = 100;

const RAG_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'GREEN', label: 'Green' },
  { value: 'AMBER', label: 'Amber' },
  { value: 'RED', label: 'Red' },
];

const PRIORITY_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'Highest', label: 'Highest' },
  { value: 'High', label: 'High' },
  { value: 'Medium', label: 'Medium' },
  { value: 'Low', label: 'Low' },
  { value: 'Lowest', label: 'Lowest' },
];

function escapeJqlValue(value) {
  return (value || '').replace(/["\\]/g, '').trim();
}

export default function InitiativesPage() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [jiraSiteUrl, setJiraSiteUrl] = useState('');
  const [statuses, setStatuses] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [priorityIndex, setPriorityIndex] = useState(0);
  const [ragIndex, setRagIndex] = useState(0);
  const [initiatives, setInitiatives] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingFacets, setLoadingFacets] = useState(false);
  const [error, setError] = useState('');

  const ragValue = RAG_OPTIONS[ragIndex]?.value ?? '';
  const priorityValue = PRIORITY_OPTIONS[priorityIndex]?.value ?? '';

  const redirectToLogin = useCallback(() => {
    window.location.href = '/api/jira/auth/login';
  }, []);

  const checkAuthStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/jira/auth/status');
      const data = response.ok ? await response.json() : null;
      if (!data?.authenticated) {
        setIsAuthenticated(false);
        setAuthChecked(true);
        redirectToLogin();
        return;
      }
      setIsAuthenticated(true);
      if (data?.siteUrl) {
        setJiraSiteUrl(String(data.siteUrl).replace(/\/+$/, ''));
      } else if (JIRA_BASE_URL) {
        setJiraSiteUrl(JIRA_BASE_URL);
      } else if (data?.cloudId) {
        setJiraSiteUrl(`https://${data.cloudId}.atlassian.net`);
      }
    } catch (err) {
      setError('Failed to check Jira authentication status');
    } finally {
      setAuthChecked(true);
    }
  }, [redirectToLogin]);

  const loadStatuses = useCallback(async () => {
    if (!authChecked || !isAuthenticated) return;
    setLoadingFacets(true);
    setError('');
    try {
      const jql = `project = ${PROJECT_KEY} AND issuetype = "${ISSUE_TYPE}"`;
      const params = new URLSearchParams({
        jql,
        distinct: 'status',
        fields: 'status',
        scanLimit: '1200',
      });
      const response = await fetch(`/api/jira/query?${params.toString()}`);
      if (response.status === 401) {
        redirectToLogin();
        return;
      }
      const data = response.ok ? await response.json() : null;
      if (!response.ok) {
        setStatuses([]);
        setError(data?.error || 'Failed to load status filters');
        return;
      }
      setStatuses(Array.isArray(data?.statuses) ? data.statuses : []);
    } catch (err) {
      setStatuses([]);
      setError('Failed to load status filters');
    } finally {
      setLoadingFacets(false);
    }
  }, [authChecked, isAuthenticated, redirectToLogin]);

  const loadInitiatives = useCallback(async () => {
    if (!authChecked || !isAuthenticated) return;
    setLoading(true);
    setError('');
    try {
      const conditions = [
        `project = ${PROJECT_KEY}`,
        `issuetype = "${ISSUE_TYPE}"`,
      ];
      if (selectedStatus) {
        conditions.push(`status = "${escapeJqlValue(selectedStatus)}"`);
      }
      if (priorityValue) {
        conditions.push(`priority = "${escapeJqlValue(priorityValue)}"`);
      }
      if (ragValue) {
        conditions.push(`"RAG Status" = "${escapeJqlValue(ragValue)}"`);
      }
      const aggregated = [];
      let nextPageToken = null;
      let startAt = 0;
      let hasMore = true;

      while (hasMore && aggregated.length < MAX_INITIATIVES) {
        const params = new URLSearchParams({
          jql: conditions.join(' AND '),
          fields: `summary,status,priority,duedate,project,issuetype,${RAG_FIELD_ID}`,
          maxResults: String(PAGE_SIZE),
        });
        if (nextPageToken) {
          params.set('nextPageToken', nextPageToken);
        } else {
          params.set('startAt', String(startAt));
        }

        const response = await fetch(`/api/jira/query?${params.toString()}`);
        if (response.status === 401) {
          redirectToLogin();
          return;
        }
        const data = response.ok ? await response.json() : null;
        if (!response.ok) {
          setInitiatives([]);
          setError(data?.error || 'Failed to load initiatives');
          return;
        }

        const batch = Array.isArray(data?.issues) ? data.issues : [];
        aggregated.push(...batch);
        nextPageToken = data?.nextPageToken || null;
        startAt = (Number.isFinite(data?.startAt) ? data.startAt : startAt) + batch.length;
        hasMore = Boolean(data?.hasMore || nextPageToken);
        if (batch.length === 0) {
          hasMore = false;
        }
      }

      setInitiatives(aggregated.slice(0, MAX_INITIATIVES));
    } catch (err) {
      setInitiatives([]);
      setError('Failed to load initiatives');
    } finally {
      setLoading(false);
    }
  }, [authChecked, isAuthenticated, selectedStatus, ragValue, priorityValue, redirectToLogin]);

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  useEffect(() => {
    loadStatuses();
  }, [loadStatuses]);

  useEffect(() => {
    loadInitiatives();
  }, [loadInitiatives]);

  const statusOptions = useMemo(
    () =>
      statuses
        .map((status) => ({
          name: typeof status === 'string' ? status : status?.name,
          count: typeof status === 'object' ? status?.count : null,
        }))
        .filter((status) => status.name),
    [statuses]
  );

  if (!authChecked) {
    return (
      <div className={`app-page ${styles.container}`}>
        <div className={`app-pageContent app-pageContent--full ${styles.content}`}>
          <div className={styles.loading}>Checking Jira connection...</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`app-page ${styles.container}`}>
      <div className={`app-pageContent app-pageContent--full ${styles.content}`}>
        <div className="app-pageHeader">
          <div className="app-titleSection">
            <RiFlag2Line className="app-pageIcon" />
            <h1 className="app-pageTitle">Initiatives</h1>
            <span className="app-pageCount">{initiatives.length}</span>
          </div>
          <div className={styles.filtersRow}>
            <div className={styles.filterBlock}>
              <label className="app-headerLabel" htmlFor="initiativeStatus">
                Status
              </label>
              <select
                id="initiativeStatus"
                className="app-headerSelect"
                value={selectedStatus}
                onChange={(event) => setSelectedStatus(event.target.value)}
                disabled={loadingFacets}
              >
                <option value="">{loadingFacets ? 'Loading statuses...' : 'All Statuses'}</option>
                {statusOptions.map((status) => (
                  <option key={status.name} value={status.name}>
                    {status.count != null ? `${status.name} (${status.count})` : status.name}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.filterBlock}>
              <span className="app-headerLabel">Priority</span>
              <div
                className={`app-filterSwitcher ${styles.prioritySwitcher}`}
                role="group"
                aria-label="Priority filter"
              >
                <div
                  className={`app-filterThumb ${styles.priorityThumb}`}
                  style={{ left: `calc(6px + ${priorityIndex * 16.6667}%)` }}
                  aria-hidden="true"
                />
                {PRIORITY_OPTIONS.map((option, index) => (
                  <button
                    key={option.label}
                    type="button"
                    className={`app-filterButton ${styles.priorityButton} ${
                      priorityIndex === index ? 'app-filterButtonActive' : ''
                    }`}
                    onClick={() => setPriorityIndex(index)}
                    aria-pressed={priorityIndex === index}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.filterBlock}>
              <span className="app-headerLabel">RAG Status</span>
              <div className={`app-filterSwitcher ${styles.ragSwitcher}`} role="group" aria-label="RAG filter">
                <div
                  className={`app-filterThumb ${styles.ragThumb}`}
                  style={{ left: `calc(6px + ${ragIndex * 25}%)` }}
                  aria-hidden="true"
                />
                {RAG_OPTIONS.map((option, index) => (
                  <button
                    key={option.label}
                    type="button"
                    className={`app-filterButton ${styles.ragButton} ${
                      ragIndex === index ? 'app-filterButtonActive' : ''
                    }`}
                    onClick={() => setRagIndex(index)}
                    aria-pressed={ragIndex === index}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        {loading ? (
          <div className={styles.loading}>Loading initiatives...</div>
        ) : initiatives.length === 0 ? (
          <div className={styles.emptyState}>No initiatives found</div>
        ) : (
          <div className={styles.cards}>
            {initiatives.map((initiative) => (
              <InitiativeCard
                key={initiative.key}
                initiative={initiative}
                jiraSiteUrl={jiraSiteUrl}
                ragFieldId={RAG_FIELD_ID}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
