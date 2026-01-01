'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RiUserSharedLine } from 'react-icons/ri';
import { GrTrophy } from 'react-icons/gr';
import { BsDiagram3, BsGrid } from 'react-icons/bs';
import styles from './page.module.css';
import useMainTreeStore from '@/store/mainTreeStore';
import { useMainTree } from '@/hooks/useMainTree';
import { useUser } from '@/hooks/useUser';
import SharedHierarchyView from './SharedHierarchyView';
import { getThemeColorPalette } from '@/lib/clockUtils';

export default function SharedGoalsPage() {
  const [followingLoading, setFollowingLoading] = useState({});
  const [viewMode, setViewMode] = useState('grid');
  const router = useRouter();
  
  // Subscribe to mainTreeStore
  const { mainTree, isLoading } = useMainTree();
  const { setSharedOKRTs } = useMainTreeStore();
  // Filter to show only Objectives (type 'O'), not Key Results
  const sharedOKRTs = (mainTree.sharedOKRTs || []).filter(okrt => okrt.type === 'O');
  
  // Use cached user data
  const { user: currentUser } = useUser();

  const { orderedSharedOKRTs, okrtRootMap, familyColorMap } = useMemo(() => {
    if (!sharedOKRTs || sharedOKRTs.length === 0) {
      return { orderedSharedOKRTs: [], okrtRootMap: new Map(), familyColorMap: new Map() };
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

    return { orderedSharedOKRTs: ordered, okrtRootMap: rootMap, familyColorMap: colorMap };
  }, [sharedOKRTs]);

  const objectiveGroupMap = useMemo(() => {
    const groups = mainTree?.groups || [];
    const map = new Map();
    groups.forEach((group) => {
      if (!group || !group.objectiveIds) return;
      group.objectiveIds.forEach((id) => {
        const existing = map.get(id) || [];
        if (group.name) {
          existing.push(group.name);
          map.set(id, existing);
        }
      });
    });
    return map;
  }, [mainTree?.groups]);

  const getTypeIcon = (type) => {
    switch (type) {
      case 'O':
        return <GrTrophy className={styles.typeIcon} />;
      case 'K':
        return <span className={styles.typeIcon}>🎯</span>;
      case 'T':
        return <span className={styles.typeIcon}>✓</span>;
      default:
        return null;
    }
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case 'O':
        return 'Objective';
      case 'K':
        return 'Key Result';
      case 'T':
        return 'Task';
      default:
        return 'Unknown';
    }
  };

  const getInitials = (name) => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    return parts[0].charAt(0).toUpperCase();
  };

  const handleOKRTClick = (okrtId) => {
    router.push(`/shared/${okrtId}`);
  };

  const handleFollowToggle = async (okrtId, isCurrentlyFollowing, event) => {
    event.stopPropagation(); // Prevent card click
    
    setFollowingLoading(prev => ({ ...prev, [okrtId]: true }));
    
    try {
      const method = isCurrentlyFollowing ? 'DELETE' : 'POST';
      const response = await fetch('/api/follow', {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ objective_id: okrtId }),
      });

      if (response.ok) {
        // Update the store with new follow status
        const updatedOKRTs = sharedOKRTs
          .map(okrt =>
            okrt.id === okrtId
              ? { ...okrt, is_following: isCurrentlyFollowing ? 0 : 1 }
              : okrt
          )
          .sort((a, b) => {
            // Sort followed items to the top
            if (a.is_following && !b.is_following) return -1;
            if (!a.is_following && b.is_following) return 1;
            return new Date(b.updated_at) - new Date(a.updated_at);
          });
        
        setSharedOKRTs(updatedOKRTs);
      } else {
        const errorData = await response.json();
        console.error(errorData.error || 'Failed to update follow status');
      }
    } catch (err) {
      console.error('Network error occurred:', err);
    } finally {
      setFollowingLoading(prev => ({ ...prev, [okrtId]: false }));
    }
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
      <div className={styles.container}>
        <div className="app-pageHeader">
          <div className="app-titleSection">
            <RiUserSharedLine className="app-pageIcon" />
            <h1 className="app-pageTitle">Shared OKRs</h1>
          </div>
          {renderModeSwitcher(true)}
        </div>
        <div className={styles.loading}>Loading shared OKRs...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className="app-pageHeader">
        <div className="app-titleSection">
          <RiUserSharedLine className="app-pageIcon" />
          <h1 className="app-pageTitle">Shared OKRs</h1>
          <span className="app-pageCount">({sharedOKRTs.length})</span>
        </div>
        {renderModeSwitcher()}
      </div>

      {viewMode === 'grid' ? (
        orderedSharedOKRTs.length === 0 ? (
          <div className={styles.emptyState}>
            <RiUserSharedLine className={styles.emptyIcon} />
            <h3>No Shared OKRs</h3>
            <p>Goals shared with you by other users or groups will appear here.</p>
          </div>
        ) : (
          <div className={styles.okrtGrid}>
            {orderedSharedOKRTs.map((okrt) => {
              const rootId = okrtRootMap.get(okrt.id) || okrt.id;
              const familyColor = familyColorMap.get(rootId);
              const groupNames = Array.from(new Set([
                ...(objectiveGroupMap.get(okrt.id) || []),
                ...((okrt.shared_groups || []).map((g) => g?.name).filter(Boolean))
              ]));
              return (
                <div
                  key={okrt.id}
                  className={`${styles.okrtCard} ${okrt.is_following ? styles.followedCard : ''}`}
                  onClick={() => handleOKRTClick(okrt.id)}
                  style={familyColor ? { borderColor: familyColor, '--family-color': familyColor } : undefined}
                >
                  <span className={styles.familyMarker} aria-hidden="true" />
                  <div className={styles.cardHeader}>
                    <div className={styles.typeInfo}>
                      {getTypeIcon(okrt.type)}
                      <span className={styles.typeLabel}>{getTypeLabel(okrt.type)}</span>
                    </div>
                    <div className={styles.headerActions}>
                      <div className={styles.ownerInfo}>
                        {okrt.owner_avatar ? (
                          <img
                            src={okrt.owner_avatar}
                            alt={okrt.owner_name}
                            className={styles.ownerAvatar}
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className={styles.ownerInitials}>
                            {getInitials(okrt.owner_name)}
                          </div>
                        )}
                        <span className={styles.ownerName}>{okrt.owner_name}</span>
                      </div>
                      {currentUser && String(okrt.owner_id) !== String(currentUser.id) && (
                        <button
                          className={`${styles.followButton} ${okrt.is_following ? styles.following : ''}`}
                          onClick={(e) => handleFollowToggle(okrt.id, okrt.is_following, e)}
                          disabled={followingLoading[okrt.id]}
                          title={okrt.is_following ? 'Following' : 'Follow'}
                        >
                          {followingLoading[okrt.id] ? (
                            <span className={styles.spinner}>⟳</span>
                          ) : (
                            <span className={styles.followText}>
                              {okrt.is_following ? 'Following' : 'Follow'}
                            </span>
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className={styles.cardContent}>
                    <h3 className={styles.title}>{okrt.title}</h3>
                  </div>

                  <div className={styles.cardFooter}>
                    <div className={styles.footerTop}>
                      <div className={styles.progressSection}>
                        <div className={styles.progressBar}>
                          <div
                            className={styles.progressFill}
                            style={{ width: `${okrt.progress}%` }}
                          />
                        </div>
                        <span className={styles.progressText}>{okrt.progress}%</span>
                      </div>
                      <div className={styles.cardMeta}>
                        <div className={styles.metaItem}>
                          <span className={styles.metaLabel}>KRs</span>
                          <span className={styles.metaValue}>{okrt.keyResults ? okrt.keyResults.length : 0}</span>
                        </div>
                      </div>
                    </div>
                    {groupNames.length > 0 && (
                      <div className={styles.groupPills}>
                        {groupNames.map((name) => (
                          <span key={name} className={styles.groupPill}>{name}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  {okrt.area && (
                    <div className={styles.area}>
                      <span className={styles.areaLabel}>Area:</span>
                      <span className={styles.areaValue}>{okrt.area}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : (
        <SharedHierarchyView />
      )}
    </div>
  );
}
