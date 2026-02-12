'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RiUserSharedLine } from 'react-icons/ri';
import { BsDiagram3, BsGrid } from 'react-icons/bs';
import styles from './page.module.css';
import { useMainTree } from '@/hooks/useMainTree';
import SharedHierarchyView from './SharedHierarchyView';
import { getThemeColorPalette } from '@/lib/clockUtils';
import SharedObjectiveCardSmall from '@/components/SharedObjectiveCardSmall';
import {
  getOwnerName,
  getOwnerAvatar,
  getInitiativeCount,
  getKpiCount,
  getKrCount
} from '@/components/sharedObjectiveCardUtils';

export default function SharedGoalsPage() {
  const [viewMode, setViewMode] = useState('grid');
  const [sharedGroupFilter, setSharedGroupFilter] = useState('all');
  const router = useRouter();
  
  // Subscribe to mainTreeStore
  const { mainTree, isLoading } = useMainTree();
  const sharedOKRTsAll = mainTree.sharedOKRTs || [];
  // Filter to show only Objectives (type 'O'), not Key Results
  const sharedOKRTs = sharedOKRTsAll.filter(okrt => okrt.type === 'O');
  
  const { orderedSharedOKRTs, okrtRootMap, familyColorMap, childCountMap } = useMemo(() => {
    if (!sharedOKRTs || sharedOKRTs.length === 0) {
      return {
        orderedSharedOKRTs: [],
        okrtRootMap: new Map(),
        familyColorMap: new Map(),
        childCountMap: new Map()
      };
    }

    const palette = getThemeColorPalette();
    const hashToIndex = (value) => {
      const str = String(value ?? '');
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
      }
      return palette.length > 0 ? hash % palette.length : 0;
    };

    const childrenMap = new Map();
    const objectiveMap = new Map(sharedOKRTs.map((o) => [o.id, o]));

    sharedOKRTs.forEach((objective) => {
      const parentKey = objective.parent_id || null;
      if (!childrenMap.has(parentKey)) {
        childrenMap.set(parentKey, []);
      }
      childrenMap.get(parentKey).push(objective);
    });

    const sortObjectives = (a, b) => {
      const orderA = a.order_index ?? 0;
      const orderB = b.order_index ?? 0;
      if (orderA !== orderB) return orderA - orderB;
      return (a.title || '').localeCompare(b.title || '');
    };

    childrenMap.forEach((list) => list.sort(sortObjectives));

    const roots = (childrenMap.get(null) || []).concat(
      sharedOKRTs.filter((o) => o.parent_id && !objectiveMap.has(o.parent_id))
    );

    const ordered = [];
    const rootMap = new Map();
    const colorMap = new Map();
    const countMap = new Map();

    const traverse = (node, rootId) => {
      rootMap.set(node.id, rootId);
      ordered.push(node);
      const kids = childrenMap.get(node.id) || [];
      kids.forEach((child) => traverse(child, rootId));
    };

    roots.forEach((root) => {
      traverse(root, root.id);
      const color = palette[hashToIndex(root.id)] || palette[0] || '#a78bfa';
      colorMap.set(root.id, color);
    });

    childrenMap.forEach((list, parentId) => {
      if (parentId) countMap.set(parentId, list.length);
    });

    return {
      orderedSharedOKRTs: ordered,
      okrtRootMap: rootMap,
      familyColorMap: colorMap,
      childCountMap: countMap
    };
  }, [sharedOKRTs]);

  const sharedGroupOptions = useMemo(() => {
    const groups = new Map();
    sharedOKRTs.forEach((okrt) => {
      const sharedGroups = okrt.shared_groups || okrt.sharedGroups || [];
      sharedGroups.forEach((group) => {
        if (!group) return;
        const name = group.name || group.group_name;
        if (!name) return;
        const id = group.id || group.group_id || group.group_or_user_id || name;
        if (!groups.has(id)) {
          groups.set(id, { id, name });
        }
      });
    });
    return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [sharedOKRTs]);

  useEffect(() => {
    if (sharedGroupFilter === 'all') return;
    const isValid = sharedGroupOptions.some(
      (group) => String(group.id) === String(sharedGroupFilter)
    );
    if (!isValid) {
      setSharedGroupFilter('all');
    }
  }, [sharedGroupFilter, sharedGroupOptions]);

  const visibleSharedOKRTs = useMemo(() => {
    if (sharedGroupFilter === 'all') {
      return orderedSharedOKRTs;
    }
    return orderedSharedOKRTs.filter((okrt) => {
      const sharedGroups = okrt.shared_groups || okrt.sharedGroups || [];
      return sharedGroups.some(
        (group) =>
          String(group?.id || group?.group_id || group?.group_or_user_id) ===
          String(sharedGroupFilter)
      );
    });
  }, [orderedSharedOKRTs, sharedGroupFilter]);

  const filteredHierarchyOKRTs = useMemo(() => {
    if (sharedGroupFilter === 'all') {
      return sharedOKRTsAll;
    }

    const okrtMap = new Map(sharedOKRTsAll.map((okrt) => [okrt.id, okrt]));
    const allowedObjectives = new Set(
      sharedOKRTs
        .filter((okrt) => {
          const sharedGroups = okrt.shared_groups || okrt.sharedGroups || [];
          return sharedGroups.some(
            (group) =>
              String(group?.id || group?.group_id || group?.group_or_user_id) ===
              String(sharedGroupFilter)
          );
        })
        .map((okrt) => okrt.id)
    );

    const findNearestObjectiveId = (okrt) => {
      let current = okrt;
      const visited = new Set();
      while (current && current.type !== 'O' && current.parent_id && okrtMap.has(current.parent_id)) {
        if (visited.has(current.parent_id)) break;
        visited.add(current.parent_id);
        current = okrtMap.get(current.parent_id);
      }
      return current && current.type === 'O' ? current.id : null;
    };

    return sharedOKRTsAll.filter((okrt) => {
      const objectiveId = okrt.type === 'O' ? okrt.id : findNearestObjectiveId(okrt);
      return objectiveId && allowedObjectives.has(objectiveId);
    });
  }, [sharedGroupFilter, sharedOKRTs, sharedOKRTsAll]);

  const handleOKRTClick = (okrtId) => {
    router.push(`/shared/${okrtId}`);
  };

  const handleModeChange = (mode) => {
    setViewMode(mode);
  };

  const renderModeSwitcher = (disabled = false) => (
    <div className={`${styles.modeSwitcher} ${disabled ? styles.modeSwitcherDisabled : ''}`} role="group" aria-label="View mode selector">
      <div
        className={`${styles.modeThumb} ${viewMode === 'hierarchy' ? styles.thumbHierarchy : ''}`}
        aria-hidden="true"
      />
      <button
        type="button"
        className={`${styles.modeButton} ${viewMode === 'grid' ? styles.activeMode : ''}`}
        onClick={() => handleModeChange('grid')}
        disabled={disabled}
      >
        <BsGrid className={styles.modeIcon} />
        <span></span>
      </button>
      <button
        type="button"
        className={`${styles.modeButton} ${viewMode === 'hierarchy' ? styles.activeMode : ''}`}
        onClick={() => handleModeChange('hierarchy')}
        disabled={disabled}
      >
        <BsDiagram3 className={styles.modeIcon} />
        <span></span>
      </button>
    </div>
  );

  if (isLoading) {
    return (
      <div className={`app-page ${styles.container}`}>
        <div className="app-pageContent">
          <div className="app-pageHeader">
            <div className="app-titleSection">
              <RiUserSharedLine className="app-pageIcon" />
              <h1 className="app-pageTitle">Shared OKRs</h1>
            </div>
            {renderModeSwitcher(true)}
          </div>
          <div className={styles.loading}>Loading shared OKRs...</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`app-page ${styles.container}`}>
      <div className="app-pageContent">
        <div className="app-pageHeader">
          <div className="app-titleSection">
            <RiUserSharedLine className="app-pageIcon" />
            <h1 className="app-pageTitle">Shared OKRs</h1>
            <span className="app-pageCount">({visibleSharedOKRTs.length})</span>
          </div>
          {sharedGroupOptions.length > 0 && (
            <div className={styles.filtersRow}>
              <label className="app-headerLabel" htmlFor="sharedGroupFilter">
                Group
              </label>
              <select
                id="sharedGroupFilter"
                className="app-headerSelect"
                value={sharedGroupFilter}
                onChange={(event) => setSharedGroupFilter(event.target.value)}
              >
                <option value="all">All</option>
                {sharedGroupOptions.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {renderModeSwitcher()}
        </div>

        {viewMode === 'grid' ? (
        visibleSharedOKRTs.length === 0 ? (
          <div className={styles.emptyState}>
            <RiUserSharedLine className={styles.emptyIcon} />
            <h3>No Shared OKRs</h3>
            <p>Goals shared with you by other users or groups will appear here.</p>
          </div>
        ) : (
          <div className={styles.okrtGrid}>
            {visibleSharedOKRTs.map((okrt) => {
              const rootId = okrtRootMap.get(okrt.id) || okrt.id;
              const familyColor = familyColorMap.get(rootId);
              const counts = {
                initiatives: getInitiativeCount(okrt),
                kpis: getKpiCount(okrt),
                krs: getKrCount(okrt),
                children: childCountMap.get(okrt.id) || 0
              };
              return (
                <SharedObjectiveCardSmall
                  key={okrt.id}
                  onClick={() => handleOKRTClick(okrt.id)}
                  className={okrt.is_following ? styles.followedCard : ''}
                  familyColor={familyColor}
                  title={okrt.title || 'Untitled objective'}
                  ownerName={getOwnerName(okrt)}
                  ownerAvatar={getOwnerAvatar(okrt)}
                  progress={Math.round(okrt?.progress || 0)}
                  counts={counts}
                />
              );
            })}
          </div>
        )
      ) : (
        <SharedHierarchyView okrts={filteredHierarchyOKRTs} />
      )}
      </div>
    </div>
  );
}
