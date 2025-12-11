'use client';

import { useState } from 'react';
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView';
import { TreeItem } from '@mui/x-tree-view/TreeItem';
import { styled } from '@mui/material/styles';
import { GrTrophy } from 'react-icons/gr';
import { GiGolfFlag } from 'react-icons/gi';
import { LiaGolfBallSolid } from 'react-icons/lia';
import { FaPlus } from 'react-icons/fa';
import { getThemeColorPalette } from '@/lib/clockUtils';
import styles from './OKRTs.module.css';

// Get colors from centralized source
const PROTOTYPE_COLORS = getThemeColorPalette();

const StyledTreeItem = styled(
  TreeItem,
  {
    shouldForwardProp: (prop) => !['objectiveColor', 'objectiveIndex', 'isKR', 'isTask'].includes(prop),
  },
)(({ theme, objectiveColor, objectiveIndex, isKR, isTask }) => ({
  '& .MuiTreeItem-content': {
    padding: '8px 12px',
    borderRadius: '6px',
    marginBottom: '4px',
    transition: 'background-color 0.2s, opacity 0.1s',
    backgroundColor: objectiveIndex !== undefined
      ? (isTask ? `${objectiveColor}1A` : isKR ? `${objectiveColor}40` : `${objectiveColor}33`) // 1A = 10% for tasks, 40 = 25% for KRs, 33 = 20% for objectives
      : 'transparent',
    '&:hover': {
      backgroundColor: objectiveIndex !== undefined
        ? (isTask ? `${objectiveColor}26` : isKR ? `${objectiveColor}4D` : `${objectiveColor}40`) // 40 = 25% hover for objectives (lighter purple, not blue)
        : 'var(--background-secondary)',
    },
    '&.Mui-focused': {
      backgroundColor: objectiveIndex !== undefined
        ? (isTask ? `${objectiveColor}1A` : isKR ? `${objectiveColor}40` : `${objectiveColor}33`) // Keep original opacity when focused
        : 'transparent',
    },
    '&.Mui-selected': {
      backgroundColor: objectiveIndex !== undefined
        ? (isTask ? `${objectiveColor}1A` : isKR ? `${objectiveColor}40` : `${objectiveColor}33`) // Keep original opacity when selected
        : 'transparent',
      '&:hover': {
        backgroundColor: objectiveIndex !== undefined
          ? (isTask ? `${objectiveColor}26` : isKR ? `${objectiveColor}4D` : `${objectiveColor}40`) // 40 = 25% hover for objectives
          : 'var(--background-secondary)',
      },
    },
    '&.Mui-selected.Mui-focused': {
      backgroundColor: objectiveIndex !== undefined
        ? (isTask ? `${objectiveColor}1A` : isKR ? `${objectiveColor}40` : `${objectiveColor}33`) // Keep original opacity when both selected and focused
        : 'transparent',
    },
  },
  '& .MuiTreeItem-label': {
    fontSize: '0.875rem',
    color: 'var(--text-primary)',
    fontWeight: '400',
  },
  '& .MuiTreeItem-iconContainer': {
    display: 'none', // Hide chevron icons
  },
}));

export default function OKRTs({ okrts = [], onAddTask }) {
  const [expanded, setExpanded] = useState([]);

  const organizeHierarchy = () => {
    // Sort objectives by created_at to match the color sequence in TwelveWeekClock
    const objectives = okrts
      .filter(okrt => okrt.type === 'O')
      .sort((a, b) => {
        const dateA = new Date(a.created_at || 0);
        const dateB = new Date(b.created_at || 0);
        return dateA - dateB;
      });
    
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
        {hierarchy.map((objective, objIndex) => {
          const objectiveColor = PROTOTYPE_COLORS[objIndex % PROTOTYPE_COLORS.length];
          return (
            <StyledTreeItem
              key={objective.id}
              itemId={objective.id}
              label={
                <div className={styles.nodeLabel}>
                  <div className={styles.nodeLabelContent}>
                    <GrTrophy size={16} className={styles.nodeIcon} />
                    <span className={styles.nodeTitle}>
                      {objective.title || objective.description}
                    </span>
                  </div>
                </div>
              }
              objectiveColor={objectiveColor}
              objectiveIndex={objIndex}
            >
              {objective.krs && objective.krs.map(kr => (
                <StyledTreeItem
                  key={kr.id}
                  itemId={kr.id}
                  label={
                    <div className={styles.nodeLabel}>
                      <div className={styles.nodeLabelContent}>
                        <GiGolfFlag size={16} className={styles.nodeIcon} />
                        <span className={`${styles.nodeDescription} ${styles.krDescription}`}>
                          {kr.description || kr.title}
                        </span>
                      </div>
                      <div className={styles.nodeMetadata}>
                        {kr.progress !== undefined && (
                          <span className={styles.progress}>
                            {formatProgress(kr.progress)}
                          </span>
                        )}
                        {onAddTask && (!kr.tasks || kr.tasks.length === 0) && (
                          <button
                            className={styles.addTaskButton}
                            onClick={(e) => {
                              e.stopPropagation();
                              onAddTask(kr.id);
                            }}
                            title="Add Task"
                          >
                            <FaPlus size={12} />
                            <span>Add Task</span>
                          </button>
                        )}
                      </div>
                    </div>
                  }
                  objectiveColor={objectiveColor}
                  objectiveIndex={objIndex}
                  isKR={true}
                >
                  {kr.tasks && kr.tasks.map(task => (
                    <StyledTreeItem
                      key={task.id}
                      itemId={task.id}
                      label={
                        <div className={styles.nodeLabel}>
                          <div className={styles.nodeLabelContent}>
                            <LiaGolfBallSolid size={16} className={styles.nodeIcon} />
                            <span className={`${styles.nodeDescription} ${styles.taskDescription}`}>
                              {task.description || task.title}
                            </span>
                          </div>
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
                              <span className={styles.progress}>
                                {formatProgress(task.progress)}
                              </span>
                            )}
                          </div>
                        </div>
                      }
                      objectiveColor={objectiveColor}
                      objectiveIndex={objIndex}
                      isTask={true}
                    />
                  ))}
                </StyledTreeItem>
              ))}
            </StyledTreeItem>
          );
        })}
      </SimpleTreeView>
    </div>
  );
}
