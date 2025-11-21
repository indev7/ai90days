"use client";
import React, { useState, useEffect, useRef } from 'react';
import { OrganizationChart } from "primereact/organizationchart";
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
 * Objective Node Template
 */
function ObjectiveNodeTemplate(node, expandedObjectiveId, onNodeClick) {
  const d = node.data || {};
  const nodeRef = useRef(null);
  const isExpanded = expandedObjectiveId === d.id;

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
            {d.description && (
              <div className={styles.objectivesSection}>
                <div className={styles.objectiveTitle}>Description</div>
                <div className={styles.emptyText}>{d.description}</div>
              </div>
            )}
            
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

/**
 * ObjectivesView Component
 */
export default function ObjectivesView({ 
  objectivesValue, 
  expandedObjectiveId, 
  onNodeClick,
  mainTreeLoading 
}) {
  return (
    <>
      {mainTreeLoading && (
        <div className={styles.loading}>
          Loading objectives hierarchy...
        </div>
      )}
      
      {!mainTreeLoading && objectivesValue.length === 0 && (
        <div className={styles.empty}>
          No shared objectives found.
        </div>
      )}
      
      {!mainTreeLoading && objectivesValue.length > 0 && (
        <div className={styles.chartContainer}>
          {objectivesValue.map((rootObjective, index) => (
            <div key={rootObjective.data?.id || index} className={styles.chartSection}>
              <OrganizationChart
                value={[rootObjective]}
                nodeTemplate={(node) => ObjectiveNodeTemplate(node, expandedObjectiveId, onNodeClick)}
                collapsible={false}
              />
            </div>
          ))}
        </div>
      )}
    </>
  );
}