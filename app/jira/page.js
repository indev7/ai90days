'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { SiJira } from 'react-icons/si';
import { HiOutlineRefresh } from 'react-icons/hi';
import Pagination from '@/components/Pagination';
import { getThemeColorPalette } from '@/lib/clockUtils';
import styles from './page.module.css';

const JIRA_BASE_URL = String(process.env.NEXT_PUBLIC_JIRA_BASE_URL || '').replace(/\/+$/, '');

// Generate consistent color for each project using dashboard clock colors
function getProjectColor(projectIndex) {
  const colors = getThemeColorPalette();
  return colors[projectIndex % colors.length];
}

// Get status category class based on status text
function getStatusClass(status) {
  const statusLower = status?.toLowerCase() || '';

  // Cancelled/Canceled
  if (statusLower.includes('cancel')) {
    return 'cancelled';
  }

  // Done/Complete
  if (statusLower.includes('done') || statusLower.includes('complete') || statusLower.includes('closed') || statusLower.includes('resolved')) {
    return 'done';
  }

  // In Progress
  if (statusLower.includes('progress') || statusLower.includes('development') || statusLower.includes('review')) {
    return 'inprogress';
  }

  // Default (New/Todo)
  return 'todo';
}

function escapeJqlValue(value) {
  return (value || '').replace(/["\\]/g, '').trim();
}

export default function JiraPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [issueTypes, setIssueTypes] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [loadingFacets, setLoadingFacets] = useState(false);
  const [facetsLoadedProject, setFacetsLoadedProject] = useState('');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [jiraSiteUrl, setJiraSiteUrl] = useState('');
  const [filters, setFilters] = useState({
    project: '',
    issueType: '',
    status: '',
  });
  const [pagination, setPagination] = useState({
    currentPage: 1,
    pageSize: 20,
    total: 0,
  });
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const latestProjectsRequestRef = useRef(0);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/api/jira/auth/status');
      const data = await response.json();
      setIsAuthenticated(data.authenticated);

      // Store Jira site URL if available
      if (data.siteUrl) {
        setJiraSiteUrl(String(data.siteUrl).replace(/\/+$/, ''));
      } else if (JIRA_BASE_URL) {
        setJiraSiteUrl(JIRA_BASE_URL);
      } else if (data.cloudId) {
        setJiraSiteUrl(`https://${data.cloudId}.atlassian.net`);
      }

      // Check for URL parameters
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('success')) {
        setError('');
        window.history.replaceState({}, '', '/jira');
      } else if (urlParams.get('error')) {
        setError('Authentication failed. Please try again.');
      }
    } catch (err) {
      setError('Failed to check authentication status');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = () => {
    window.location.href = '/api/jira/auth/login';
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/jira/auth/logout', { method: 'POST' });
      setIsAuthenticated(false);
      setTickets([]);
      setProjects([]);
      setIssueTypes([]);
      setStatuses([]);
      setSelectedTicket(null);
    } catch (err) {
      setError('Failed to logout');
    }
  };

  const loadProjects = useCallback(async () => {
    const requestId = Date.now();
    latestProjectsRequestRef.current = requestId;
    setLoadingProjects(true);

    const fetchProjects = async (query) => {
      const response = await fetch(query);
      const data = response.ok ? await response.json() : null;
      return { response, data };
    };

    try {
      let loadedProjects = [];

      for (let attempt = 0; attempt < 2; attempt++) {
        const projectQuery = new URLSearchParams({
          jql: 'assignee = currentUser()',
          distinct: 'project',
          fields: 'project',
          scanLimit: '800',
        });
        const { response, data } = await fetchProjects(`/api/jira/query?${projectQuery.toString()}`);
        if (response.ok && data) {
          loadedProjects = data.projects || [];
          break;
        }
        if (response.status === 401) {
          setIsAuthenticated(false);
          return;
        }
      }

      if (latestProjectsRequestRef.current !== requestId) {
        return;
      }

      setProjects(loadedProjects);
      setFilters(prev => (prev.project || loadedProjects.length === 0
        ? prev
        : { ...prev, project: loadedProjects[0].key }));

      if (loadedProjects.length === 0) {
        setError('No Jira projects found for this account.');
      } else {
        setError('');
      }
    } catch (err) {
      if (latestProjectsRequestRef.current === requestId) {
        setError('Failed to load projects');
      }
    } finally {
      if (latestProjectsRequestRef.current === requestId) {
        setLoadingProjects(false);
      }
    }
  }, []);

  const loadTickets = useCallback(async () => {
    if (!filters.project) {
      setTickets([]);
      setPagination(prev => ({ ...prev, total: 0 }));
      setLoadingTickets(false);
      return;
    }

    setLoadingTickets(true);
    try {
      const conditions = ['assignee = currentUser()'];
      if (filters.project) conditions.push(`project = ${escapeJqlValue(filters.project)}`);
      if (filters.issueType) conditions.push(`issuetype = "${escapeJqlValue(filters.issueType)}"`);
      if (filters.status) conditions.push(`status = "${escapeJqlValue(filters.status)}"`);
      const jql = `${conditions.join(' AND ')} ORDER BY updated DESC`;

      const params = new URLSearchParams({
        jql,
        fields: 'summary,status,assignee,reporter,priority,issuetype,project,created,updated,labels,description',
        maxResults: pagination.pageSize.toString(),
        startAt: ((pagination.currentPage - 1) * pagination.pageSize).toString(),
      });

      const response = await fetch(`/api/jira/query?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setTickets(data.issues);
        setPagination(prev => ({ ...prev, total: data.total || 0 }));
        setError(''); // Clear any previous errors
      } else if (response.status === 401) {
        setIsAuthenticated(false);
        setError('Authentication expired. Please reconnect to Jira.');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to load tickets');
      }
    } catch (err) {
      setError('Failed to load tickets');
    } finally {
      setLoadingTickets(false);
    }
  }, [filters.project, filters.issueType, filters.status, pagination.pageSize, pagination.currentPage]);

  const loadProjectFacets = useCallback(async () => {
    if (!filters.project) {
      setIssueTypes([]);
      setStatuses([]);
      setFacetsLoadedProject('');
      return;
    }

    const currentProject = filters.project;
    const safeProject = escapeJqlValue(currentProject);
    const jql = `project = ${safeProject} AND assignee = currentUser()`;
    setLoadingFacets(true);
    try {
      const issueTypeParams = new URLSearchParams({
        jql,
        distinct: 'issuetype',
        fields: 'issuetype',
        scanLimit: '1200',
      });
      const statusParams = new URLSearchParams({
        jql,
        distinct: 'status',
        fields: 'status',
        scanLimit: '1200',
      });
      const [issueTypeResponse, statusResponse] = await Promise.all([
        fetch(`/api/jira/query?${issueTypeParams.toString()}`),
        fetch(`/api/jira/query?${statusParams.toString()}`),
      ]);

      if (issueTypeResponse.ok) {
        const data = await issueTypeResponse.json();
        setIssueTypes(data.issueTypes || []);
      } else {
        setIssueTypes([]);
      }

      if (statusResponse.ok) {
        const data = await statusResponse.json();
        setStatuses(data.statuses || []);
      } else {
        setStatuses([]);
      }
    } catch (err) {
      setIssueTypes([]);
      setStatuses([]);
      setError('Failed to load issue type/status filters');
    } finally {
      setLoadingFacets(false);
      setFacetsLoadedProject(currentProject);
    }
  }, [filters.project]);

  // Check authentication status
  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Load projects when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadProjects();
    }
  }, [isAuthenticated, loadProjects]);

  // Load tickets when filters or pagination change
  useEffect(() => {
    if (isAuthenticated && filters.project && facetsLoadedProject === filters.project) {
      loadTickets();
    }
  }, [isAuthenticated, filters.project, facetsLoadedProject, loadTickets]);

  useEffect(() => {
    if (isAuthenticated) {
      loadProjectFacets();
    }
  }, [isAuthenticated, filters.project, loadProjectFacets]);

  // Group tickets by project
  const groupedTickets = useMemo(() => {
    const groups = {};
    const projectKeys = [];

    // First pass: collect unique project keys in order of appearance
    tickets.forEach(ticket => {
      const projectKey = ticket.project?.key || ticket.key.split('-')[0];
      if (!groups[projectKey]) {
        projectKeys.push(projectKey);
        groups[projectKey] = {
          projectKey,
          projectName: ticket.project?.name || projectKey,
          tickets: []
        };
      }
      groups[projectKey].tickets.push(ticket);
    });

    // Second pass: assign colors sequentially
    return projectKeys.map((projectKey, index) => ({
      ...groups[projectKey],
      color: getProjectColor(index)
    }));
  }, [tickets]);

  const handleRefresh = () => {
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    loadTickets();
  };

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, currentPage: newPage }));
  };

  const totalPages = Math.ceil(pagination.total / pagination.pageSize);

  const handleTicketClick = useCallback((ticket) => {
    setSelectedTicket(ticket);
  }, []);

  const handleTicketKeyClick = (ticketKey, event) => {
    event.stopPropagation();
    const baseUrl = jiraSiteUrl || JIRA_BASE_URL;
    if (!baseUrl) return;
    window.open(`${baseUrl}/browse/${ticketKey}`, '_blank');
  };

  const handleUpdateTicket = async (ticketKey, updates) => {
    try {
      console.log('Updating ticket:', ticketKey, 'with data:', updates);
      const response = await fetch(`/api/jira/tickets/${ticketKey}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        const updated = await response.json();
        setSelectedTicket(updated);
        loadTickets(); // Refresh list
      } else {
        const errorData = await response.json();
        console.error('Update failed:', errorData);
        setError(`Failed to update ticket: ${errorData.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Update error:', err);
      setError('Failed to update ticket');
    }
  };

  const handleTransition = async (ticketKey, status) => {
    try {
      const response = await fetch(`/api/jira/tickets/${ticketKey}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        loadTickets();
        // Refresh the selected ticket details if it's currently open
        if (selectedTicket?.key === ticketKey) {
          const ticketParams = new URLSearchParams({
            jql: `key = ${escapeJqlValue(ticketKey)}`,
            fields: 'summary,status,assignee,reporter,priority,issuetype,project,created,updated,labels,description',
            maxResults: '1',
            startAt: '0',
          });
          const ticketResponse = await fetch(`/api/jira/query?${ticketParams.toString()}`);
          if (ticketResponse.ok) {
            const updatedTicketData = await ticketResponse.json();
            const updatedTicket = updatedTicketData.issues?.[0] || null;
            if (updatedTicket) {
              setSelectedTicket(updatedTicket);
            }
          }
        }
      }
    } catch (err) {
      setError('Failed to update ticket status');
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.main}>
          <div className={styles.loading}>Loading...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className={styles.container}>
        <div className={styles.main}>
          <div className={styles.authPrompt}>
            <h1>Jira Integration</h1>
            <p>Connect your Jira account to view and manage your tickets</p>
            {error && <div className={styles.error}>{error}</div>}
            <button onClick={handleLogin} className={styles.loginButton}>
              Connect to Jira
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.main}>
        <div className={styles.header}>
          <div className={styles.titleSection}>
            <SiJira className={styles.pageIcon} />
            <h1>Jira Tickets</h1>
          </div>
          <div className={styles.headerActions}>
            <button
              onClick={handleRefresh}
              className={styles.refreshButton}
              disabled={loadingTickets}
              title="Refresh tickets"
            >
              {loadingTickets ? <span className={styles.spinner}></span> : <HiOutlineRefresh />}
            </button>
            <button onClick={() => setShowCreateModal(true)} className={styles.createButton}>
              Create Ticket
            </button>
            <button onClick={handleLogout} className={styles.logoutButton}>
              Disconnect
            </button>
          </div>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.filters}>
          <select
            value={filters.project}
            onChange={(e) => {
              setFacetsLoadedProject('');
              setFilters({ ...filters, project: e.target.value, issueType: '', status: '' });
              setPagination(prev => ({ ...prev, currentPage: 1 }));
            }}
            className={styles.filterSelect}
            disabled={loadingProjects}
          >
            <option value="">{loadingProjects ? 'Loading projects...' : 'Select Project'}</option>
            {projects.map(project => (
              <option key={project.key} value={project.key}>
                {project.name}
              </option>
            ))}
          </select>

          <select
            value={filters.issueType}
            onChange={(e) => {
              setFilters({ ...filters, issueType: e.target.value });
              setPagination(prev => ({ ...prev, currentPage: 1 }));
            }}
            className={styles.filterSelect}
            disabled={!filters.project}
          >
            <option value="">All Issue Types</option>
            {issueTypes.map((type) => {
              const typeName = typeof type === 'string' ? type : type?.name;
              if (!typeName) return null;
              const typeLabel =
                typeof type === 'object' && type?.count != null
                  ? `${typeName} (${type.count})`
                  : typeName;
              return (
                <option key={typeName} value={typeName}>
                  {typeLabel}
                </option>
              );
            })}
          </select>

          <select
            value={filters.status}
            onChange={(e) => {
              setFilters({ ...filters, status: e.target.value });
              setPagination(prev => ({ ...prev, currentPage: 1 }));
            }}
            className={styles.filterSelect}
            disabled={!filters.project}
          >
            <option value="">All Statuses</option>
            {statuses.map((status) => {
              const statusName = typeof status === 'string' ? status : status?.name;
              if (!statusName) return null;
              const statusLabel =
                typeof status === 'object' && status?.count != null
                  ? `${statusName} (${status.count})`
                  : statusName;
              return (
                <option key={statusName} value={statusName}>
                  {statusLabel}
                </option>
              );
            })}
          </select>
        </div>

        <div className={styles.content}>
          <div className={styles.ticketListWrapper}>
            <div className={styles.ticketGroups}>
              {loadingTickets ? (
                <LoadingSkeleton />
              ) : !filters.project ? (
                <div className={styles.emptyState}>Select a project to view tickets</div>
              ) : loadingFacets || facetsLoadedProject !== filters.project ? (
                <div className={styles.emptyState}>Loading issue type and status filters...</div>
              ) : tickets.length === 0 ? (
                <div className={styles.emptyState}>No tickets found</div>
              ) : (
                groupedTickets.map(group => (
                  <div key={group.projectKey} className={styles.projectGroup}>
                    <div className={styles.projectHeader} style={{ borderLeftColor: group.color }}>
                      <div className={styles.projectInfo}>
                        <div className={styles.projectColor} style={{ backgroundColor: group.color }}></div>
                        <h2 className={styles.projectName}>{group.projectName}</h2>
                        <span className={styles.projectCount}>({group.tickets.length})</span>
                      </div>
                    </div>
                    <div className={styles.ticketList}>
                      {group.tickets.map(ticket => (
                        <div
                          key={ticket.key}
                          className={styles.ticketCard}
                          style={{ borderColor: group.color, '--project-color': group.color }}
                          onClick={() => handleTicketClick(ticket)}
                        >
                          <span className={styles.projectMarker} aria-hidden="true" />
                          <div className={styles.ticketHeader}>
                            <span
                              className={styles.ticketKey}
                              onClick={(e) => handleTicketKeyClick(ticket.key, e)}
                              title="Click to open in Jira"
                            >
                              {ticket.key}
                            </span>
                          </div>
                          <h3 className={styles.ticketSummary}>
                            {ticket.summary}
                          </h3>
                          <div className={styles.ticketMeta}>
                            <span className={`${styles.ticketStatus} ${styles[getStatusClass(ticket.status)]}`}>
                              {ticket.status}
                            </span>
                            <span className={styles.ticketType}>{ticket.issueType}</span>
                            <span className={styles.ticketPriority}>{ticket.priority}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
            <Pagination
              currentPage={pagination.currentPage}
              totalPages={totalPages}
              totalItems={pagination.total}
              onPageChange={handlePageChange}
              itemName="tickets"
              loading={loadingTickets}
            />
          </div>

          {selectedTicket && (
            <>
              <div
                className={styles.ticketDetailBackdrop}
                onClick={() => setSelectedTicket(null)}
              />
              <div className={styles.ticketDetail}>
                <TicketDetail
                  ticket={selectedTicket}
                  jiraSiteUrl={jiraSiteUrl}
                  onUpdate={handleUpdateTicket}
                  onTransition={handleTransition}
                  onClose={() => setSelectedTicket(null)}
                />
              </div>
            </>
          )}
        </div>

        {showCreateModal && (
          <CreateTicketModal
            projects={projects}
            onClose={() => setShowCreateModal(false)}
            onCreated={() => {
              setShowCreateModal(false);
              loadTickets();
            }}
          />
        )}
      </div>
    </div>
  );
}

function TicketDetail({ ticket, jiraSiteUrl, onUpdate, onTransition, onClose }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    summary: ticket.summary,
    description: ticket.description,
    status: ticket.status,
    startDate: '',
    days: '',
  });
  const [availableTransitions, setAvailableTransitions] = useState([]);
  const [loadingTransitions, setLoadingTransitions] = useState(false);
  const isLeaveTicket = ticket.project.name?.toLowerCase().includes('leave');
  // Use actual permissions from ticket if available, otherwise default to true (assume user can edit)
  const canEditLeaveTicket = ticket.permissions?.canEdit !== false;

  // Fetch available transitions and extract custom fields when component mounts
  useEffect(() => {
    const fetchTransitions = async () => {
      setLoadingTransitions(true);
      try {
        const response = await fetch(`/api/jira/tickets/${ticket.key}/transitions`);
        if (response.ok) {
          const data = await response.json();
          setAvailableTransitions(data.transitions || []);
        }
      } catch (err) {
        console.error('Failed to load transitions:', err);
      } finally {
        setLoadingTransitions(false);
      }
    };

    // Extract custom fields for leave tickets
    if (isLeaveTicket && ticket.customFields) {
      let startDate = '';
      let days = '';

      Object.entries(ticket.customFields).forEach(([key, value]) => {
        // Check for date fields
        if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
          startDate = value.split('T')[0];
        }
        // Check for number fields (days)
        if (typeof value === 'number' && value > 0 && value < 1000) {
          days = value.toString();
        }
      });

      setEditData(prev => ({ ...prev, startDate, days }));
    }

    fetchTransitions();
  }, [ticket.key, ticket.customFields, isLeaveTicket]);

  const handleSave = () => {
    const updates = {};

    // Only add summary and description if they changed (and not for subtasks)
    if (editData.summary !== ticket.summary && ticket.issueType !== 'Leave-Request') {
      updates.summary = editData.summary;
    }
    if (editData.description !== ticket.description && ticket.issueType !== 'Leave-Request') {
      updates.description = editData.description;
    }

    // If status changed, trigger transition
    if (editData.status !== ticket.status) {
      onTransition(ticket.key, editData.status);
    }

    // Add custom fields if they changed (for leave tickets)
    if (isLeaveTicket && (editData.startDate || editData.days)) {
      updates.customFields = {};

      // Find the custom field IDs from original ticket
      if (ticket.customFields) {
        Object.entries(ticket.customFields).forEach(([key, value]) => {
          if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/) && editData.startDate) {
            updates.customFields[key] = editData.startDate;
          }
          if (typeof value === 'number' && editData.days) {
            updates.customFields[key] = parseFloat(editData.days);
          }
        });
      }
    }

    // Only call update if there are fields to update
    if (Object.keys(updates).length > 0) {
      onUpdate(ticket.key, updates);
    }
    setIsEditing(false);
  };

  const openInJira = () => {
    if (jiraSiteUrl) {
      window.open(`${jiraSiteUrl}/browse/${ticket.key}`, '_blank');
    }
  };

  return (
    <div className={styles.detailContainer}>
      <div className={styles.detailHeader}>
        <h2
          onClick={openInJira}
          style={{ cursor: jiraSiteUrl ? 'pointer' : 'default' }}
          title={jiraSiteUrl ? 'Click to open in Jira' : ''}
        >
          {ticket.key}
        </h2>
        <button onClick={onClose} className={styles.closeButton}>×</button>
      </div>

      {isEditing ? (
        <div className={styles.editForm}>
          <div className={styles.formGroup}>
            <label>Summary</label>
            <input
              type="text"
              value={editData.summary}
              onChange={(e) => setEditData({ ...editData, summary: e.target.value })}
              className={styles.editInput}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Description</label>
            <textarea
              value={editData.description}
              onChange={(e) => setEditData({ ...editData, description: e.target.value })}
              className={styles.editTextarea}
              rows={6}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Status</label>
            <select
              value={editData.status}
              onChange={(e) => setEditData({ ...editData, status: e.target.value })}
              className={styles.editInput}
              disabled={loadingTransitions || availableTransitions.length === 0}
            >
              <option value={ticket.status}>{ticket.status}</option>
              {availableTransitions.map(transition => (
                transition.to.name !== ticket.status && (
                  <option key={transition.id} value={transition.to.name}>
                    {transition.to.name}
                  </option>
                )
              ))}
            </select>
          </div>

          {isLeaveTicket && (
            <>
              <div className={styles.formGroup}>
                <label>Start Date</label>
                <input
                  type="date"
                  value={editData.startDate}
                  onChange={(e) => setEditData({ ...editData, startDate: e.target.value })}
                  className={styles.editInput}
                />
              </div>

              <div className={styles.formGroup}>
                <label>Days</label>
                <input
                  type="number"
                  value={editData.days}
                  onChange={(e) => setEditData({ ...editData, days: e.target.value })}
                  className={styles.editInput}
                  step="0.5"
                  min="0"
                />
              </div>
            </>
          )}

          <div className={styles.editActions}>
            <button onClick={handleSave} className={styles.saveButton}>Save</button>
            <button onClick={() => setIsEditing(false)} className={styles.cancelButton}>Cancel</button>
          </div>
        </div>
      ) : (
        <>
          <h3 className={styles.detailSummary}>{ticket.summary}</h3>
          <div className={styles.detailInfo}>
            <div className={styles.infoRow}>
              <strong>Status:</strong>
              <span className={`${styles.statusBadge} ${styles[ticket.statusCategory?.toLowerCase()]}`}>
                {ticket.status}
              </span>
            </div>
            <div className={styles.infoRow}>
              <strong>Type:</strong> {ticket.issueType}
            </div>
            <div className={styles.infoRow}>
              <strong>Priority:</strong> {ticket.priority}
            </div>
            <div className={styles.infoRow}>
              <strong>Project:</strong> {ticket.project.name}
            </div>
            {ticket.assignee && (
              <div className={styles.infoRow}>
                <strong>Assignee:</strong> {ticket.assignee.displayName}
              </div>
            )}
          </div>

          <div className={styles.description}>
            <strong>Description:</strong>
            <p>{ticket.description || 'No description'}</p>
          </div>

          <div className={styles.actions}>
            {canEditLeaveTicket ? (
              <button onClick={() => setIsEditing(true)} className={styles.editButton}>
                Edit
              </button>
            ) : (
              <div className={styles.infoMessage}>
                View only - No edit permission for this project
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function CreateTicketModal({ projects, onClose, onCreated }) {
  const [formData, setFormData] = useState({
    project: projects[0]?.key || '',
    summary: '',
    description: '',
    issueType: 'Task',
    priority: 'Medium',
    leaveType: `Medical Leave ${new Date().getFullYear()}`,
    startDate: new Date().toISOString().split('T')[0],
    days: 1,
    allocation: 1,
    parentIssue: '',
  });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [projectFields, setProjectFields] = useState(null);
  const [loadingFields, setLoadingFields] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [loadingPending, setLoadingPending] = useState(false);
  const [parentIssues, setParentIssues] = useState([]);
  const [loadingParents, setLoadingParents] = useState(false);

  // Check if selected project is a leave project
  const selectedProject = projects.find(p => p.key === formData.project);
  const isLeaveProject = selectedProject?.name?.toLowerCase().includes('leave');

  // Fetch custom fields when leave project is selected
  useEffect(() => {
    if (isLeaveProject && formData.project) {
      setLoadingFields(true);
      // Use Leave-Request for leave projects
      fetch(`/api/jira/projects/${formData.project}/fields?issueType=Leave-Request`)
        .then(res => res.json())
        .then(data => {
          if (data.error && data.availableTypes) {
            // Task doesn't exist, try available types in order
            // Try "Entitlement" first (more likely to have create permission than "Leave Summary")
            const typesToTry = ['Entitlement', 'Leave Summary'];
            const typeToUse = typesToTry.find(t => data.availableTypes.includes(t)) || data.availableTypes[0];

            if (typeToUse) {
              // Fetch again with correct issue type
              return fetch(`/api/jira/projects/${formData.project}/fields?issueType=${encodeURIComponent(typeToUse)}`)
                .then(res => res.json());
            }
          }
          return data;
        })
        .then(data => {
          setProjectFields(data);
          // Update form data with correct issue type (including subtasks for leave requests)
          if (data.issueType) {
            setFormData(prev => ({ ...prev, issueType: data.issueType }));
          }
          setLoadingFields(false);
        })
        .catch(err => {
          console.error('Failed to load project fields:', err);
          setLoadingFields(false);
        });
    }
  }, [formData.project, isLeaveProject]);

  // Fetch parent issues (leave type issues like "Casual Leave 2025") when leave project is selected
  useEffect(() => {
    if (isLeaveProject && formData.project) {
      setLoadingParents(true);
      // Fetch issues that can be parents (Entitlement type with leave options)
      const parentJql = `project = ${escapeJqlValue(formData.project)} ORDER BY updated DESC`;
      const parentParams = new URLSearchParams({
        jql: parentJql,
        fields: 'summary,issuetype,project,status',
        maxResults: '100',
        startAt: '0',
      });
      fetch(`/api/jira/query?${parentParams.toString()}`)
        .then(res => res.json())
        .then(data => {
          if (data.error) {
            setParentIssues([]);
            setLoadingParents(false);
            return;
          }
          // Filter for parent leave type issues (Entitlement type)
          const allIssues = data.issues || [];
          const currentYear = new Date().getFullYear();

          const parents = allIssues.filter(ticket => {
            // Only show Entitlement type with current year in summary
            if (ticket.issueType !== 'Entitlement') {
              return false;
            }
            const summary = ticket.summary || '';
            // Exclude "create" entries and only show current year
            return summary.includes(String(currentYear)) &&
              !summary.toLowerCase().includes('create');
          });
          setParentIssues(parents);
          setLoadingParents(false);
        })
        .catch(err => {
          console.error('Failed to load parent issues:', err);
          setParentIssues([]);
          setLoadingParents(false);
        });
    }
  }, [formData.project, isLeaveProject]);

  // Fetch pending leave count when leave project or parent issue is selected
  useEffect(() => {
    if (isLeaveProject && formData.project && formData.parentIssue) {
      setLoadingPending(true);
      // Use parent issue key to get accurate count
      fetch(`/api/jira/leaves/pending?projectKey=${formData.project}&parentKey=${formData.parentIssue}`)
        .then(res => res.json())
        .then(data => {
          setPendingCount(data.count || 0);
          setLoadingPending(false);
        })
        .catch(err => {
          console.error('Failed to load pending count:', err);
          setLoadingPending(false);
        });
    } else {
      setPendingCount(0);
    }
  }, [formData.project, formData.parentIssue, isLeaveProject]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError('');

    try {
      // Prepare request body
      const requestBody = { ...formData };

      // If leave project, map form data to custom fields
      if (isLeaveProject && projectFields?.customFields) {
        const customFields = {};

        // Find custom field IDs from projectFields
        // Look for Work Type field (field with allowedValues containing leave options)
        const leaveOptionField = Object.entries(projectFields.customFields).find(([id, field]) => {
          const fieldName = field.name?.toLowerCase() || '';
          // Check if this field has allowedValues with "Leave" in them
          if (field.allowedValues && field.allowedValues.length > 0) {
            const hasLeaveValues = field.allowedValues.some(val =>
              val.value?.toLowerCase().includes('leave')
            );
            return hasLeaveValues;
          }
          return false;
        });

        const startDateField = Object.entries(projectFields.customFields).find(([id, field]) =>
          field.name?.toLowerCase().includes('start') &&
          (field.schema?.type === 'date' || field.schema?.type === 'string')
        );

        const daysField = Object.entries(projectFields.customFields).find(([id, field]) =>
          (field.name?.toLowerCase().includes('day') || field.name?.toLowerCase().includes('duration')) &&
          field.schema?.type === 'number'
        );



        // Map form data to custom field IDs
        if (leaveOptionField && formData.leaveType) {
          customFields[leaveOptionField[0]] = { value: formData.leaveType };
        }

        if (startDateField && formData.startDate) {
          customFields[startDateField[0]] = formData.startDate;
        }

        if (daysField && formData.days) {
          customFields[daysField[0]] = formData.days;
        }

        // Find allocation field (for Entitlement type)
        const allocationField = Object.entries(projectFields.customFields).find(([id, field]) =>
          field.name?.toLowerCase().includes('allocation')
        );

        if (allocationField && (formData.allocation || formData.allocation === 0)) {
          // Use allocation if set, otherwise use days value
          const allocationValue = formData.allocation > 0 ? formData.allocation : formData.days;
          customFields[allocationField[0]] = allocationValue;
        }

        requestBody.customFields = customFields;

        // Add parent issue for subtasks
        if (formData.parentIssue) {
          requestBody.parent = formData.parentIssue;
        }

        // Add duedate if Entitlement type (calculate from start date + days)
        if (formData.issueType === 'Entitlement' && formData.startDate && formData.days) {
          const startDate = new Date(formData.startDate);
          const dueDate = new Date(startDate);
          dueDate.setDate(dueDate.getDate() + parseInt(formData.days) - 1);
          requestBody.duedate = dueDate.toISOString().split('T')[0];
        }
      }

      const response = await fetch('/api/jira/tickets/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        onCreated();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to create ticket');
      }
    } catch (err) {
      setError('Failed to create ticket');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Create New Ticket</h2>
          <button onClick={onClose} className={styles.closeButton}>×</button>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit} className={styles.createForm}>
          <div className={styles.formGroup}>
            <label>Project *</label>
            <select
              value={formData.project}
              onChange={(e) => {
                const newProject = e.target.value;
                const project = projects.find(p => p.key === newProject);
                const isLeave = project?.name?.toLowerCase().includes('leave');
                setFormData({
                  ...formData,
                  project: newProject,
                  issueType: 'Task'
                });
              }}
              required
            >
              {projects.map(project => (
                <option key={project.key} value={project.key}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          {isLeaveProject && formData.parentIssue && (
            <div className={styles.formGroup}>
              <label>Pending Leaves</label>
              <div className={styles.infoField}>
                {loadingPending ? 'Loading...' : `${pendingCount} days remaining`}
              </div>
            </div>
          )}

          <div className={styles.formGroup}>
            <label>Issue Type *</label>
            <select
              value={formData.issueType}
              onChange={(e) => setFormData({ ...formData, issueType: e.target.value })}
              required
            >
              {isLeaveProject ? (
                <option value="Leave Request">Leave Request</option>
              ) : (
                <>
                  <option value="Task">Task</option>
                  <option value="Story">Story</option>
                  <option value="Bug">Bug</option>
                  <option value="Epic">Epic</option>
                </>
              )}
            </select>
          </div>

          {isLeaveProject && (
            <>
              {loadingFields ? (
                <div className={styles.formGroup}>
                  <label>Loading leave options...</label>
                </div>
              ) : (
                <>
                  <div className={styles.formGroup}>
                    <label>Leave Option *</label>
                    <select
                      value={formData.parentIssue}
                      onChange={(e) => {
                        const selectedParent = parentIssues.find(p => p.key === e.target.value);
                        setFormData({
                          ...formData,
                          parentIssue: e.target.value,
                          leaveType: selectedParent?.summary || ''
                        });
                      }}
                      required
                      disabled={loadingParents}
                    >
                      <option value="">{loadingParents ? 'Loading...' : 'Select leave type...'}</option>
                      {parentIssues.map(issue => (
                        <option key={issue.key} value={issue.key}>
                          {issue.summary}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label>Start Date *</label>
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      required
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Days *</label>
                    <input
                      type="number"
                      value={formData.days}
                      onChange={(e) => setFormData({ ...formData, days: parseInt(e.target.value) || 1 })}
                      required
                      min="1"
                      max="365"
                    />
                  </div>

                  {formData.issueType === 'Entitlement' && (
                    <div className={styles.formGroup}>
                      <label>Allocation (Days) *</label>
                      <input
                        type="number"
                        value={formData.allocation || formData.days}
                        onChange={(e) => setFormData({ ...formData, allocation: parseFloat(e.target.value) || 0 })}
                        required
                        min="0"
                        step="0.5"
                      />
                    </div>
                  )}
                </>
              )}
            </>
          )}

          <div className={styles.formGroup}>
            <label>Summary *</label>
            <input
              type="text"
              value={formData.summary}
              onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
              required
              placeholder={isLeaveProject ? "e.g., Leave Request - [Your Name]" : "Brief description of the issue"}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Detailed description"
              rows={5}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Priority</label>
            <select
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
            >
              <option value="Highest">Highest</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
              <option value="Lowest">Lowest</option>
            </select>
          </div>

          <div className={styles.modalActions}>
            <button type="submit" disabled={creating} className={styles.submitButton}>
              {creating ? 'Creating...' : 'Create Ticket'}
            </button>
            <button type="button" onClick={onClose} className={styles.cancelButton}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  const colors = getThemeColorPalette();

  return (
    <>
      {[0, 1].map((groupIndex) => (
        <div key={groupIndex} className={styles.projectGroup}>
          <div className={styles.projectHeader} style={{ borderLeftColor: colors[groupIndex % colors.length] }}>
            <div className={styles.projectInfo}>
              <div className={styles.projectColor} style={{ backgroundColor: colors[groupIndex % colors.length] }}></div>
              <div className={styles.skeletonProjectName}></div>
              <div className={styles.skeletonProjectCount}></div>
            </div>
          </div>
          <div className={styles.ticketList}>
            {[1, 2, 3].map((i) => (
              <div key={i} className={styles.skeletonCard} style={{ borderColor: colors[groupIndex % colors.length] }}>
                <span className={styles.projectMarker} style={{ background: colors[groupIndex % colors.length], opacity: 0.5 }} aria-hidden="true" />
                <div className={styles.skeletonHeader}>
                  <div className={styles.skeletonKey}></div>
                </div>
                <div className={styles.skeletonTitle}></div>
                <div className={styles.skeletonTitle} style={{ width: '70%' }}></div>
                <div className={styles.skeletonTitle} style={{ width: '40%' }}></div>
                <div className={styles.skeletonMeta}>
                  <div className={styles.skeletonPill}></div>
                  <div className={styles.skeletonPill}></div>
                  <div className={styles.skeletonPill}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
