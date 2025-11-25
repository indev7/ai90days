"use client";
import React, { useState, useEffect, useMemo } from "react";
import { RiDeleteBin6Line } from 'react-icons/ri';
import "primereact/resources/themes/lara-light-blue/theme.css";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";
import AddGroupModal from '../../components/AddGroupModal';
import { useUser } from '@/hooks/useUser';
import { useMainTree } from '@/hooks/useMainTree';
import useMainTreeStore from '@/store/mainTreeStore';
import StrategyHouse from './StrategyHouse';
import GroupsView from './GroupsView';
import ObjectivesView from './ObjectivesView';
import styles from './page.module.css';

/*************************
 * Helpers
 *************************/
/** Transform API group data to OrganizationChart format */
function transformGroupToChartNode(group) {
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
  const [objectivesValue, setObjectivesValue] = useState([]);
  const [expandedObjectiveId, setExpandedObjectiveId] = useState(null);
  const [groups, setGroups] = useState([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Use hooks for user and mainTree data
  const { user: currentUser, isLoading: userLoading } = useUser();
  const { isLoading: mainTreeLoading } = useMainTree();
  const mainTree = useMainTreeStore((state) => state.mainTree);

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
      setExpandedGroupId(groupId);
      fetchGroupDetails(groupId);
    } else {
      setExpandedGroupId(null);
    }
  };

  const handleObjectiveNodeClick = (objectiveId) => {
    setExpandedObjectiveId(objectiveId === expandedObjectiveId ? null : objectiveId);
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

  return (
    <div className={styles.container}>
      {/* PrimeReact overrides & connector tuning */}
      <style>{`
        .p-organizationchart { width: 100% !important; }
        .p-organizationchart table { width: 100% !important; }
        .p-organizationchart .p-organizationchart-node { padding: 0 12px !important; text-align: center !important; }
        .p-organizationchart .p-organizationchart-node-content { padding: 0 !important; border-radius: 5px; border: none !important; background: transparent; margin: 0 auto !important; position: relative !important; box-sizing: border-box !important; display: inline-block !important; }
        .p-organizationchart .p-organizationchart-node-content .p-organizationchart-toggler { position: absolute !important; left: 50% !important; bottom: -12px !important; margin: 0 !important; padding: 0 !important; }
        .p-organizationchart .p-organizationchart-node-content .p-organizationchart-toggler button, .p-organizationchart .p-organizationchart-node-content .p-organizationchart-toggler .p-button { display: block !important; margin: 0 !important; padding: 0 !important; transform: translateX(-50%) !important; }
        .p-organizationchart .p-organizationchart-node-content .p-node-toggler .p-node-toggler-icon, .p-organizationchart .p-icon.p-node-toggler-icon { position: relative !important; top: .3rem !important; left:-0.75rem; }
        .p-organizationchart .p-organizationchart-line-down { height: 12px !important; min-height: 12px !important; margin: 0 auto !important; border-left: 1px solid var(--border) !important; }
        .p-organizationchart .p-organizationchart-lines .p-organizationchart-line-left { border-right: 1px solid var(--border) !important; }
        .p-organizationchart .p-organizationchart-lines .p-organizationchart-line-right { border-left: 1px solid var(--border) !important; }
        .p-organizationchart .p-organizationchart-lines .p-organizationchart-line-top { border-top: 1px solid var(--border) !important; }
        .p-organizationchart .p-organizationchart-lines td { padding-top: 8px !important; padding-bottom: 8px !important; line-height: 0; }
        .p-organizationchart .p-organizationchart-node { margin-top: 0 !important; margin-bottom: 0 !important; }
      `}</style>

      <div className={styles.content}>
        {/* Toggle Switch */}
        <div className={styles.header}>
          <div className={styles.viewToggle}>
            <div className={styles.toggleSwitch}>
              <button
                className={`${styles.toggleOption} ${viewType === 'strategy' ? styles.active : ''}`}
                onClick={() => setViewType('strategy')}
              >
                Strategy
              </button>
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
                    buildObjectivesHierarchy();
                  }
                }}
              >
                Objectives
              </button>
            </div>
          </div>
        </div>
        
        {/* Render appropriate view based on viewType */}
        {viewType === 'strategy' && (
          <div className={styles.strategyContainer}>
            <StrategyHouse />
          </div>
        )}

        {viewType === 'groups' && (
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
          />
        )}

        {viewType === 'objectives' && (
          <ObjectivesView
            objectivesValue={objectivesValue}
            expandedObjectiveId={expandedObjectiveId}
            onNodeClick={handleObjectiveNodeClick}
            mainTreeLoading={mainTreeLoading}
          />
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
