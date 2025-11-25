"use client";
import React, { useState, useEffect, useRef } from 'react';
import { OrganizationChart } from "primereact/organizationchart";
import { GrTrophy } from 'react-icons/gr';
import { FaFlagCheckered } from 'react-icons/fa';
import { RiAdminLine } from 'react-icons/ri';
import { FaRegUser } from 'react-icons/fa';
import { FaPlus } from 'react-icons/fa';
import AddGroupModal from '../../components/AddGroupModal';
import styles from './page.module.css';

/**
 * Progress Bar Component
 */
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

/**
 * Expanded Group Content
 */
function ExpandedGroupContent({ group, objectives = [], members = [], currentUserId, onEditClick }) {
  const isAdmin = members.some(member => member.id === currentUserId && member.is_admin);
  
  const handleClick = (e) => {
    if (isAdmin) {
      e.stopPropagation();
      onEditClick();
    }
  };
  
  // Separate strategic objectives from other shared objectives
  const strategicObjectiveIds = group.strategicObjectiveIds || [];
  const strategicObjectives = objectives.filter(obj => strategicObjectiveIds.includes(obj.id));
  const otherObjectives = objectives.filter(obj => !strategicObjectiveIds.includes(obj.id));
  
  return (
    <div
      className={styles.expandedDetails}
      onClick={handleClick}
      style={isAdmin ? { cursor: 'pointer' } : undefined}
      title={isAdmin ? "Click to edit group" : undefined}
    >
      {/* Strategic Objectives Section */}
      {strategicObjectives.length > 0 && (
        <>
          <div className={styles.objectivesSection}>
            <div className={styles.sectionLabel}>Strategic Objectives</div>
            {strategicObjectives.map((objective) => (
              <div key={objective.id} className={styles.objectiveItem}>
                <FaFlagCheckered className={styles.objectiveIcon} />
                <div className={styles.objectiveContent}>
                  <div className={styles.objectiveTitle}>{objective.title}</div>
                  <div className={styles.objectiveProgress}>
                    <ProgressBar value={objective.progress} />
                    <div className={styles.progressText}>{Math.round(objective.progress)}%</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {otherObjectives.length > 0 && <div className={styles.divider} />}
        </>
      )}

      {/* Other Shared Objectives Section */}
      {otherObjectives.length > 0 && (
        <div className={styles.objectivesSection}>
          <div className={styles.sectionLabel}>Shared Objectives</div>
          {otherObjectives.map((objective) => (
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
        </div>
      )}
      
      {objectives.length === 0 && (
        <div className={styles.objectivesSection}>
          <div className={styles.emptyText}>No objectives shared yet.</div>
        </div>
      )}

      <div className={styles.divider} />

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

/**
 * Node Template
 */
function NodeTemplate(node, expandedGroupId, onNodeClick, groupDetails, currentUserId, onEditGroup) {
  const d = node.data || {};
  const nodeRef = useRef(null);
  const isExpanded = expandedGroupId === d.id;

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

  const title = d.name || node.label;
  const metaParts = [];
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
            group={{ ...d, strategicObjectiveIds: details.strategicObjectiveIds || [] }}
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

/**
 * GroupsView Component
 */
export default function GroupsView({
  orgValue,
  groupDetails,
  currentUserId,
  onNodeClick,
  expandedGroupId,
  onEditGroup,
  onAddGroup,
  groups,
  mainTreeLoading,
  userLoading,
  error,
  currentUserRole
}) {
  return (
    <>
      {(mainTreeLoading || userLoading) && (
        <div className={styles.loading}>
          Loading group hierarchy...
        </div>
      )}
      
      {error && (
        <div className={styles.error}>
          Error: {error}
        </div>
      )}
      
      {!mainTreeLoading && !userLoading && !error && orgValue.length === 0 && (
        <div className={styles.empty}>
          No groups found. Create a group to get started.
        </div>
      )}
      
      {!mainTreeLoading && !userLoading && !error && orgValue.length > 0 && (
        <div className={styles.chartContainer}>
          {orgValue.map((rootGroup, index) => (
            <div key={rootGroup.data?.id || index} className={styles.chartSection}>
              <OrganizationChart
                value={[rootGroup]}
                nodeTemplate={(node) => NodeTemplate(node, expandedGroupId, onNodeClick, groupDetails, currentUserId, onEditGroup)}
                collapsible={false}
              />
            </div>
          ))}
        </div>
      )}
    </>
  );
}