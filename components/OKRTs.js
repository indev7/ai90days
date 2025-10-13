'use client';

import { useState } from 'react';
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView';
import { TreeItem } from '@mui/x-tree-view/TreeItem';
import { styled } from '@mui/material/styles';
import styles from './OKRTs.module.css';

const StyledTreeItem = styled(TreeItem)(({ theme, objectiveColor }) => ({
  '& .MuiTreeItem-content': {
    padding: '8px 12px',
    borderRadius: '6px',
    marginBottom: '4px',
    transition: 'background-color 0.2s',
    '&:hover': {
      backgroundColor: 'var(--background-secondary)',
    },
    '&.Mui-selected': {
      backgroundColor: 'var(--background-secondary)',
      '&:hover': {
        backgroundColor: 'var(--background-secondary)',
      },
    },
  },
  '& .MuiTreeItem-label': {
    fontSize: '0.875rem',
    color: 'var(--text-primary)',
    fontWeight: '400',
  },
  '& .MuiTreeItem-iconContainer': {
    width: '20px',
    marginRight: '8px',
    color: objectiveColor || 'var(--text-secondary)',
  },
}));

export default function OKRTs({ okrts = [] }) {
  const [expanded, setExpanded] = useState([]);

  const organizeHierarchy = () => {
    const objectives = okrts.filter(okrt => okrt.type === 'O');
    
    return objectives.map(objective => {
      const krs = okrts.filter(okrt => 
        okrt.type === 'K' && okrt.parent_id === objective.id
      );
      
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

  const handleToggle = (event, nodeIds) => {
    setExpanded(nodeIds);
  };

  const hierarchy = organizeHierarchy();

  if (hierarchy.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>No objectives available for current quarter</p>
      </div>
    );
  }

  const formatProgress = (progress) => {
    return progress !== undefined && progress !== null ? `${progress}%` : '';
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      'todo': { label: 'To Do', color: 'var(--text-secondary)' },
      'in-progress': { label: 'In Progress', color: 'var(--brand-primary)' },
      'done': { label: 'Done', color: 'var(--success)' },
      'blocked': { label: 'Blocked', color: 'var(--error)' }
    };
    return statusMap[status] || { label: status, color: 'var(--text-secondary)' };
  };

  return (
    <div className={styles.treeContainer}>
      <SimpleTreeView
        expanded={expanded}
        onExpandedItemsChange={handleToggle}
        sx={{
          flexGrow: 1,
          overflowY: 'auto',
        }}
      >
        {hierarchy.map(objective => (
          <StyledTreeItem
            key={objective.id}
            itemId={objective.id}
            label={
              <div className={styles.nodeLabel}>
                <span className={styles.nodeTitle}>
                  {objective.title || objective.description}
                </span>
                {objective.krs && objective.krs.length > 0 && (
                  <span className={styles.nodeCount}>
                    {objective.krs.length} KR{objective.krs.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            }
            objectiveColor={objective.color}
          >
            {objective.krs && objective.krs.map(kr => (
              <StyledTreeItem
                key={kr.id}
                itemId={kr.id}
                label={
                  <div className={styles.nodeLabel}>
                    <span className={`${styles.nodeDescription} ${styles.krDescription}`}>
                      {kr.description || kr.title}
                    </span>
                    <div className={styles.nodeMetadata}>
                      {kr.tasks && kr.tasks.length > 0 && (
                        <span className={styles.nodeCount}>
                          {kr.tasks.length} Task{kr.tasks.length !== 1 ? 's' : ''}
                        </span>
                      )}
                      {kr.progress !== undefined && (
                        <span className={styles.progress} style={{ color: objective.color }}>
                          {formatProgress(kr.progress)}
                        </span>
                      )}
                    </div>
                  </div>
                }
                objectiveColor={objective.color}
              >
                {kr.tasks && kr.tasks.map(task => (
                  <StyledTreeItem
                    key={task.id}
                    itemId={task.id}
                    label={
                      <div className={styles.nodeLabel}>
                        <span className={`${styles.nodeDescription} ${styles.taskDescription}`}>
                          {task.description || task.title}
                        </span>
                        <div className={styles.nodeMetadata}>
                          {task.task_status && (
                            <span 
                              className={styles.statusBadge}
                              style={{ color: getStatusBadge(task.task_status).color }}
                            >
                              {getStatusBadge(task.task_status).label}
                            </span>
                          )}
                          {task.progress !== undefined && (
                            <span className={styles.progress} style={{ color: objective.color }}>
                              {formatProgress(task.progress)}
                            </span>
                          )}
                        </div>
                      </div>
                    }
                    objectiveColor={objective.color}
                  />
                ))}
              </StyledTreeItem>
            ))}
          </StyledTreeItem>
        ))}
      </SimpleTreeView>
    </div>
  );
}
