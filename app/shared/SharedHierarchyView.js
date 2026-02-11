'use client';

import React, { useMemo, useRef, useEffect, useState } from 'react';
import { OrganizationChart } from 'primereact/organizationchart';
import 'primereact/resources/themes/lara-light-blue/theme.css';
import 'primereact/resources/primereact.min.css';
import styles from './page.module.css';
import { useMainTree } from '@/hooks/useMainTree';
import { getThemeColorPalette } from '@/lib/clockUtils';
import { useRouter } from 'next/navigation';

const getOwnerName = (okrt) => {
  if (okrt?.owner_name) return okrt.owner_name;
  const fullName = [okrt?.owner_first_name, okrt?.owner_last_name].filter(Boolean).join(' ');
  return fullName || 'Unknown owner';
};

const getOwnerAvatar = (okrt) =>
  okrt?.owner_avatar || okrt?.ownerAvatar || okrt?.owner_profile_picture_url || '';

const getInitials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '??';

const getInitiativeCount = (okrt) => {
  const links = okrt?.jira_links || okrt?.jiraLinks || [];
  if (Array.isArray(links)) return links.length;
  return typeof links === 'string' && links ? 1 : 0;
};

const getKpiCount = (okrt) => {
  if (Array.isArray(okrt?.kpis)) return okrt.kpis.length;
  if (Array.isArray(okrt?.kpi_list)) return okrt.kpi_list.length;
  if (Array.isArray(okrt?.kpiList)) return okrt.kpiList.length;
  if (typeof okrt?.kpi_count === 'number') return okrt.kpi_count;
  if (typeof okrt?.kpis_count === 'number') return okrt.kpis_count;
  if (typeof okrt?.kpiCount === 'number') return okrt.kpiCount;
  return 0;
};

const getKrCount = (okrt) => {
  if (Array.isArray(okrt?.keyResults)) return okrt.keyResults.length;
  if (typeof okrt?.kr_count === 'number') return okrt.kr_count;
  if (typeof okrt?.keyResultsCount === 'number') return okrt.keyResultsCount;
  return 0;
};

function buildFamilies(sharedOKRTs = []) {
  if (!sharedOKRTs.length) return [];

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

  const families = [];

  const traverse = (node, collector) => {
    collector.push(node);
    const kids = childrenMap.get(node.id) || [];
    kids.forEach((child) => traverse(child, collector));
  };

  roots.forEach((root) => {
    const ordered = [];
    traverse(root, ordered);
    const color = palette[hashToIndex(root.id)] || palette[0] || '#a78bfa';

    const nodeMap = new Map();
    ordered.forEach((okrt) => {
      const ownerName = getOwnerName(okrt);
      const ownerAvatar = getOwnerAvatar(okrt);
      const progress = Math.round(okrt?.progress || 0);
      const childObjectives = childrenMap.get(okrt.id) || [];
      nodeMap.set(okrt.id, {
        key: String(okrt.id),
        label: okrt.title || 'Untitled objective',
        expanded: true,
        data: {
          id: okrt.id,
          title: okrt.title || 'Untitled objective',
          ownerName,
          ownerAvatar,
          progress,
          counts: {
            initiatives: getInitiativeCount(okrt),
            kpis: getKpiCount(okrt),
            krs: getKrCount(okrt),
            children: childObjectives.length
          }
        },
        children: [],
      });
    });

    ordered.forEach((okrt) => {
      if (okrt.id === root.id) return;
      const parentId =
        okrt.parent_id && nodeMap.has(okrt.parent_id) ? okrt.parent_id : root.id;
      const parentNode = nodeMap.get(parentId);
      const node = nodeMap.get(okrt.id);
      if (parentNode && node) {
        parentNode.children.push(node);
      }
    });

    const rootNode = nodeMap.get(root.id);
    if (rootNode) {
      families.push({
        root,
        tree: [rootNode],
        color,
      });
    }
  });

  return families;
}

// Custom hook for drag-to-scroll with auto-centering
function useDragToScroll(contentRef) {
  const [isDragging, setIsDragging] = useState(false);
  const dragStateRef = useRef({ startX: 0, scrollLeft: 0, hasMoved: false });

  useEffect(() => {
    const element = contentRef.current;
    if (!element) return;

    // Center content on mount if it overflows
    const centerContent = () => {
      const containerWidth = element.clientWidth;
      const contentWidth = element.scrollWidth;

      if (contentWidth > containerWidth) {
        // Content overflows - center it
        element.scrollLeft = (contentWidth - containerWidth) / 2;
      }
    };

    // Center after render and on resize
    const timer = setTimeout(centerContent, 100);
    window.addEventListener('resize', centerContent);

    const handleMouseDown = (e) => {
      // Allow button clicks
      if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;

      setIsDragging(true);
      dragStateRef.current = {
        startX: e.pageX - element.offsetLeft,
        scrollLeft: element.scrollLeft,
        hasMoved: false
      };
      e.preventDefault();
    };

    const handleMouseMove = (e) => {
      if (!isDragging) return;
      e.preventDefault();

      const x = e.pageX - element.offsetLeft;
      const walk = (x - dragStateRef.current.startX) * 1.5;
      element.scrollLeft = dragStateRef.current.scrollLeft - walk;

      if (Math.abs(walk) > 5) {
        dragStateRef.current.hasMoved = true;
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    const handleMouseLeave = () => {
      setIsDragging(false);
    };

    // Touch events
    const handleTouchStart = (e) => {
      if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;

      setIsDragging(true);
      dragStateRef.current = {
        startX: e.touches[0].pageX - element.offsetLeft,
        scrollLeft: element.scrollLeft,
        hasMoved: false
      };
    };

    const handleTouchMove = (e) => {
      if (!isDragging) return;

      const x = e.touches[0].pageX - element.offsetLeft;
      const walk = (x - dragStateRef.current.startX) * 1.5;
      element.scrollLeft = dragStateRef.current.scrollLeft - walk;

      if (Math.abs(walk) > 5) {
        dragStateRef.current.hasMoved = true;
      }
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
    };

    element.addEventListener('mousedown', handleMouseDown);
    element.addEventListener('mousemove', handleMouseMove);
    element.addEventListener('mouseup', handleMouseUp);
    element.addEventListener('mouseleave', handleMouseLeave);
    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: true });
    element.addEventListener('touchend', handleTouchEnd);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', centerContent);
      element.removeEventListener('mousedown', handleMouseDown);
      element.removeEventListener('mousemove', handleMouseMove);
      element.removeEventListener('mouseup', handleMouseUp);
      element.removeEventListener('mouseleave', handleMouseLeave);
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [contentRef, isDragging]);

  return isDragging;
}

// Family chart wrapper component
function FamilyChartWrapper({ family, nodeTemplate }) {
  const wrapperRef = useRef(null);
  const isDragging = useDragToScroll(wrapperRef);

  return (
    <div
      className={styles.familyWrapper}
      style={{ '--family-color': family.color }}
    >
      <div className={styles.familyHeader}>
        <span className={styles.familyDot} style={{ backgroundColor: family.color }} />
        <div className={styles.familyTitle}>{family.root.title || 'Objective'}</div>
      </div>
      <div
        ref={wrapperRef}
        className={`${styles.orgChartWrapper} ${isDragging ? styles.dragging : ''}`}
      >
        <OrganizationChart
          value={family.tree}
          nodeTemplate={nodeTemplate}
          className={styles.orgChart}
        />
      </div>
    </div>
  );
}

export default function SharedHierarchyView({ okrts = null }) {
  const { mainTree, isLoading: mainTreeLoading } = useMainTree();
  const router = useRouter();
  const sourceOKRTs = Array.isArray(okrts) ? okrts : (mainTree?.sharedOKRTs || []);
  const sharedOKRTs = sourceOKRTs.filter((okrt) => okrt.type === 'O');
  const families = useMemo(() => buildFamilies(sharedOKRTs), [sharedOKRTs]);

  const handleNodeClick = (node) => {
    const id = node?.data?.id;
    if (id) router.push(`/shared/${id}`);
  };

  const nodeTemplate = (node) => (
    <button
      type="button"
      className={styles.chartNode}
      onClick={() => handleNodeClick(node)}
      title={node?.data?.title || node.label}
    >
      <div className={styles.chartTitle}>
        {node?.data?.title || node.label || 'Untitled objective'}
      </div>
      <div className={styles.chartOwner}>
        {node?.data?.ownerAvatar ? (
          <img
            src={node.data.ownerAvatar}
            alt={node.data.ownerName}
            className={styles.ownerAvatar}
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className={styles.ownerInitials}>
            {getInitials(node?.data?.ownerName)}
          </div>
        )}
        <span className={styles.ownerName}>{node?.data?.ownerName}</span>
      </div>
      <div className={styles.chartProgress}>
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${node?.data?.progress || 0}%` }}
          />
        </div>
        <span className={styles.progressText}>{node?.data?.progress || 0}%</span>
      </div>
      <div className={styles.chartCounts}>
        <div className={styles.countItem}>
          <span className={styles.countInline}>
            Inits:{node?.data?.counts?.initiatives ?? 0}
          </span>
        </div>
        <div className={styles.countItem}>
          <span className={styles.countInline}>
            KPIs:{node?.data?.counts?.kpis ?? 0}
          </span>
        </div>
        <div className={styles.countItem}>
          <span className={styles.countInline}>
            KRs:{node?.data?.counts?.krs ?? 0}
          </span>
        </div>
        <div className={styles.countItem}>
          <span className={styles.countInline}>
            Children:{node?.data?.counts?.children ?? 0}
          </span>
        </div>
      </div>
    </button>
  );

  if (!Array.isArray(okrts) && mainTreeLoading) {
    return <div className={styles.hierarchyBlank}>Loading shared OKRs...</div>;
  }

  if (!families.length) {
    return <div className={styles.hierarchyBlank}>No shared OKRs found.</div>;
  }

  return (
    <div className={styles.hierarchyStack}>
      {families.map((family) => (
        <FamilyChartWrapper
          key={family.root.id}
          family={family}
          nodeTemplate={nodeTemplate}
        />
      ))}
    </div>
  );
}
