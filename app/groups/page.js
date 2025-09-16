'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ImTree } from 'react-icons/im';
import { ChevronDown, ChevronUp, Plus, Users } from 'lucide-react';
import { GrTrophy } from 'react-icons/gr';
import { RiAdminLine } from 'react-icons/ri';
import { FaRegUser } from 'react-icons/fa';
import AddGroupModal from '../../components/AddGroupModal';
import { createTreeLayout } from '../../lib/tidyTree';
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
  const nodeStyle = position ? {
    position: 'absolute',
    left: `${position.x}px`,
    top: `${position.y}px`,
    width: `${position.width}px`
  } : {};

  return (
    <div 
      className={`${styles.groupNode} ${overlay && expanded ? styles.overlayExpanded : ''}`}
      style={nodeStyle}
    >
      <div
        className={`${styles.groupCard} ${selected ? styles.selected : ''}`}
        onClick={() => onSelect()}
      >
        <img
          src={group.thumbnail_url || '/brand/90d-logo.png'}
          alt="Group thumbnail"
          className={styles.thumbnail}
        />
        <div className={styles.groupInfo}>
          <div className={styles.groupName}>{group.name}</div>
          <div className={styles.groupMeta}>
            <GrTrophy size={12} /><span className={styles.sharedCount}>{count}</span>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className={styles.expandButton}
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? (
            <ChevronUp className={styles.chevron} />
          ) : (
            <ChevronDown className={styles.chevron} />
          )}
        </button>
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
              strokeWidth={2}
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
            group={group}
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
  const [groups, setGroups] = useState([]);
  const [groupDetails, setGroupDetails] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    fetchGroups();
    
    // Check URL parameters for showAddModal
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('showAddModal') === 'true') {
      setShowAddModal(true);
      // Clean up URL parameter
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, []);

  useEffect(() => {
    // Listen for createGroup event from left menu
    const handleCreateGroup = () => {
      setShowAddModal(true);
    };

    window.addEventListener('createGroup', handleCreateGroup);
    return () => window.removeEventListener('createGroup', handleCreateGroup);
  }, []);

  const fetchGroups = async () => {
    try {
      const response = await fetch('/api/groups');
      if (response.ok) {
        const data = await response.json();
        setGroups(data.groups);
        if (data.groups.length > 0) {
          const rootGroup = data.groups.find(g => !g.parent_group_id);
          if (rootGroup) {
            setSelectedId(rootGroup.id);
            fetchGroupDetails(rootGroup.id);
          }
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to fetch groups');
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const fetchGroupDetails = async (groupId) => {
    try {
      const response = await fetch(`/api/groups/${groupId}?include=members,objectives`);
      if (response.ok) {
        const data = await response.json();
        setGroupDetails(prev => ({
          ...prev,
          [groupId]: {
            members: data.members || [],
            objectives: data.objectives || [],
            count: data.objectiveCount || 0
          }
        }));
      }
    } catch (err) {
      console.error('Error fetching group details:', err);
    }
  };

  const handleGroupSelect = (groupId) => {
    setSelectedId(groupId);
    if (!groupDetails[groupId]) {
      fetchGroupDetails(groupId);
    }
  };

  const handleToggleExpanded = (groupId) => {
    setExpanded(prev => ({ ...prev, [groupId]: !prev[groupId] }));
    if (!groupDetails[groupId]) {
      fetchGroupDetails(groupId);
    }
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
        // Refresh groups list
        await fetchGroups();
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

  const getChildGroups = (parentId) => 
    groups.filter(g => g.parent_group_id === parentId);

  // Generate tree layouts using Tidy Tree algorithm
  const treeLayouts = useMemo(() => {
    if (groups.length === 0) return [];

    try {
      const layouts = createTreeLayout(groups, {
        nodeWidth: 290,
        nodeHeight: 80,
        levelHeight: 120,
        siblingDistance: 350,
        subtreeDistance: 350, // Match sibling distance to reduce uneven spacing
        spacingReduction: 0.7, // Reduce spacing by 30% each level
        minSpacing: 80 // Minimum spacing to maintain readability
      });

      return layouts;
    } catch (error) {
      console.error('Error creating tree layout:', error);
      return [];
    }
  }, [groups]);

  if (loading) {
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
          {groups.length === 0 ? (
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
    </div>
  );
}