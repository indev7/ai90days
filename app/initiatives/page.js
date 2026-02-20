'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { RiFlag2Line } from 'react-icons/ri';
import InitiativeCard from '@/components/InitiativeCard';
import useMainTreeStore from '@/store/mainTreeStore';
import styles from './page.module.css';

const JIRA_BASE_URL = String(process.env.NEXT_PUBLIC_JIRA_BASE_URL || '').replace(/\/+$/, '');
const PROJECT_KEY = 'PM';
const ISSUE_TYPE = 'Initiative';
const RAG_FIELD_ID = 'customfield_11331';
const MAX_INITIATIVES = 300;
const PAGE_SIZE = 100;

const RAG_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'Green', label: 'Green' },
  { value: 'Amber', label: 'Amber' },
  { value: 'Red', label: 'Red' },
];

const PRIORITY_OPTIONS = [
  { value: '', label: 'All Priorities' },
  { value: 'Highest', label: 'Highest' },
  { value: 'High', label: 'High' },
  { value: 'Medium', label: 'Medium' },
  { value: 'Low', label: 'Low' },
  { value: 'Lowest', label: 'Lowest' },
];

function extractRagValue(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    const first = value.find(Boolean);
    return extractRagValue(first);
  }
  if (typeof value === 'object') {
    if (value.value !== undefined) return extractRagValue(value.value);
    if (value.name !== undefined) return extractRagValue(value.name);
    if (value.label !== undefined) return extractRagValue(value.label);
    if (value.status !== undefined) return extractRagValue(value.status);
    return '';
  }
  return String(value);
}

function escapeJqlValue(value) {
  return (value || '').replace(/["\\]/g, '').trim();
}

function normalizeRagValue(value) {
  return (value || '').toString().trim().toLowerCase();
}

function matchesRagFilter(rawValue, selected) {
  if (!selected) return true;
  const normalized = normalizeRagValue(extractRagValue(rawValue));
  if (!normalized) return false;
  if (selected === 'amber') {
    return normalized.includes('amber') || normalized.includes('yellow');
  }
  if (selected === 'green') {
    return normalized.includes('green');
  }
  if (selected === 'red') {
    return normalized.includes('red');
  }
  return normalized === selected;
}

export default function InitiativesPage() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [jiraSiteUrl, setJiraSiteUrl] = useState('');
  const [statuses, setStatuses] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('');
  const [ragIndex, setRagIndex] = useState(0);
  const [initiatives, setInitiatives] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingFacets, setLoadingFacets] = useState(false);
  const [error, setError] = useState('');
  const [forceInitiativesRefresh, setForceInitiativesRefresh] = useState(false);
  const setInitiativesInStore = useMainTreeStore((state) => state.setInitiatives);
  const storedInitiatives = useMainTreeStore((state) => state.mainTree.initiatives) || [];
  const initiativesLoaded = useMainTreeStore((state) => state.sectionStates?.initiatives?.loaded);

  const ragValue = RAG_OPTIONS[ragIndex]?.value ?? '';
  const normalizedRagValue = normalizeRagValue(ragValue);
  const priorityValue = selectedPriority;

  const redirectToLogin = useCallback(() => {
    window.location.href = '/api/jira/auth/login?returnTo=/initiatives';
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
    if (initiativesLoaded && storedInitiatives.length > 0) {
      const counts = new Map();
      storedInitiatives.forEach((initiative) => {
        const name = initiative?.status;
        if (!name) return;
        counts.set(name, (counts.get(name) || 0) + 1);
      });
      const derivedStatuses = Array.from(counts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => a.name.localeCompare(b.name));
      setStatuses(derivedStatuses);
      return;
    }
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

      const trimmed = aggregated.slice(0, MAX_INITIATIVES);
      const deduped = [];
      const seenKeys = new Set();
      for (const issue of trimmed) {
        const key = issue?.key;
        if (!key || seenKeys.has(key)) continue;
        seenKeys.add(key);
        deduped.push(issue);
      }
      setInitiatives(deduped);
      if (!selectedStatus && !priorityValue && !ragValue) {
        setInitiativesInStore(deduped);
      }
      if (forceInitiativesRefresh) {
        setForceInitiativesRefresh(false);
        window.history.replaceState({}, '', '/initiatives');
      }
    } catch (err) {
      setInitiatives([]);
      setError('Failed to load initiatives');
    } finally {
      setLoading(false);
    }
  }, [
    authChecked,
    isAuthenticated,
    selectedStatus,
    ragValue,
    priorityValue,
    redirectToLogin,
    setInitiativesInStore,
    forceInitiativesRefresh
  ]);

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  useEffect(() => {
    if (initiativesLoaded && storedInitiatives.length > 0) {
      const counts = new Map();
      storedInitiatives.forEach((initiative) => {
        const name = initiative?.status;
        if (!name) return;
        counts.set(name, (counts.get(name) || 0) + 1);
      });
      const derivedStatuses = Array.from(counts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => a.name.localeCompare(b.name));
      setStatuses(derivedStatuses);
      return;
    }
    loadStatuses();
  }, [loadStatuses, initiativesLoaded, storedInitiatives]);

  useEffect(() => {
    if (initiativesLoaded && !forceInitiativesRefresh) return;
    loadInitiatives();
  }, [loadInitiatives, initiativesLoaded, forceInitiativesRefresh]);

  useEffect(() => {
    if (!authChecked || !isAuthenticated) return;
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('success')) {
      setForceInitiativesRefresh(true);
    }
  }, [authChecked, isAuthenticated]);

  useEffect(() => {
    if (!initiativesLoaded || storedInitiatives.length === 0) return;
    const filtered = storedInitiatives.filter((initiative) => {
      if (selectedStatus && initiative.status !== selectedStatus) {
        return false;
      }
      if (priorityValue && initiative.priority !== priorityValue) {
        return false;
      }
      if (normalizedRagValue) {
        if (!matchesRagFilter(initiative?.customFields?.[RAG_FIELD_ID], normalizedRagValue)) {
          return false;
        }
      }
      return true;
    });
    const deduped = [];
    const seenKeys = new Set();
    for (const issue of filtered) {
      const key = issue?.key;
      if (!key || seenKeys.has(key)) continue;
      seenKeys.add(key);
      deduped.push(issue);
    }
    setInitiatives(deduped);
  }, [storedInitiatives, initiativesLoaded, selectedStatus, priorityValue, normalizedRagValue]);

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
              <label className="app-headerLabel" htmlFor="initiativePriority">
                Priority
              </label>
              <select
                id="initiativePriority"
                className="app-headerSelect"
                value={selectedPriority}
                onChange={(event) => setSelectedPriority(event.target.value)}
              >
                {PRIORITY_OPTIONS.map((option) => (
                  <option key={option.label} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
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
