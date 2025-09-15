'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ImTree } from 'react-icons/im';
import { ChevronDown, ChevronRight, Plus, Users } from 'lucide-react';
import { GrTrophy } from 'react-icons/gr';
import { RiAdminLine } from 'react-icons/ri';
import { FaRegUser } from 'react-icons/fa';
import AddGroupModal from '../../components/AddGroupModal';
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

// Chip component for group types
function Chip({ children }) {
  return (
    <span className={styles.chip}>
      {children}
    </span>
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
  overlay = false
}) {
  return (
    <div className={`${styles.groupNode} ${overlay && expanded ? styles.overlayExpanded : ''}`}>
      <div
        className={`${styles.groupCard} ${selected ? styles.selected : ''}`}
      >
        <img
          src={group.thumbnail_url || '/brand/90d-logo.png'}
          alt="Group thumbnail"
          className={styles.thumbnail}
        />
        <div className={styles.groupInfo}>
          <div className={styles.groupName}>{group.name}</div>
          <div className={styles.groupMeta}>
            <span className={styles.sharedCount}>{count} shared OKRTs</span>
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
            <ChevronDown className={styles.chevron} />
          ) : (
            <ChevronRight className={styles.chevron} />
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

  // Layout refs for connectors
  const wrapRef = useRef(null);
  const pRef = useRef(null);
  const cRefs = useRef([]);
  const [paths, setPaths] = useState([]);

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

  useEffect(() => {
    // Redraw connectors when groups change or expansion changes
    redrawConnectors();
    window.addEventListener('resize', redrawConnectors);
    return () => window.removeEventListener('resize', redrawConnectors);
  }, [groups, expanded]);

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

  const redrawConnectors = () => {
    const wrap = wrapRef.current;
    const p = pRef.current;
    const cs = cRefs.current;
    
    if (!wrap || !p || cs.some(n => !n)) return;
    
    const wb = wrap.getBoundingClientRect();
    const pb = p.getBoundingClientRect();
    const startX = pb.left - wb.left + pb.width / 2;
    const startY = pb.top - wb.top + pb.height;
    const newPaths = [];
    
    cs.forEach((node) => {
      if (!node) return;
      const cb = node.getBoundingClientRect();
      const endX = cb.left - wb.left + cb.width / 2;
      const endY = cb.top - wb.top;
      const midY = (startY + endY) / 2;
      const d = `M ${startX},${startY} V ${midY} H ${endX} V ${endY}`;
      newPaths.push(d);
    });
    
    setPaths(newPaths);
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

  const groupById = useMemo(() => 
    Object.fromEntries(groups.map(g => [g.id, g])), [groups]
  );

  const rootGroups = useMemo(() => 
    groups.filter(g => !g.parent_group_id), [groups]
  );

  const getChildGroups = (parentId) => 
    groups.filter(g => g.parent_group_id === parentId);

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

  const selectedGroup = selectedId ? groupById[selectedId] : null;
  const selectedDetails = selectedId ? groupDetails[selectedId] : null;

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
            <div ref={wrapRef} className={styles.treeContainer}>
              {/* Root groups */}
              {rootGroups.map((rootGroup) => {
                const children = getChildGroups(rootGroup.id);
                const details = groupDetails[rootGroup.id];
                
                return (
                  <div key={rootGroup.id} className={styles.treeSection}>
                    {/* Parent row */}
                    <div className={styles.parentRow}>
                      <div ref={pRef}>
                        <GroupNode
                          group={rootGroup}
                          count={details?.count || 0}
                          selected={selectedId === rootGroup.id}
                          expanded={expanded[rootGroup.id]}
                          onSelect={() => handleGroupSelect(rootGroup.id)}
                          onToggle={() => handleToggleExpanded(rootGroup.id)}
                          hasChildren={children.length > 0}
                          overlay={true}
                        >
                          <ExpandedGroupContent
                            group={rootGroup}
                            objectives={details?.objectives || []}
                            members={details?.members || []}
                          />
                        </GroupNode>
                      </div>
                    </div>

                    {/* SVG connectors */}
                    {children.length > 0 && (
                      <svg className={styles.connectors} fill="none">
                        {paths.map((d, i) => (
                          <path key={i} d={d} stroke="#CBD5E1" strokeWidth={2} />
                        ))}
                      </svg>
                    )}

                    {/* Children row - now recursive */}
                    {children.length > 0 && (
                      <div className={styles.childrenRow}>
                        {children.map((child, i) => {
                          const childDetails = groupDetails[child.id];
                          const grandChildren = getChildGroups(child.id);
                          return (
                            <div key={child.id} className={styles.childNode}>
                              <div ref={el => cRefs.current[i] = el}>
                                <GroupNode
                                  group={child}
                                  count={childDetails?.count || 0}
                                  selected={selectedId === child.id}
                                  expanded={expanded[child.id]}
                                  onSelect={() => handleGroupSelect(child.id)}
                                  onToggle={() => handleToggleExpanded(child.id)}
                                  hasChildren={grandChildren.length > 0}
                                  overlay={true}
                                >
                                  <ExpandedGroupContent
                                    group={child}
                                    objectives={childDetails?.objectives || []}
                                    members={childDetails?.members || []}
                                  />
                                </GroupNode>
                                {/* Render grandchildren automatically like second level */}
                                {grandChildren.length > 0 && (
                                  <div className={styles.grandChildrenSection}>
                                    {/* SVG connectors for grandchildren */}
                                    <svg className={styles.grandConnectors} fill="none">
                                      {grandChildren.map((_, i) => {
                                        // Simple vertical line connectors for now
                                        const startY = 0;
                                        const endY = 60;
                                        const x = 160 + (i * 340); // Approximate positioning
                                        const d = `M ${x},${startY} V ${endY}`;
                                        return <path key={i} d={d} stroke="#CBD5E1" strokeWidth={2} />;
                                      })}
                                    </svg>
                                    
                                    <div className={styles.grandChildrenRow}>
                                      {grandChildren.map((grandChild) => {
                                        const grandChildDetails = groupDetails[grandChild.id];
                                        const greatGrandChildren = getChildGroups(grandChild.id);
                                        return (
                                          <div key={grandChild.id} className={styles.grandChildNode}>
                                            <GroupNode
                                              group={grandChild}
                                              count={grandChildDetails?.count || 0}
                                              selected={selectedId === grandChild.id}
                                              expanded={expanded[grandChild.id]}
                                              onSelect={() => handleGroupSelect(grandChild.id)}
                                              onToggle={() => handleToggleExpanded(grandChild.id)}
                                              hasChildren={greatGrandChildren.length > 0}
                                              overlay={true}
                                            >
                                              <ExpandedGroupContent
                                                group={grandChild}
                                                objectives={grandChildDetails?.objectives || []}
                                                members={grandChildDetails?.members || []}
                                              />
                                            </GroupNode>
                                            {/* Render great-grandchildren automatically too */}
                                            {greatGrandChildren.length > 0 && (
                                              <div className={styles.greatGrandChildrenRow}>
                                                {greatGrandChildren.map((greatGrandChild) => {
                                                  const greatGrandChildDetails = groupDetails[greatGrandChild.id];
                                                  const greatGreatGrandChildren = getChildGroups(greatGrandChild.id);
                                                  return (
                                                    <div key={greatGrandChild.id} className={styles.greatGrandChildNode}>
                                                      <GroupNode
                                                        group={greatGrandChild}
                                                        count={greatGrandChildDetails?.count || 0}
                                                        selected={selectedId === greatGrandChild.id}
                                                        expanded={expanded[greatGrandChild.id]}
                                                        onSelect={() => handleGroupSelect(greatGrandChild.id)}
                                                        onToggle={() => handleToggleExpanded(greatGrandChild.id)}
                                                        hasChildren={greatGreatGrandChildren.length > 0}
                                                        overlay={true}
                                                      >
                                                        <ExpandedGroupContent
                                                          group={greatGrandChild}
                                                          objectives={greatGrandChildDetails?.objectives || []}
                                                          members={greatGrandChildDetails?.members || []}
                                                        />
                                                      </GroupNode>
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
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