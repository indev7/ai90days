'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Pagination from '@/components/Pagination';
import styles from './page.module.css';

export default function JiraPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [jiraSiteUrl, setJiraSiteUrl] = useState('');
  const [filters, setFilters] = useState({
    project: '',
    status: '',
    assignee: 'currentUser()',
  });
  const [pagination, setPagination] = useState({
    currentPage: 1,
    pageSize: 20,
    total: 0,
  });
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loadingTickets, setLoadingTickets] = useState(false);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/api/jira/auth/status');
      const data = await response.json();
      setIsAuthenticated(data.authenticated);

      // Store Jira site URL if available
      if (data.resources && data.resources.length > 0) {
        setJiraSiteUrl(data.resources[0].url);
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
      setSelectedTicket(null);
    } catch (err) {
      setError('Failed to logout');
    }
  };

  const loadProjects = async () => {
    try {
      const response = await fetch('/api/jira/projects');
      if (response.ok) {
        const data = await response.json();
        setProjects(data.projects);
      }
    } catch (err) {
      setError('Failed to load projects');
    }
  };

  const loadTickets = useCallback(async () => {
    setLoadingTickets(true);
    try {
      const params = new URLSearchParams();
      if (filters.project) params.append('project', filters.project);
      if (filters.status) params.append('status', filters.status);
      if (filters.assignee) params.append('assignee', filters.assignee);
      params.append('maxResults', pagination.pageSize.toString());
      params.append('startAt', ((pagination.currentPage - 1) * pagination.pageSize).toString());

      const response = await fetch(`/api/jira/tickets?${params}`);
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
  }, [filters.project, filters.status, filters.assignee, pagination.pageSize, pagination.currentPage]);

  // Check authentication status
  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Load projects when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadProjects();
    }
  }, [isAuthenticated]);

  // Load tickets when filters or pagination change
  useEffect(() => {
    if (isAuthenticated) {
      loadTickets();
    }
  }, [isAuthenticated, loadTickets]);

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
    if (jiraSiteUrl) {
      window.open(`${jiraSiteUrl}/browse/${ticketKey}`, '_blank');
    }
  };

  const handleUpdateTicket = async (ticketKey, updates) => {
    try {
      const response = await fetch(`/api/jira/tickets/${ticketKey}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        const updated = await response.json();
        setSelectedTicket(updated);
        loadTickets(); // Refresh list
      }
    } catch (err) {
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
          const ticketResponse = await fetch(`/api/jira/tickets/${ticketKey}`);
          if (ticketResponse.ok) {
            const updatedTicket = await ticketResponse.json();
            setSelectedTicket(updatedTicket);
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
            <span className={styles.pageIcon}>🎫</span>
            <h1>Jira Tickets</h1>
          </div>
          <div className={styles.headerActions}>
            <button
              onClick={handleRefresh}
              className={styles.refreshButton}
              disabled={loadingTickets}
              title="Refresh tickets"
            >
              {loadingTickets ? <span className={styles.spinner}></span> : '🔄'}
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
              setFilters({ ...filters, project: e.target.value });
              setPagination(prev => ({ ...prev, currentPage: 1 }));
            }}
            className={styles.filterSelect}
          >
            <option value="">All Projects</option>
            {projects.map(project => (
              <option key={project.key} value={project.key}>
                {project.name}
              </option>
            ))}
          </select>

          <select
            value={filters.assignee}
            onChange={(e) => {
              setFilters({ ...filters, assignee: e.target.value });
              setPagination(prev => ({ ...prev, currentPage: 1 }));
            }}
            className={styles.filterSelect}
          >
            <option value="currentUser()">My Tickets</option>
            <option value="">All Tickets</option>
          </select>

          <input
            type="text"
            placeholder="Filter by status..."
            value={filters.status}
            onChange={(e) => {
              setFilters({ ...filters, status: e.target.value });
              setPagination(prev => ({ ...prev, currentPage: 1 }));
            }}
            className={styles.filterInput}
          />
        </div>

        <div className={styles.content}>
          <div className={styles.ticketListWrapper}>
            <div className={styles.ticketList}>
              {loadingTickets ? (
                <LoadingSkeleton />
              ) : tickets.length === 0 ? (
                <div className={styles.emptyState}>No tickets found</div>
              ) : (
                tickets.map(ticket => (
                  <div
                    key={ticket.key}
                    className={styles.ticketCard}
                    onClick={() => handleTicketClick(ticket)}
                  >
                    <div className={styles.ticketHeader}>
                      <span
                        className={styles.ticketKey}
                        onClick={(e) => handleTicketKeyClick(ticket.key, e)}
                        title="Click to open in Jira"
                      >
                        {ticket.key}
                      </span>
                      <span className={`${styles.ticketStatus} ${styles[ticket.statusCategory?.toLowerCase()]}`}>
                        {ticket.status}
                      </span>
                    </div>
                    <h3 className={styles.ticketSummary} title={ticket.summary}>
                      {ticket.summary}
                    </h3>
                    <div className={styles.ticketMeta}>
                      <span className={styles.ticketType}>{ticket.issueType}</span>
                      <span className={styles.ticketPriority}>{ticket.priority}</span>
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
  });

  const handleSave = () => {
    onUpdate(ticket.key, editData);
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
          <input
            type="text"
            value={editData.summary}
            onChange={(e) => setEditData({ ...editData, summary: e.target.value })}
            className={styles.editInput}
          />
          <textarea
            value={editData.description}
            onChange={(e) => setEditData({ ...editData, description: e.target.value })}
            className={styles.editTextarea}
            rows={10}
          />
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
            <button onClick={() => setIsEditing(true)} className={styles.editButton}>
              Edit
            </button>
            <select
              onChange={(e) => onTransition(ticket.key, e.target.value)}
              className={styles.transitionSelect}
              defaultValue=""
            >
              <option value="" disabled>Change Status</option>
              <option value="To Do">To Do</option>
              <option value="In Progress">In Progress</option>
              <option value="Done">Done</option>
            </select>
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
  });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError('');

    try {
      const response = await fetch('/api/jira/tickets/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
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
              onChange={(e) => setFormData({ ...formData, project: e.target.value })}
              required
            >
              {projects.map(project => (
                <option key={project.key} value={project.key}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label>Issue Type *</label>
            <select
              value={formData.issueType}
              onChange={(e) => setFormData({ ...formData, issueType: e.target.value })}
              required
            >
              <option value="Task">Task</option>
              <option value="Story">Story</option>
              <option value="Bug">Bug</option>
              <option value="Epic">Epic</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label>Summary *</label>
            <input
              type="text"
              value={formData.summary}
              onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
              required
              placeholder="Brief description of the issue"
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
  return (
    <>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className={styles.skeletonCard}>
          <div className={styles.skeletonHeader}>
            <div className={styles.skeletonKey}></div>
            <div className={styles.skeletonStatus}></div>
          </div>
          <div className={styles.skeletonTitle}></div>
          <div className={styles.skeletonTitle} style={{ width: '70%' }}></div>
          <div className={styles.skeletonMeta}>
            <div className={styles.skeletonMetaItem}></div>
            <div className={styles.skeletonMetaItem}></div>
          </div>
        </div>
      ))}
    </>
  );
}
