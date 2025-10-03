'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { GrTrophy } from 'react-icons/gr';
import { ChevronRight } from 'lucide-react';
import { createTreeLayout } from '../lib/tidyTree';
import styles from './ObjectiveHierarchy.module.css';

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

// Objective Node component
function ObjectiveNode({
  objective,
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

  const getTypeLabel = (type) => {
    switch(type) {
      case 'O': return 'Objective';
      case 'K': return 'Key Result';
      case 'T': return 'Task';
      default: return 'Unknown';
    }
  };

  const getTypeColor = (type) => {
    switch(type) {
      case 'O': return '#4f46e5'; // Indigo
      case 'K': return '#059669'; // Emerald
      case 'T': return '#dc2626'; // Red
      default: return '#6b7280'; // Gray
    }
  };

  return (
    <div
      ref={nodeRef}
      className={`${styles.objectiveNode} ${overlay && expanded ? styles.overlayExpanded : ''}`}
      style={nodeStyle}
    >
      <div
        className={`${styles.objectiveCard} ${expanded ? styles.selected : ''}`}
        onClick={() => onToggle()}
      >
        <div className={styles.objectiveInfo}>
          <div className={styles.objectiveTitle} title={objective.title}>
            <GrTrophy size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
            {objective.title}
          </div>
          <div className={styles.objectiveOwner}>
            by {objective.owner_name}
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
  selectedId,
  expanded,
  onSelect,
  onToggle,
  getChildObjectives
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
              className={styles.connectorLine}
              d={path}
            />
          );
        })}
      </svg>

      {/* Render nodes */}
      {nodes.map((node) => {
        const objective = node.data;
        const children = getChildObjectives(objective.id);
        const hasChildren = children.length > 0;

        return (
          <ObjectiveNode
            key={objective.id}
            objective={objective}
            selected={selectedId === objective.id}
            expanded={expanded[objective.id]}
            onSelect={() => onSelect(objective.id)}
            onToggle={() => onToggle(objective.id)}
            hasChildren={hasChildren}
            position={{
              x: node.x,
              y: node.y,
              width: node.width
            }}
            overlay={true}
          >
            <ExpandedObjectiveContent
              objective={objective}
              children={children}
            />
          </ObjectiveNode>
        );
      })}
    </div>
  );
}

// Expanded objective content
function ExpandedObjectiveContent({ objective, children = [] }) {
  return (
    <div className={styles.expandedDetails}>
      {/* Description */}
      {objective.description && (
        <div className={styles.detailSection}>
          <div className={styles.detailLabel}>Description:</div>
          <div className={styles.detailValue}>{objective.description}</div>
        </div>
      )}
      
      {/* Progress */}
      <div className={styles.detailSection}>
        <div className={styles.detailLabel}>Progress:</div>
        <div className={styles.progressSection}>
          <ProgressBar value={objective.progress} />
          <span className={styles.progressText}>{Math.round(objective.progress)}%</span>
        </div>
      </div>

      {/* Shared Groups */}
      {objective.shared_groups && objective.shared_groups.length > 0 && (
        <div className={styles.detailSection}>
          <div className={styles.detailLabel}>Shared with:</div>
          <div className={styles.detailValue}>
            {objective.shared_groups.map(g => g.name).join(', ')}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ObjectiveHierarchy() {
  const [objectives, setObjectives] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSharedObjectives();
  }, []);

  const fetchSharedObjectives = async () => {
    try {
      const response = await fetch('/api/shared');
      if (response.ok) {
        const data = await response.json();
        setObjectives(data.okrts || []);
        
        // Auto-select first root objective
        const rootObjective = data.okrts?.find(o => !o.parent_id);
        if (rootObjective) {
          setSelectedId(rootObjective.id);
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to fetch shared objectives');
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleObjectiveSelect = (objectiveId) => {
    setSelectedId(objectiveId);
  };

  const handleToggleExpanded = (objectiveId) => {
    setExpanded(prev => ({ ...prev, [objectiveId]: !prev[objectiveId] }));
  };

  const getChildObjectives = (parentId) => 
    objectives.filter(o => String(o.parent_id) === String(parentId));

  // Generate tree layouts using Tidy Tree algorithm
  const treeLayouts = useMemo(() => {
    if (objectives.length === 0) return [];

    try {
      // Filter out solitary objectives (those without parents or children)
      const filteredObjectives = objectives.filter(obj => {
        const hasParent = obj.parent_id && objectives.some(o => o.id === obj.parent_id);
        const hasChildren = objectives.some(o => o.parent_id === obj.id);
        return hasParent || hasChildren;
      });

      if (filteredObjectives.length === 0) return [];

      // Convert objectives to tree structure format expected by tidyTree
      const objectiveTree = filteredObjectives.map(obj => ({
        id: obj.id,
        parent_group_id: obj.parent_id, // Map parent_id to parent_group_id for tidyTree
        name: obj.title, // Map title to name for tidyTree
        ...obj
      }));

      const layouts = createTreeLayout(objectiveTree, {
        nodeWidth: 250,
        nodeHeight: 68,
        levelHeight: 100,
        siblingDistance: 280,
        subtreeDistance: 280,
        spacingReduction: 0.7,
        minSpacing: 60
      });

      return layouts;
    } catch (error) {
      console.error('Error creating objective tree layout:', error);
      return [];
    }
  }, [objectives]);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading shared objectives...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>{error}</div>
      </div>
    );
  }

  if (objectives.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <GrTrophy className={styles.emptyIcon} />
          <h3>No Shared Objectives</h3>
          <p>No objectives have been shared with you yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.treeContainer}>
        {/* Render tree layouts */}
        {treeLayouts.map((layout, index) => (
          <div key={index} className={styles.treeSection}>
            <TreeLayout
              layout={layout}
              selectedId={selectedId}
              expanded={expanded}
              onSelect={handleObjectiveSelect}
              onToggle={handleToggleExpanded}
              getChildObjectives={getChildObjectives}
            />
          </div>
        ))}
      </div>
    </div>
  );
}