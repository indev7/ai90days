"use client";
import React, { useState, useEffect, useMemo, useRef } from "react";
import { RiDeleteBin6Line, RiOrganizationChart } from 'react-icons/ri';
import { GiGreekTemple } from 'react-icons/gi';
import { PiTreeView } from 'react-icons/pi';
import { HiOutlineUsers } from "react-icons/hi2";
import { Tree } from 'primereact/tree';
import "primereact/resources/themes/lara-light-blue/theme.css";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";
import AddGroupModal from '../../components/AddGroupModal';
import { useUser } from '@/hooks/useUser';
import { useMainTree } from '@/hooks/useMainTree';
import useMainTreeStore from '@/store/mainTreeStore';
import StrategyHouse from './StrategyHouse';
import GroupsView, { GroupDetailsPopover } from './GroupsView';
import ObjectivesView from './ObjectivesView';
import styles from './page.module.css';
import { useRouter, useSearchParams } from 'next/navigation';

/*************************
 * Helpers
 *************************/
/** Transform API group data to OrganizationChart format */
function transformGroupToChartNode(group, depth = 0) {
  const memberCount = Array.isArray(group.members) ? group.members.length : 0;
  const objectiveCount = Array.isArray(group.objectiveIds) ? group.objectiveIds.length : 0;
  
  const node = {
    label: group.name,
    expanded: true,
    data: {
      id: group.id,
      name: group.name,
      type: group.type,
      thumbnail_url: group.thumbnail_url,
      objectiveCount: objectiveCount,
      memberCount: memberCount,
      depth,
    },
  };

  if (group.children && group.children.length > 0) {
    node.children = group.children.map((child) => transformGroupToChartNode(child, depth + 1));
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

  if (objective.children && objective.children.length > 0) {
    node.children = objective.children.map(transformObjectiveToChartNode);
  }

  return node;
}

/*************************
 * Main Component
 *************************/
export default function IntervestOrgChart() {
  const [orgValue, setOrgValue] = useState([]);
  const [error, setError] = useState(null);
  const [expandedGroupId, setExpandedGroupId] = useState(null);
  const [groupDetails, setGroupDetails] = useState({});
  const [viewType, setViewType] = useState('strategy'); // 'strategy', 'groups', or 'objectives'
  const [groupsViewMode, setGroupsViewMode] = useState('hierarchy');
  const [objectivesValue, setObjectivesValue] = useState([]);
  const [expandedObjectiveId, setExpandedObjectiveId] = useState(null);
  const [groups, setGroups] = useState([]);
  const [selectedRootId, setSelectedRootId] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState({});
  const closeGuardRef = useRef(null);
  const _treeInitRef = useRef(false);

  // Use hooks for user and mainTree data
  const router = useRouter();
  const { user: currentUser, isLoading: userLoading } = useUser();
  const { isLoading: mainTreeLoading } = useMainTree();
  const mainTree = useMainTreeStore((state) => state.mainTree);
  const searchParams = useSearchParams();

  // Process groups from mainTree
  useEffect(() => {
    if (mainTree && mainTree.groups) {
      const groupsData = mainTree.groups;
      setGroups(groupsData);
      
      // Build hierarchy from flat array
      const groupMap = new Map();
      groupsData.forEach(group => {
        groupMap.set(group.id, { ...group, children: [] });
      });
      
      const rootGroups = [];
      groupsData.forEach(group => {
        const groupNode = groupMap.get(group.id);
        if (group.parent_group_id) {
          const parent = groupMap.get(group.parent_group_id);
          if (parent) {
            parent.children.push(groupNode);
          } else {
            rootGroups.push(groupNode);
          }
        } else {
          rootGroups.push(groupNode);
        }
      });
      
      const chartData = rootGroups.map(transformGroupToChartNode);
      setOrgValue(chartData);
    }
  }, [mainTree]);

  const parentGroups = useMemo(
    () =>
      orgValue
        .map((node) => {
          const data = node?.data || {};
          return {
            id: data.id,
            name: data.name || node.label || 'Group',
          };
        })
        .filter((group) => group.id),
    [orgValue]
  );

  const groupRootMap = useMemo(() => {
    const map = new Map();
    const traverse = (node, rootId) => {
      if (!node) return;
      const data = node?.data || {};
      const nodeId = data.id;
      const nextRootId = rootId || nodeId;
      if (nodeId && nextRootId) {
        map.set(nodeId, nextRootId);
      }
      if (Array.isArray(node.children)) {
        node.children.forEach((child) => traverse(child, nextRootId));
      }
    };
    orgValue.forEach((node) => traverse(node, node?.data?.id));
    return map;
  }, [orgValue]);

  const activeRootId =
    parentGroups.length > 1 ? selectedRootId || parentGroups[0]?.id || null : null;

  const visibleOrgValue = useMemo(() => {
    if (!activeRootId) return orgValue;
    const match = orgValue.find((node) => node?.data?.id === activeRootId);
    return match ? [match] : orgValue;
  }, [orgValue, activeRootId]);

  useEffect(() => {
    if (parentGroups.length <= 1) {
      if (selectedRootId !== null) {
        setSelectedRootId(null);
      }
      return;
    }

    let nextRootId = selectedRootId;
    if (expandedGroupId && groupRootMap.has(expandedGroupId)) {
      nextRootId = groupRootMap.get(expandedGroupId);
    }

    if (!nextRootId || !parentGroups.some((group) => group.id === nextRootId)) {
      nextRootId = parentGroups[0]?.id || null;
    }

    if (nextRootId !== selectedRootId) {
      setSelectedRootId(nextRootId);
    }
  }, [parentGroups, expandedGroupId, groupRootMap, selectedRootId]);

  // Listen for createGroup event from LeftMenu
  useEffect(() => {
    const handleCreateGroup = () => {
      setShowAddModal(true);
    };

    window.addEventListener('createGroup', handleCreateGroup);
    return () => {
      window.removeEventListener('createGroup', handleCreateGroup);
    };
  }, []);

  const refreshGroupData = async () => {
    try {
      const response = await fetch('/api/groups?hierarchy=true');
      if (!response.ok) {
        throw new Error('Failed to fetch group hierarchy');
      }
      
      const data = await response.json();
      
      const flattenGroups = (groupList, result = []) => {
        groupList.forEach(group => {
          const { children, ...groupWithoutChildren } = group;
          result.push(groupWithoutChildren);
          if (children && children.length > 0) {
            flattenGroups(children, result);
          }
        });
        return result;
      };
      
      const flatGroups = flattenGroups(data.groups);
      const setMainTree = useMainTreeStore.getState().setMainTree;
      setMainTree({ ...mainTree, groups: flatGroups });
    } catch (err) {
      console.error('Error refreshing group hierarchy:', err);
      setError(err.message);
    }
  };

  const fetchGroupDetails = (groupId, forceRefresh = false) => {
    if (groupDetails[groupId] && !forceRefresh) return;

    const group = mainTree?.groups?.find(g => g.id === groupId);
    if (!group) {
      console.warn('Group not found in mainTree:', groupId);
      return;
    }

    // Combine myOKRTs and sharedOKRTs to search for objectives
    const allOKRTs = [...(mainTree?.myOKRTs || []), ...(mainTree?.sharedOKRTs || [])];
    
    // Get strategic objectives based on strategicObjectiveIds from group
    const strategicObjectiveIds = group.strategicObjectiveIds || [];
    const strategicObjectives = allOKRTs
      .filter(okrt => strategicObjectiveIds.includes(okrt.id))
      .map(okrt => ({
        id: okrt.id,
        title: okrt.title,
        description: okrt.description,
        progress: okrt.progress || 0,
        owner_name: okrt.owner_name
      }));

    // Get shared objectives based on objectiveIds from group
    const sharedObjectives = allOKRTs
      .filter(okrt => group.objectiveIds?.includes(okrt.id))
      .map(okrt => ({
        id: okrt.id,
        title: okrt.title,
        description: okrt.description,
        progress: okrt.progress || 0,
        owner_name: okrt.owner_name
      }));

    // Combine all objectives (strategic + shared, avoiding duplicates)
    const allObjectivesMap = new Map();
    
    // Add strategic objectives first
    strategicObjectives.forEach(obj => allObjectivesMap.set(obj.id, obj));
    
    // Add shared objectives (will not duplicate if already in strategic)
    sharedObjectives.forEach(obj => {
      if (!allObjectivesMap.has(obj.id)) {
        allObjectivesMap.set(obj.id, obj);
      }
    });

    const combinedObjectives = Array.from(allObjectivesMap.values());

    setGroupDetails(prev => ({
      ...prev,
      [groupId]: {
        members: group.members || [],
        objectives: combinedObjectives,
        strategicObjectiveIds: strategicObjectiveIds,
        count: combinedObjectives.length,
        memberCount: group.members?.length || 0
      }
    }));
  };

  const buildObjectivesHierarchy = () => {
    if (!mainTree || !mainTree.sharedOKRTs) {
      setObjectivesValue([]);
      return;
    }

    const objectives = mainTree.sharedOKRTs;
    const rootObjectives = objectives.filter(obj => !obj.parent_id);
    
    const buildHierarchy = (parentId) => {
      return objectives
        .filter(obj => obj.parent_id === parentId)
        .map(obj => ({ ...obj, children: buildHierarchy(obj.id) }));
    };
    
    const hierarchicalObjectives = rootObjectives.map(obj => ({
      ...obj,
      children: buildHierarchy(obj.id)
    }));
    
    const chartData = hierarchicalObjectives.map(transformObjectiveToChartNode);
    setObjectivesValue(chartData);
  };

  const handleNodeClick = (groupId) => {
    if (groupId === expandedGroupId) {
      setExpandedGroupId(null);
    } else if (groupId) {
      closeGuardRef.current = null;
      setExpandedGroupId(groupId);
      fetchGroupDetails(groupId);
    } else {
      const currentGroupId = expandedGroupId || searchParams?.get('groupId');
      closeGuardRef.current = currentGroupId || null;
      setExpandedGroupId(null);
    }

    if (!groupId && searchParams?.get('groupId')) {
      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.delete('groupId');
      const query = nextParams.toString();
      router.replace(query ? `/organisation?${query}` : '/organisation');
    }
  };

  const handleObjectiveClick = (objectiveId) => {
    if (!objectiveId) return;
    router.push(`/shared/${objectiveId}`);
  };

  const handleObjectiveNodeClick = (objectiveId) => {
    setExpandedObjectiveId(objectiveId === expandedObjectiveId ? null : objectiveId);
  };

  const groupSummaryMap = useMemo(() => {
    const map = new Map();
    const walk = (nodes) => {
      nodes.forEach((node) => {
        const data = node?.data || {};
        const groupId = data.id;
        if (groupId !== undefined && groupId !== null) {
          map.set(String(groupId), {
            name: data.name || node.label || 'Group',
            objectiveCount: Number.isFinite(data.objectiveCount) ? data.objectiveCount : 0,
            memberCount: Number.isFinite(data.memberCount) ? data.memberCount : 0,
            groupId,
          });
        }
        if (Array.isArray(node.children) && node.children.length > 0) {
          walk(node.children);
        }
      });
    };
    walk(orgValue);
    return map;
  }, [orgValue]);

  const treeNodes = useMemo(() => {
    const buildTreeNodes = (nodes, parentKey = 'group') =>
      nodes.map((node, index) => {
        const data = node?.data || {};
        const keyValue = data.id ?? node.label ?? `${parentKey}-${index}`;
        const key = String(keyValue);
        const children = Array.isArray(node.children)
          ? buildTreeNodes(node.children, key)
          : [];
        return {
          key,
          label: data.name || node.label || 'Group',
          data,
          children,
          leaf: children.length === 0,
        };
      });
    return buildTreeNodes(visibleOrgValue);
  }, [visibleOrgValue]);

  const handleTreeToggle = (event) => {
    setExpandedKeys(event.value || {});
  };

  const handleTreeExpand = (event) => {
    const groupId = event?.node?.data?.id ?? event?.node?.key;
    if (groupId) {
      fetchGroupDetails(groupId);
    }
  };

  useEffect(() => {
    // Initialize tree expansion only once when entering tree view
    if (groupsViewMode !== 'tree') {
      _treeInitRef.current = false;
      return;
    }
    if (!treeNodes.length) return;
    if (_treeInitRef.current) return;

    const firstNode = treeNodes[0];
    if (!firstNode?.key) return;
    setExpandedKeys({ [firstNode.key]: true });
    if (firstNode.data?.id) {
      fetchGroupDetails(firstNode.data.id);
    }
    _treeInitRef.current = true;
  }, [groupsViewMode, treeNodes]);

  const renderGroupTreeNode = (node, options) => {
    const data = node?.data || {};
    const memberCount = Number.isFinite(data.memberCount) ? data.memberCount : 0;
    const objectiveCount = Number.isFinite(data.objectiveCount) ? data.objectiveCount : 0;
    const title = data.name || node.label || 'Group';
    const details = groupDetails[data.id];
    const members = details?.members || [];
    const showMembers = options.expanded;

    return (
      <div className={`${options.className || ''} ${styles.groupsTreeNode}`}>
        <button
          type="button"
          className={styles.groupsTreeButton}
          onClick={() => handleNodeClick(data.id)}
          title={title}
        >
          <span className={styles.groupsTreeName}>
            <HiOutlineUsers className={styles.groupsTreeIcon} aria-hidden="true" />
            {title}
            {data.type ? (
              <span className={styles.groupsTreeType}>({data.type})</span>
            ) : null}
          </span>
          <span className={styles.groupsTreeMeta}>
            {objectiveCount} objective{objectiveCount === 1 ? '' : 's'} · {memberCount} member{memberCount === 1 ? '' : 's'}
          </span>
        </button>
        {showMembers && (
          <div className={styles.groupsTreeMembers}>
            {!details ? (
              <div className={styles.groupsTreeMemberEmpty}>Loading members...</div>
            ) : members.length === 0 ? (
              <div className={styles.groupsTreeMemberEmpty}>No members</div>
            ) : (
              <ul className={styles.groupsTreeMemberList}>
                {members.map((member) => {
                  const fullName = [member.first_name, member.last_name]
                    .filter(Boolean)
                    .join(' ');
                  const displayName =
                    fullName || member.display_name || member.email || 'Unknown';
                  return (
                    <li key={member.id || displayName} className={styles.groupsTreeMember}>
                      <span className={styles.groupsTreeMemberAvatar}>
                        {displayName?.[0]?.toUpperCase() || '?'}
                      </span>
                      <span className={styles.groupsTreeMemberName}>{displayName}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    );
  };

  const handleEditGroup = (groupData) => {
    const group = mainTree?.groups?.find(g => g.id === groupData.id);
    if (group) {
      setEditingGroup({
        id: group.id,
        name: group.name,
        type: group.type,
        parent_group_id: group.parent_group_id,
        thumbnail_url: group.thumbnail_url,
        vision: group.vision,
        mission: group.mission,
        members: group.members || [],
        strategicObjectiveIds: group.strategicObjectiveIds || []
      });
    } else {
      setEditingGroup({ ...groupData, members: [], strategicObjectiveIds: [] });
    }
    setShowEditModal(true);
  };

  const handleAddGroup = async (groupData) => {
    const response = await fetch('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(groupData),
    });

    if (response.ok) {
      await refreshGroupData();
      setShowAddModal(false);
    } else {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create group');
    }
  };

  const handleUpdateGroup = async (groupData) => {
    const response = await fetch(`/api/groups/${editingGroup.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(groupData),
    });

    if (response.ok) {
      const groupId = editingGroup.id;
      await refreshGroupData();
      setShowEditModal(false);
      setEditingGroup(null);
      setGroupDetails(prev => {
        const newDetails = { ...prev };
        delete newDetails[groupId];
        return newDetails;
      });
    } else {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update group');
    }
  };

  const handleMemberRemoved = async (groupId) => {
    await refreshGroupData();
    setGroupDetails(prev => {
      const newDetails = { ...prev };
      delete newDetails[groupId];
      return newDetails;
    });
  };

  const handleDeleteGroup = async () => {
    if (!groupToDelete) return;

    const response = await fetch(`/api/groups/${groupToDelete.id}`, {
      method: 'DELETE',
    });

    if (response.ok) {
      await refreshGroupData();
      setShowDeleteConfirm(false);
      setGroupToDelete(null);
      setShowEditModal(false);
      setEditingGroup(null);
      setExpandedGroupId(null);
    } else {
      const errorData = await response.json();
      setError(errorData.error || 'Failed to delete group');
    }
  };

  const handleDeleteClick = () => {
    setGroupToDelete(editingGroup);
    setShowDeleteConfirm(true);
  };

  // Sync viewType with URL query (?view=strategy|groups|objectives)
  useEffect(() => {
    const viewParam = searchParams?.get('view');
    const allowedViews = new Set(['strategy', 'groups', 'objectives']);
    const nextView = allowedViews.has(viewParam) ? viewParam : 'strategy';
    setViewType(nextView);
    if (nextView === 'objectives' && objectivesValue.length === 0) {
      buildObjectivesHierarchy();
    }
  }, [searchParams]);

  useEffect(() => {
    const groupIdParam = searchParams?.get('groupId');
    if (!groupIdParam || !mainTree?.groups?.length) {
      if (!groupIdParam) {
        closeGuardRef.current = null;
      }
      return;
    }

    if (closeGuardRef.current && closeGuardRef.current === groupIdParam) {
      return;
    }

    setViewType('groups');
    if (groupIdParam !== expandedGroupId) {
      setExpandedGroupId(groupIdParam);
      fetchGroupDetails(groupIdParam);
    }
  }, [searchParams, expandedGroupId, mainTree]);

  return (
    <div className={`app-page ${styles.container}`}>
      <div className={`app-pageContent app-pageContent--full ${styles.content}`}>
        {viewType === 'strategy' && (
          <div className="app-pageHeader">
            <div className="app-titleSection">
              <GiGreekTemple className="app-pageIcon" />
              <h1 className="app-pageTitle">Strategy House</h1>
            </div>
          </div>
        )}
        {viewType === 'groups' && (
          <div className={`app-pageHeader ${styles.groupsHeader}`}>
            <div className="app-titleSection">
              <RiOrganizationChart className="app-pageIcon" />
              <h1 className="app-pageTitle">Groups</h1>
            </div>
            {parentGroups.length > 1 && (
              <div className={styles.parentFilter}>
                <label className="app-headerLabel" htmlFor="parentGroupSelect">
                  Root Group
                </label>
                <select
                  id="parentGroupSelect"
                  className="app-headerSelect"
                  value={activeRootId || ''}
                  onChange={(event) => setSelectedRootId(event.target.value)}
                >
                  {parentGroups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className={styles.viewSwitcher} role="group" aria-label="Groups view">
              <div
                className={`${styles.viewThumb} ${groupsViewMode === 'tree' ? styles.thumbTree : styles.thumbHierarchy}`}
                aria-hidden="true"
              />
              <button
                type="button"
                className={`${styles.viewButton} ${groupsViewMode === 'hierarchy' ? styles.activeView : ''}`}
                onClick={() => setGroupsViewMode('hierarchy')}
                aria-pressed={groupsViewMode === 'hierarchy'}
                aria-label="Hierarchy view"
                title="Hierarchy view"
              >
                <RiOrganizationChart className={styles.viewIcon} />
              </button>
              <button
                type="button"
                className={`${styles.viewButton} ${groupsViewMode === 'tree' ? styles.activeView : ''}`}
                onClick={() => setGroupsViewMode('tree')}
                aria-pressed={groupsViewMode === 'tree'}
                aria-label="Tree view"
                title="Tree view"
              >
                <PiTreeView className={styles.viewIcon} />
              </button>
            </div>
          </div>
        )}
        {viewType === 'strategy' && (
          <div className={`${styles.strategyContainer} ${styles.strategySurface}`}>
            <div className={styles.strategySurfaceContent}>
              <StrategyHouse />
            </div>
          </div>
        )}

        {viewType === 'groups' && (
          <div className={styles.strategySurface}>
            <div className={styles.strategySurfaceContent}>
              {groupsViewMode === 'hierarchy' ? (
                <GroupsView
                  orgValue={orgValue}
                  groupDetails={groupDetails}
                  currentUserId={currentUser?.id}
                  currentUserRole={currentUser?.role}
                  onNodeClick={handleNodeClick}
                  expandedGroupId={expandedGroupId}
                  onEditGroup={handleEditGroup}
                  onAddGroup={handleAddGroup}
                  groups={groups}
                  mainTreeLoading={mainTreeLoading}
                  userLoading={userLoading}
                  error={error}
                  selectedRootId={activeRootId}
                />
              ) : (
                <div className={styles.groupsTree}>
                  {(mainTreeLoading || userLoading) && (
                    <div className={styles.loading}>Loading group hierarchy...</div>
                  )}
                  {error && <div className={styles.error}>Error: {error}</div>}
                  {!mainTreeLoading && !userLoading && !error && orgValue.length === 0 && (
                    <div className={styles.empty}>No groups found. Create a group to get started.</div>
                  )}
                  {!mainTreeLoading && !userLoading && !error && orgValue.length > 0 && (
                    <Tree
                      value={treeNodes}
                      expandedKeys={expandedKeys}
                      onToggle={handleTreeToggle}
                      onExpand={handleTreeExpand}
                      nodeTemplate={renderGroupTreeNode}
                      className={styles.groupsPrimeTree}
                    />
                  )}
                </div>
              )}
            </div>
            {groupsViewMode === 'tree' && expandedGroupId && groupDetails[expandedGroupId] && (
              <GroupDetailsPopover
                group={
                  groupSummaryMap.get(String(expandedGroupId)) || {
                    name: 'Group',
                    objectiveCount: 0,
                    memberCount: 0,
                    groupId: expandedGroupId,
                  }
                }
                details={groupDetails[expandedGroupId]}
                onClose={() => handleNodeClick(null)}
                onEditGroup={handleEditGroup}
                currentUserId={currentUser?.id}
                currentUserRole={currentUser?.role}
                onObjectiveClick={handleObjectiveClick}
              />
            )}
          </div>
        )}

        {viewType === 'objectives' && (
          <div className={`${styles.strategySurface} ${styles.objectiveSurface}`}>
            <div className={styles.strategySurfaceContent}>
              <ObjectivesView
                objectivesValue={objectivesValue}
                expandedObjectiveId={expandedObjectiveId}
                onNodeClick={handleObjectiveNodeClick}
                mainTreeLoading={mainTreeLoading}
              />
            </div>
          </div>
        )}
      </div>

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
        onMemberRemoved={handleMemberRemoved}
        existingMembersFromMainTree={editingGroup?.members}
        mainTree={mainTree}
      />

      {/* Add Group Modal */}
      <AddGroupModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleAddGroup}
        groups={groups}
        mainTree={mainTree}
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
              <button className={styles.cancelButton} onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </button>
              <button className={styles.deleteButton} onClick={handleDeleteGroup}>
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
