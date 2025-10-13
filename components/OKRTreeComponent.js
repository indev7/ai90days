'use client';

import { useState } from 'react';
import { FaChevronRight, FaChevronDown } from 'react-icons/fa';
import styles from './OKRTreeComponent.module.css';

export default function OKRTreeComponent({ okrts = [] }) {
  const [expandedNodes, setExpandedNodes] = useState(new Set());

  // Organize OKRTs into a hierarchical structure
  const organizeHierarchy = () => {
    // Get all objectives (top-level items)
    const objectives = okrts.filter(okrt => okrt.type === 'O');
    
    // Build hierarchy
    return objectives.map(objective => {
      // Find KRs for this objective
      const krs = okrts.filter(okrt => 
        okrt.type === 'K' && okrt.parent_id === objective.id
      );
      
      // Find tasks for each KR
      const krsWithTasks = krs.map(kr => ({
        ...kr,
        tasks: okrts.filter(okrt => 
          okrt.type === 'T' && okrt.parent_id === kr.id
        )
      }));
      
      return {
        ...objective,
        krs: krsWithTasks
      };
    });
  };

  const toggleNode = (nodeId) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  const isExpanded = (nodeId) => expandedNodes.has(nodeId);

  const hierarchy = organizeHierarchy();

  if (hierarchy.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>No objectives available</p>
      </div>
    );
  }

  return (
    <div className={styles.treeContainer}>
      {hierarchy.map(objective => (
        <div key={objective.id} className={styles.objectiveNode}>
          {/* Objective Row */}
          <div className={styles.nodeRow}>
            <button
              className={styles.expandButton}
              onClick={() => toggleNode(objective.id)}
              disabled={!objective.krs || objective.krs.length === 0}
            >
              {objective.krs && objective.krs.length > 0 ? (
                isExpanded(objective.id) ? (
                  <FaChevronDown />
                ) : (
                  <FaChevronRight />
                )
              ) : (
                <span className={styles.emptyIcon}></span>
              )}
            </button>
            <div className={styles.nodeContent}>
              <div className={styles.nodeTitle}>
                {objective.title || objective.description}
              </div>
              {objective.krs && objective.krs.length > 0 && (
                <div className={styles.nodeCount}>
                  {objective.krs.length} {objective.krs.length === 1 ? 'KR' : 'KRs'}
                </div>
              )}
            </div>
          </div>

          {/* KRs (expanded) */}
          {isExpanded(objective.id) && objective.krs && objective.krs.length > 0 && (
            <div className={styles.krList}>
              {objective.krs.map(kr => (
                <div key={kr.id} className={styles.krNode}>
                  {/* KR Row */}
                  <div className={styles.nodeRow}>
                    <button
                      className={styles.expandButton}
                      onClick={() => toggleNode(kr.id)}
                      disabled={!kr.tasks || kr.tasks.length === 0}
                    >
                      {kr.tasks && kr.tasks.length > 0 ? (
                        isExpanded(kr.id) ? (
                          <FaChevronDown />
                        ) : (
                          <FaChevronRight />
                        )
                      ) : (
                        <span className={styles.emptyIcon}></span>
                      )}
                    </button>
                    <div className={styles.nodeContent}>
                      <div className={styles.nodeDescription}>
                        {kr.description || kr.title}
                      </div>
                      {kr.tasks && kr.tasks.length > 0 && (
                        <div className={styles.nodeCount}>
                          {kr.tasks.length} {kr.tasks.length === 1 ? 'Task' : 'Tasks'}
                        </div>
                      )}
                      {kr.progress !== undefined && (
                        <div className={styles.progressContainer}>
                          <div className={styles.progressBar}>
                            <div 
                              className={styles.progressFill} 
                              style={{ 
                                width: `${kr.progress || 0}%`,
                                backgroundColor: objective.color || '#666'
                              }}
                            />
                          </div>
                          <span className={styles.progressText}>
                            {kr.progress || 0}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Tasks (expanded) */}
                  {isExpanded(kr.id) && kr.tasks && kr.tasks.length > 0 && (
                    <div className={styles.taskList}>
                      {kr.tasks.map(task => (
                        <div key={task.id} className={styles.taskNode}>
                          <div className={styles.nodeRow}>
                            <div className={styles.expandButton}>
                              <span className={styles.emptyIcon}></span>
                            </div>
                            <div className={styles.nodeContent}>
                              <div className={styles.nodeDescription}>
                                {task.description || task.title}
                              </div>
                              {task.progress !== undefined && (
                                <div className={styles.progressContainer}>
                                  <div className={styles.progressBar}>
                                    <div 
                                      className={styles.progressFill} 
                                      style={{ 
                                        width: `${task.progress || 0}%`,
                                        backgroundColor: objective.color || '#666'
                                      }}
                                    />
                                  </div>
                                  <span className={styles.progressText}>
                                    {task.progress || 0}%
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
