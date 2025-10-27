"use client";
import React, { useState, useEffect, useRef } from "react";
import { OrganizationChart } from "primereact/organizationchart";
import { GrTrophy } from 'react-icons/gr';
import { RiAdminLine } from 'react-icons/ri';
import { FaRegUser } from 'react-icons/fa';
import { RiDeleteBin6Line } from 'react-icons/ri';
import { FaPlus } from 'react-icons/fa';
import "primereact/resources/themes/lara-light-blue/theme.css";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";
import AddGroupModal from '../../components/AddGroupModal';
import styles from './page.module.css';

/*************************
 * Helpers
 *************************/
/** Transform API group data to OrganizationChart format */
function transformGroupToChartNode(group) {
  const node = {
    label: group.name,
    expanded: true,
    data: {
      id: group.id,
      name: group.name,
      type: group.type,
      thumbnail_url: group.thumbnail_url,
      objectiveCount: group.objectiveCount || 0,
      memberCount: group.memberCount || 0,
    },
  };

  if (group.children && group.children.length > 0) {
    node.children = group.children.map(transformGroupToChartNode);
  }

  return node;
}

/** Transform API objective data to OrganizationChart format */
function transformObjectiveToChartNode(objective) {
  const node = {
    label: objective.title,
    expanded: true,
    data: {
      id: objective.id,
      title: objective.title,
      description: objective.description,
      type: objective.type,
      progress: objective.progress || 0,
      owner_name: objective.owner_name,
      shared_groups: objective.shared_groups || [],
    },
  };

  // Find children (objectives with this objective as parent)
  if (objective.children && objective.children.length > 0) {
    node.children = objective.children.map(transformObjectiveToChartNode);
  }

  return node;
}

/** Build display name with type suffix.
 *  Rules:
 *   - Group => suffix "Organisation" (UK spelling)
 *   - Otherwise, use the given type (e.g., Squad, Department)
 *   - Avoid duplicating the suffix if name already ends with it (case-insensitive).
 *   - For Group, also avoid duplicating if name already ends with "Organization" (US) or "Organisation" (UK).
 */
function displayNameFor(name = "", type = "") {
  const suffix = type === "Group" ? "Organisation" : type || "";
  if (!suffix) return name;

  const lowerName = name.trim().toLowerCase();
  const endsWithSuffix = lowerName.endsWith(suffix.toLowerCase());
  const endsWithOrgUS = type === "Group" && lowerName.endsWith("organization");
  const endsWithOrgUK = type === "Group" && lowerName.endsWith("organisation");

  if (endsWithSuffix || endsWithOrgUS || endsWithOrgUK) return name;
  return `${name} ${suffix}`;
}

/*************************
 * Progress Bar Component
 *************************/
function ProgressBar({ value }) {
  const pct = Math.round(Math.max(0, Math.min(100, value)));
  return (
    <div className={styles.progressBar}>
      <div 
        className={styles.progressFill} 
        style={{ width: `${pct}%` }} 
      />
    </div>
  );
}

/*************************
 * Expanded Group Content
 *************************/
function ExpandedGroupContent({ group, objectives = [], members = [], currentUserId, onEditClick }) {
  // Check if current user is an admin of this group
  const isAdmin = members.some(member => member.id === currentUserId && member.is_admin);
  
  return (
    <div
      className={styles.expandedDetails}
      onClick={(e) => {
        // Only trigger edit if user is admin and clicking on the card itself
        if (isAdmin && e.target === e.currentTarget) {
          onEditClick();
        }
      }}
      style={{ cursor: isAdmin ? 'pointer' : 'default' }}
      title={isAdmin ? 'Click to edit group' : ''}
    >
      {/* Objectives */}
      <div className={styles.objectivesSection}>
        {objectives.map((objective) => (
          <div key={objective.id} className={styles.objectiveItem}>
            <GrTrophy className={styles.objectiveIcon} />
            <div className={styles.objectiveContent}>
              <div className={styles.objectiveTitle}>{objective.title}</div>
              <div className={styles.objectiveProgress}>
                <ProgressBar value={objective.progress} />
                <div className={styles.progressText}>{Math.round(objective.progress)}%</div>
              </div>
            </div>
          </div>
        ))}
        {objectives.length === 0 && (
          <div className={styles.emptyText}>No objectives shared yet.</div>
        )}
      </div>

      <div className={styles.divider} />

      {/* Members */}
      <div className={styles.membersSection}>
        {members.map((member) => (
          <div key={member.id} className={styles.memberItem}>
            {member.is_admin ? (
              <RiAdminLine className={styles.memberIcon} />
            ) : (
              <FaRegUser className={styles.memberIcon} />
            )}
            <span className={styles.memberName}>{member.display_name}</span>
            {member.is_admin && (
              <span className={styles.adminLabel}>admin</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/*************************
 * Node Template (UI) — with click handling
 *************************/
function NodeTemplate(node, expandedGroupId, onNodeClick, groupDetails, currentUserId, onEditGroup) {
  const d = node.data || {};
  const nodeRef = useRef(null);
  const isExpanded = expandedGroupId === d.id;

  // Handle click outside to close expanded card
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isExpanded && nodeRef.current && !nodeRef.current.contains(event.target)) {
        onNodeClick(null);
      }
    };

    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isExpanded, onNodeClick]);

  // Title: plain name only (no icon, no type suffix)
  const title = d.name || node.label;

  // Lower line: human-readable type (Group => Organisation), then counts
  const typeLabel = d.type === "Group" ? "Organisation" : d.type || "";
  const metaParts = [];
  if (typeLabel) metaParts.push(typeLabel);
  if (d.memberCount !== undefined)
    metaParts.push(`${d.memberCount} member${d.memberCount === 1 ? "" : "s"}`);
  if (d.objectiveCount !== undefined)
    metaParts.push(`${d.objectiveCount} objective${d.objectiveCount === 1 ? "" : "s"}`);
  const meta = metaParts.join(" • ");

  const details = groupDetails[d.id];

  return (
    <div ref={nodeRef} className={styles.nodeWrapper}>
      <div 
        className={`${styles.nodeBox} ${isExpanded ? styles.expanded : ''}`}
        onClick={() => onNodeClick(d.id)}
      >
        <div className={styles.nodeTitle}>{title}</div>
        <div className={styles.nodeMeta}>{meta}</div>
      </div>
      {isExpanded && details && (
        <div className={styles.expandedCard}>
          <ExpandedGroupContent
            group={d}
            objectives={details.objectives || []}
            members={details.members || []}
            currentUserId={currentUserId}
            onEditClick={() => onEditGroup(d)}
          />
        </div>
      )}
    </div>
  );
}

/*************************
 * Objective Node Template
 *************************/
function ObjectiveNodeTemplate(node, expandedObjectiveId, onNodeClick, objectiveDetails) {
  const d = node.data || {};
  const nodeRef = useRef(null);
  const isExpanded = expandedObjectiveId === d.id;

  // Handle click outside to close expanded card
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isExpanded && nodeRef.current && !nodeRef.current.contains(event.target)) {
        onNodeClick(null);
      }
    };

    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isExpanded, onNodeClick]);

  const title = d.title || node.label;
  const progress = Math.round(d.progress || 0);

  return (
    <div ref={nodeRef} className={styles.nodeWrapper}>
      <div
        className={`${styles.nodeBox} ${isExpanded ? styles.expanded : ''}`}
        onClick={() => onNodeClick(d.id)}
      >
        <div className={styles.nodeTitle}>{title}</div>
        <div className={styles.nodeMeta}>
          {d.owner_name && `by ${d.owner_name}`}
          {d.owner_name && ' • '}
          {progress}% complete
        </div>
      </div>
      {isExpanded && (
        <div className={styles.expandedCard}>
          <div className={styles.expandedDetails}>
            {/* Description */}
            {d.description && (
              <div className={styles.objectivesSection}>
                <div className={styles.objectiveTitle}>Description</div>
                <div className={styles.emptyText}>{d.description}</div>
              </div>
            )}
            
            {/* Progress */}
            <div className={styles.objectivesSection}>
              <div className={styles.objectiveItem}>
                <div className={styles.objectiveContent}>
                  <div className={styles.objectiveProgress}>
                    <ProgressBar value={progress} />
                    <div className={styles.progressText}>{progress}%</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Shared Groups */}
            {d.shared_groups && d.shared_groups.length > 0 && (
              <>
                <div className={styles.divider} />
                <div className={styles.membersSection}>
                  <div className={styles.objectiveTitle}>Shared with:</div>
                  {d.shared_groups.map((group, idx) => (
                    <div key={idx} className={styles.memberItem}>
                      <span className={styles.memberName}>{group.name || group}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/*************************
 * Runtime sanity checks ("tests")
 *************************/
(function runDevAssertions() {
  try {
    // Existing tests (kept intact)
    console.assert(
      displayNameFor("Intervest", "Group") === "Intervest Organisation",
      "Group suffix failed"
    );
    console.assert(
      displayNameFor("Intervest Organization", "Group") ===
        "Intervest Organization",
      "Should not duplicate Organization/Organisation"
    );
    console.assert(
      displayNameFor("Intervest Organisation", "Group") ===
        "Intervest Organisation",
      "Should not duplicate Organisation if already present"
    );
    console.assert(
      displayNameFor("Development", "Squad") === "Development Squad",
      "Squad suffix failed"
    );
    console.assert(
      displayNameFor("UI Department", "Department") === "UI Department",
      "Should not duplicate Department if already present"
    );
    console.assert(
      displayNameFor("Finance", "Group") === "Finance Organisation",
      "Group suffix should append Organisation"
    );

    // Additional tests (new)
    console.assert(
      displayNameFor("", "") === "",
      "Empty name/type should remain empty"
    );
    console.assert(
      displayNameFor("Alpha ", "Group") === "Alpha Organisation",
      "Trim + Group suffix should append once"
    );
    console.assert(
      displayNameFor("Research Team", "Team") === "Research Team",
      "If name already ends with suffix (Team), do not duplicate"
    );
    console.assert(
      displayNameFor("Ops", "Department") === "Ops Department",
      "Generic type should append to name"
    );
  } catch (e) {
    // no-op; assertions are for local dev visibility only
  }
})();

/*************************
 * Component
 *************************/
export default function IntervestOrgChart() {
  const [orgValue, setOrgValue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedGroupId, setExpandedGroupId] = useState(null);
  const [groupDetails, setGroupDetails] = useState({});
  const [viewType, setViewType] = useState('groups'); // 'groups' or 'objectives'
  const [objectivesValue, setObjectivesValue] = useState([]);
  const [loadingObjectives, setLoadingObjectives] = useState(false);
  const [expandedObjectiveId, setExpandedObjectiveId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [groups, setGroups] = useState([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    fetchCurrentUser();
    fetchGroupHierarchy();
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch('/api/me');
      if (response.ok) {
        const data = await response.json();
        setCurrentUser(data.user);
      }
    } catch (err) {
      console.error('Error fetching current user:', err);
    }
  };

  const fetchGroupHierarchy = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/groups?hierarchy=true');
      if (!response.ok) {
        throw new Error('Failed to fetch group hierarchy');
      }
      
      const data = await response.json();
      
      // Store flat groups list for modal
      const flatGroups = [];
      const flattenGroups = (groupList) => {
        groupList.forEach(group => {
          flatGroups.push(group);
          if (group.children && group.children.length > 0) {
            flattenGroups(group.children);
          }
        });
      };
      flattenGroups(data.groups);
      setGroups(flatGroups);
      
      // Transform the API data to OrganizationChart format
      const chartData = data.groups.map(transformGroupToChartNode);
      setOrgValue(chartData);
    } catch (err) {
      console.error('Error fetching group hierarchy:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchGroupDetails = async (groupId) => {
    if (groupDetails[groupId]) return; // Already fetched

    try {
      const response = await fetch(`/api/groups/${groupId}?include=members,objectives`);
      if (response.ok) {
        const data = await response.json();
        setGroupDetails(prev => ({
          ...prev,
          [groupId]: {
            members: data.members || [],
            objectives: data.objectives || [],
            count: data.objectiveCount || 0,
            memberCount: data.members?.length || 0
          }
        }));
      }
    } catch (err) {
      console.error('Error fetching group details:', err);
    }
  };

  const fetchObjectivesHierarchy = async () => {
    try {
      setLoadingObjectives(true);
      
      const response = await fetch('/api/shared');
      if (!response.ok) {
        throw new Error('Failed to fetch objectives');
      }
      
      const data = await response.json();
      const objectives = data.okrts || [];
      
      // Build hierarchy: find root objectives (those without parent_id)
      const rootObjectives = objectives.filter(obj => !obj.parent_id);
      
      // Function to recursively build children
      const buildHierarchy = (parentId) => {
        return objectives
          .filter(obj => obj.parent_id === parentId)
          .map(obj => ({
            ...obj,
            children: buildHierarchy(obj.id)
          }));
      };
      
      // Add children to root objectives
      const hierarchicalObjectives = rootObjectives.map(obj => ({
        ...obj,
        children: buildHierarchy(obj.id)
      }));
      
      // Transform to chart format
      const chartData = hierarchicalObjectives.map(transformObjectiveToChartNode);
      setObjectivesValue(chartData);
    } catch (err) {
      console.error('Error fetching objectives hierarchy:', err);
      setError(err.message);
    } finally {
      setLoadingObjectives(false);
    }
  };

  const handleNodeClick = (groupId) => {
    if (groupId === expandedGroupId) {
      // Clicking the same node closes it
      setExpandedGroupId(null);
    } else if (groupId) {
      // Clicking a new node opens it
      setExpandedGroupId(groupId);
      fetchGroupDetails(groupId);
    } else {
      // Clicking outside closes
      setExpandedGroupId(null);
    }
  };

  const handleObjectiveNodeClick = (objectiveId) => {
    if (objectiveId === expandedObjectiveId) {
      setExpandedObjectiveId(null);
    } else if (objectiveId) {
      setExpandedObjectiveId(objectiveId);
    } else {
      setExpandedObjectiveId(null);
    }
  };

  const handleEditGroup = (groupData) => {
    setEditingGroup(groupData);
    setShowEditModal(true);
  };

  const handleAddGroup = async (groupData) => {
    try {
      const response = await fetch('/api/groups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(groupData),
      });

      if (response.ok) {
        // Refresh group hierarchy
        await fetchGroupHierarchy();
        setShowAddModal(false);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create group');
      }
    } catch (error) {
      console.error('Error creating group:', error);
      throw error; // Re-throw to let modal handle the error
    }
  };

  const handleUpdateGroup = async (groupData) => {
    try {
      const response = await fetch(`/api/groups/${editingGroup.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(groupData),
      });

      if (response.ok) {
        // Refresh group hierarchy
        await fetchGroupHierarchy();
        setShowEditModal(false);
        setEditingGroup(null);
        // Refresh the expanded group details if it's still open
        if (expandedGroupId) {
          await fetchGroupDetails(expandedGroupId);
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update group');
      }
    } catch (error) {
      console.error('Error updating group:', error);
      throw error; // Re-throw to let modal handle the error
    }
  };

  const handleDeleteGroup = async () => {
    if (!groupToDelete) return;

    try {
      const response = await fetch(`/api/groups/${groupToDelete.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Refresh group hierarchy
        await fetchGroupHierarchy();
        setShowDeleteConfirm(false);
        setGroupToDelete(null);
        setShowEditModal(false);
        setEditingGroup(null);
        setExpandedGroupId(null);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete group');
      }
    } catch (error) {
      console.error('Error deleting group:', error);
      setError('Failed to delete group. Please try again.');
    }
  };

  const handleDeleteClick = () => {
    setGroupToDelete(editingGroup);
    setShowDeleteConfirm(true);
  };

  return (
    <div className={styles.container}>
      {/* PrimeReact overrides & connector tuning */}
      <style>{`
        /* 0) Make chart stretch full width */
        .p-organizationchart {
          width: 100% !important;
        }
        .p-organizationchart table {
          width: 100% !important;
        }

        /* 1) Horizontal gap between sibling boxes via TD padding (table-safe) */
        .p-organizationchart .p-organizationchart-node {
          padding: 0 12px !important;
          text-align: center !important;
        }

        /* 2) Node box: no margin; ensure positioning context for toggler */
        .p-organizationchart .p-organizationchart-node-content {
          padding: 0 !important;
          border-radius: 5px;
          border: none !important;
          background: transparent;
          margin: 0 auto !important;
          position: relative !important;
          box-sizing: border-box !important;
          display: inline-block !important;
        }

        /* 3) Center the chevron/toggler precisely under the node content */
        .p-organizationchart .p-organizationchart-node-content .p-organizationchart-toggler {
          position: absolute !important;
          left: 50% !important;
          bottom: -12px !important;
          margin-left: 0 !important;
          margin-right: 0 !important;
          margin-top: 0 !important;
          margin-bottom: 0 !important;
          padding: 0 !important;
        }
        
        /* 3b) Override global margin:0 reset - ensure button itself is centered within toggler */
        .p-organizationchart .p-organizationchart-node-content .p-organizationchart-toggler button,
        .p-organizationchart .p-organizationchart-node-content .p-organizationchart-toggler .p-button {
          display: block !important;
          margin: 0 !important;
          padding: 0 !important;
          transform: translateX(-50%) !important;
        }

        /* 3c) Override PrimeReact theme styles for the chevron icon */
        .p-organizationchart .p-organizationchart-node-content .p-node-toggler .p-node-toggler-icon,
        .p-organizationchart .p-icon.p-node-toggler-icon {
          position: relative !important;
          top: .3rem !important;
          left:-0.75rem;
        }

        /* 4) Make connector lines visible and consistent */
        .p-organizationchart .p-organizationchart-line-down {
          height: 12px !important;
          min-height: 12px !important;
          margin: 0 auto !important;
          border-left: 1px solid var(--border) !important;
        }
        .p-organizationchart .p-organizationchart-lines .p-organizationchart-line-left { border-right: 1px solid var(--border) !important; }
        .p-organizationchart .p-organizationchart-lines .p-organizationchart-line-right { border-left: 1px solid var(--border) !important; }
        .p-organizationchart .p-organizationchart-lines .p-organizationchart-line-top { border-top: 1px solid var(--border) !important; }

        /* 5) Moderate vertical spacing for legibility */
        .p-organizationchart .p-organizationchart-lines td { padding-top: 8px !important; padding-bottom: 8px !important; line-height: 0; }
        .p-organizationchart .p-organizationchart-node { margin-top: 0 !important; margin-bottom: 0 !important; }
      `}</style>

      <div className={styles.content}>
        {/* Toggle Switch */}
        <div className={styles.header}>
          <div className={styles.viewToggle}>
            <div className={styles.toggleSwitch}>
              <button
                className={`${styles.toggleOption} ${viewType === 'groups' ? styles.active : ''}`}
                onClick={() => setViewType('groups')}
              >
                Groups
              </button>
              <button
                className={`${styles.toggleOption} ${viewType === 'objectives' ? styles.active : ''}`}
                onClick={() => {
                  setViewType('objectives');
                  if (objectivesValue.length === 0) {
                    fetchObjectivesHierarchy();
                  }
                }}
              >
                Objectives
              </button>
            </div>
          </div>
          {viewType === 'groups' && (
            <button
              className={styles.addButton}
              onClick={() => setShowAddModal(true)}
              title="Add new group"
            >
              <FaPlus />
              Add
            </button>
          )}
        </div>
        
        {loading && (
          <div className={styles.loading}>
            Loading group hierarchy...
          </div>
        )}
        
        {error && (
          <div className={styles.error}>
            Error: {error}
          </div>
        )}
        
        {!loading && !error && orgValue.length === 0 && (
          <div className={styles.empty}>
            No groups found. Create a group to get started.
          </div>
        )}
        
        {viewType === 'objectives' ? (
          <>
            {loadingObjectives && (
              <div className={styles.loading}>
                Loading objectives hierarchy...
              </div>
            )}
            
            {!loadingObjectives && objectivesValue.length === 0 && (
              <div className={styles.empty}>
                No shared objectives found.
              </div>
            )}
            
            {!loadingObjectives && objectivesValue.length > 0 && (
              <div className={styles.chartContainer}>
                {objectivesValue.map((rootObjective, index) => (
                  <div key={rootObjective.data?.id || index} className={styles.chartSection}>
                    <OrganizationChart
                      value={[rootObjective]}
                      nodeTemplate={(node) => ObjectiveNodeTemplate(node, expandedObjectiveId, handleObjectiveNodeClick, {})}
                      collapsible={false}
                    />
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {!loading && !error && orgValue.length > 0 && (
              <div className={styles.chartContainer}>
                {orgValue.map((rootGroup, index) => (
                  <div key={rootGroup.data?.id || index} className={styles.chartSection}>
                    <OrganizationChart
                      value={[rootGroup]}
                      nodeTemplate={(node) => NodeTemplate(node, expandedGroupId, handleNodeClick, groupDetails, currentUser?.id, handleEditGroup)}
                      collapsible={false}
                    />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Add Group Modal */}
      <AddGroupModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleAddGroup}
        groups={groups}
      />

      {/* Edit Group Modal */}
      <AddGroupModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingGroup(null);
        }}
        onSave={handleUpdateGroup}
        groups={groups}
        editingGroup={editingGroup}
        onDelete={handleDeleteClick}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className={styles.modalOverlay} onClick={() => setShowDeleteConfirm(false)}>
          <div className={styles.confirmModal} onClick={e => e.stopPropagation()}>
            <div className={styles.confirmHeader}>
              <h3>Delete Group</h3>
            </div>
            <div className={styles.confirmBody}>
              <p>Are you sure you want to delete the group "{groupToDelete?.name}"?</p>
              <p>This action cannot be undone.</p>
            </div>
            <div className={styles.confirmFooter}>
              <button
                className={styles.cancelButton}
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </button>
              <button
                className={styles.deleteButton}
                onClick={handleDeleteGroup}
              >
                <RiDeleteBin6Line />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
