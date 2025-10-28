'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ImTree } from 'react-icons/im';
import { ChevronDown, ChevronUp, Plus, Users } from 'lucide-react';
import { GrTrophy } from 'react-icons/gr';
import { RiAdminLine } from 'react-icons/ri';
import { FaRegUser } from 'react-icons/fa';
import { LuUsers } from 'react-icons/lu';
import { RiDeleteBin6Line } from 'react-icons/ri';
import AddGroupModal from '../../components/AddGroupModal';
import ObjectiveHierarchy from '../../components/ObjectiveHierarchy';
import { createTreeLayout } from '../../lib/tidyTree';
import Avatar from 'boring-avatars';
import useMainTreeStore from '@/store/mainTreeStore';
import { useMainTree } from '@/hooks/useMainTree';
import styles from './page.module.css';

// Progress bar component
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

// Group Node component
function GroupNode({
  group,
  count,
  selected,
  expanded,
  onSelect,
  onToggle,
  children,
  hasChildren,
  position,
  overlay = false
}) {
  const nodeRef = useRef(null);
  const nodeStyle = position ? {
    position: 'absolute',
    left: `${position.x}px`,
    top: `${position.y}px`,
    width: `${position.width}px`
  } : {};

  // Handle click outside to close expanded card
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (expanded && nodeRef.current && !nodeRef.current.contains(event.target)) {
        onToggle();
      }
    };

    if (expanded) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [expanded, onToggle]);

  // Get member count from group details
  const memberCount = group.memberCount || 0;

  return (
    <div
      ref={nodeRef}
      className={`${styles.groupNode} ${overlay && expanded ? styles.overlayExpanded : ''}`}
      style={nodeStyle}
    >
      <div
        className={`${styles.groupCard} ${expanded ? styles.selected : ''}`}
        onClick={() => onToggle()}
      >
        <div className={styles.thumbnail}>
          {group.thumbnail_url ? (
            <img
              src={group.thumbnail_url}
              alt="Group thumbnail"
            />
          ) : (
            <Avatar
              size={68}
              name={group.name}
              variant="marble"
              colors={['#92A1C6', '#146A7C', '#F0AB3D', '#C271B4', '#C20D90']}
            />
          )}
        </div>
        <div className={styles.groupInfo}>
          <div className={styles.groupName} title={group.name}>{group.name}</div>
          <div className={styles.groupStats}>
            <span className={styles.groupStat}>
              <GrTrophy className={styles.statIcon} />
              {count}
            </span>
            <span className={styles.statDot}>•</span>
            <span className={styles.groupStat}>
              <LuUsers className={styles.statIcon} />
              {memberCount}
            </span>
          </div>
        </div>
      </div>
      {expanded && children && (
        <div className={overlay ? styles.overlayContent : styles.expandedContent}>
          {children}
        </div>
      )}
    </div>
  );
}

// Tree Layout Component using Tidy Tree algorithm
function TreeLayout({
  layout,
  groupDetails,
  selectedId,
  expanded,
  onSelect,
  onToggle,
  getChildGroups
}) {
  const { nodes, edges, bounds } = layout;

  return (
    <div className={styles.treeLayout} style={{ 
      width: `${bounds.width}px`, 
      height: `${bounds.height}px`,
      position: 'relative'
    }}>
      {/* Render edges (connectors) */}
      <svg 
        className={styles.treeConnectors} 
        width={bounds.width} 
        height={bounds.height}
        style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
      >
        {edges.map((edge, index) => {
          const midY = (edge.fromY + edge.toY) / 2;
          const path = `M ${edge.fromX},${edge.fromY} V ${midY} H ${edge.toX} V ${edge.toY}`;
          
          return (
            <path
              key={`${edge.from}-${edge.to}-${index}`}
              d={path}
              stroke="var(--border)"
              strokeWidth={1}
              fill="none"
            />
          );
        })}
      </svg>

      {/* Render nodes */}
      {nodes.map((node) => {
        const group = node.data;
        const details = groupDetails[group.id];
        const children = getChildGroups(group.id);
        const hasChildren = children.length > 0;

        console.log(`Group ${group.name} (${group.id}): hasChildren=${hasChildren}, children count=${children.length}`);

        return (
          <GroupNode
            key={group.id}
            group={{
              ...group,
              memberCount: details?.memberCount || 0
            }}
            count={details?.count || 0}
            selected={selectedId === group.id}
            expanded={expanded[group.id]}
            onSelect={() => onSelect(group.id)}
            onToggle={() => onToggle(group.id)}
            hasChildren={hasChildren}
            position={{
              x: node.x,
              y: node.y,
              width: node.width
            }}
            overlay={true}
          >
            <ExpandedGroupContent
              group={group}
              objectives={details?.objectives || []}
              members={details?.members || []}
            />
          </GroupNode>
        );
      })}
    </div>
  );
}

// Expanded group content
function ExpandedGroupContent({ group, objectives = [], members = [] }) {
  return (
    <div className={styles.expandedDetails}>
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

export default function GroupsPage() {
  const router = useRouter();
  
  // Use mainTree hook to get data
  const { mainTree, isLoading: mainTreeLoading } = useMainTree();
  const { myOKRTs } = useMainTreeStore();
  
  const [selectedId, setSelectedId] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState(null);
  const [viewType, setViewType] = useState('groups'); // 'groups' or 'objectives'

  // Get groups from mainTree
  const groups = mainTree.groups || [];
  
  // Build groupDetails from mainTree data
  const groupDetails = useMemo(() => {
    const details = {};
    
    groups.forEach(group => {
      // Get objectives for this group from myOKRTs using objectiveIds
      const objectives = group.objectiveIds
        ? group.objectiveIds
            .map(objId => myOKRTs.find(okrt => okrt.id === objId && okrt.type === 'O'))
            .filter(Boolean)
        : [];
      
      details[group.id] = {
        members: group.members || [],
        objectives: objectives,
        count: objectives.length,
        memberCount: group.members?.length || 0
      };
    });
    
    return details;
  }, [groups, myOKRTs]);

  // Set initial selected group
  useEffect(() => {
    if (groups.length > 0 && !selectedId) {
      const rootGroup = groups.find(g => !g.parent_group_id);
      if (rootGroup) {
        setSelectedId(rootGroup.id);
      }
    }
  }, [groups, selectedId]);

  useEffect(() => {
    // Check URL parameters for showAddModal or editGroup
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('showAddModal') === 'true') {
      setShowAddModal(true);
      // Clean up URL parameter
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    } else if (urlParams.get('editGroup')) {
      const groupId = urlParams.get('editGroup');
      const group = groups.find(g => g.id === groupId);
      if (group) {
        setEditingGroup(group);
        setShowEditModal(true);
      }
      // Clean up URL parameter
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, [groups]);

  useEffect(() => {
    // Listen for createGroup and editGroup events from left menu
    const handleCreateGroup = () => {
      setShowAddModal(true);
    };

    const handleEditGroup = (event) => {
      const { groupId } = event.detail;
      const group = groups.find(g => g.id === groupId);
      if (group) {
        setEditingGroup(group);
        setShowEditModal(true);
      }
    };

    window.addEventListener('createGroup', handleCreateGroup);
    window.addEventListener('editGroup', handleEditGroup);
    return () => {
      window.removeEventListener('createGroup', handleCreateGroup);
      window.removeEventListener('editGroup', handleEditGroup);
    };
  }, [groups]);

  const handleGroupSelect = (groupId) => {
    setSelectedId(groupId);
  };

  const handleToggleExpanded = (groupId) => {
    setExpanded(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const handleAddGroup = () => {
    setShowAddModal(true);
  };

  const handleSaveGroup = async (groupData) => {
    try {
      const response = await fetch('/api/groups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(groupData),
      });

      if (response.ok) {
        // Reload mainTree to get updated groups
        const mainTreeResponse = await fetch('/api/main-tree');
        if (mainTreeResponse.ok) {
          const data = await mainTreeResponse.json();
          useMainTreeStore.getState().setMainTree(data.mainTree);
        }
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
        // Reload mainTree to get updated groups
        const mainTreeResponse = await fetch('/api/main-tree');
        if (mainTreeResponse.ok) {
          const data = await mainTreeResponse.json();
          useMainTreeStore.getState().setMainTree(data.mainTree);
        }
        setShowEditModal(false);
        setEditingGroup(null);
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
        // Reload mainTree to get updated groups
        const mainTreeResponse = await fetch('/api/main-tree');
        if (mainTreeResponse.ok) {
          const data = await mainTreeResponse.json();
          useMainTreeStore.getState().setMainTree(data.mainTree);
        }
        setShowDeleteConfirm(false);
        setGroupToDelete(null);
        setShowEditModal(false);
        setEditingGroup(null);
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

  const getChildGroups = (parentId) => 
    groups.filter(g => g.parent_group_id === parentId);

  // Generate tree layouts using Tidy Tree algorithm
  const treeLayouts = useMemo(() => {
    if (groups.length === 0) return [];

    try {
      const layouts = createTreeLayout(groups, {
        nodeWidth: 250,
        nodeHeight: 68,
        levelHeight: 100,
        siblingDistance: 280,
        subtreeDistance: 280, // Match sibling distance to reduce uneven spacing
        spacingReduction: 0.7, // Reduce spacing by 30% each level
        minSpacing: 60 // Minimum spacing to maintain readability
      });

      return layouts;
    } catch (error) {
      console.error('Error creating tree layout:', error);
      return [];
    }
  }, [groups]);

  if (mainTreeLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.titleSection}>
            <ImTree className={styles.pageIcon} />
            <h1>Groups</h1>
          </div>
        </div>
        <div className={styles.loading}>Loading groups...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.titleSection}>
            <ImTree className={styles.pageIcon} />
            <h1>Groups</h1>
          </div>
        </div>
        <div className={styles.error}>{error}</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.layout}>
        {/* Main content */}
        <main className={styles.main}>
          {/* Toggle Switch in Canvas */}
          <div className={styles.canvasHeader}>
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
                  onClick={() => setViewType('objectives')}
                >
                  Objectives
                </button>
              </div>
            </div>
          </div>
          {viewType === 'objectives' ? (
            <ObjectiveHierarchy />
          ) : groups.length === 0 ? (
            <div className={styles.emptyState}>
              <ImTree className={styles.emptyIcon} />
              <h3>No Groups Yet</h3>
              <p>Create your first group to start organizing your team's goals.</p>
              <button className={styles.createButton} onClick={handleAddGroup}>
                <Plus className={styles.createIcon} />
                Create Group
              </button>
            </div>
          ) : (
            <div className={styles.treeContainer}>
              {/* Render tree layouts */}
              {treeLayouts.map((layout, index) => (
                <div key={index} className={styles.treeSection}>
                  <TreeLayout
                    layout={layout}
                    groupDetails={groupDetails}
                    selectedId={selectedId}
                    expanded={expanded}
                    onSelect={handleGroupSelect}
                    onToggle={handleToggleExpanded}
                    getChildGroups={getChildGroups}
                  />
                </div>
              ))}
            </div>
          )}
          </main>
      </div>

      {/* Add Group Modal */}
      <AddGroupModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleSaveGroup}
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