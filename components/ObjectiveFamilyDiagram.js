'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { OrganizationChart } from 'primereact/organizationchart';
import 'primereact/resources/themes/lara-light-blue/theme.css';
import 'primereact/resources/primereact.min.css';
import styles from './ObjectiveFamilyDiagram.module.css';
import sharedStyles from '@/app/shared/page.module.css';
import useMainTreeStore from '@/store/mainTreeStore';
import { objectiveFamilyLinks } from '@/lib/aime/contextBuilders';
import { useRouter } from 'next/navigation';

const sortByOrderAndTitle = (a, b) => {
  const orderA = a.order_index ?? 0;
  const orderB = b.order_index ?? 0;
  if (orderA !== orderB) return orderA - orderB;
  return (a.title || '').localeCompare(b.title || '');
};

function useDragToScroll(contentRef) {
  const [isDragging, setIsDragging] = useState(false);
  const dragStateRef = useRef({ startX: 0, scrollLeft: 0, hasMoved: false });

  useEffect(() => {
    const element = contentRef.current;
    if (!element) return;

    const centerContent = () => {
      const containerWidth = element.clientWidth;
      const contentWidth = element.scrollWidth;

      if (contentWidth > containerWidth) {
        element.scrollLeft = (contentWidth - containerWidth) / 2;
      }
    };

    const timer = setTimeout(centerContent, 100);
    window.addEventListener('resize', centerContent);

    const handleMouseDown = (e) => {
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

export default function ObjectiveFamilyDiagram({ objectiveId, className = '' }) {
  const mainTree = useMainTreeStore((state) => state.mainTree);
  const router = useRouter();

  const familyLinks = useMemo(
    () => objectiveFamilyLinks(mainTree, objectiveId),
    [mainTree, objectiveId]
  );

  const okrtById = useMemo(() => {
    const map = new Map();
    const allItems = []
      .concat(mainTree?.myOKRTs || [])
      .concat(mainTree?.sharedOKRTs || []);
    allItems.forEach((item) => {
      if (!item || item.id == null) return;
      map.set(String(item.id), item);
    });
    return map;
  }, [mainTree]);

  const familyItems = useMemo(() => {
    if (!familyLinks || familyLinks.length <= 1) return [];
    return familyLinks
      .map((link) => {
        const okrt = okrtById.get(String(link.id)) || {};
        return {
          id: link.id,
          type: okrt.type ?? null,
          parent_id: okrt.parent_id ?? null,
          title: okrt.title ?? link.title ?? 'Untitled objective',
          order_index: okrt.order_index ?? 0
        };
      })
      .filter((item) => item.type === 'O');
  }, [familyLinks, okrtById]);

  const tree = useMemo(() => {
    if (!familyItems || familyItems.length <= 1) return [];

    const byId = new Map(familyItems.map((item) => [String(item.id), item]));
    const childrenMap = new Map();

    familyItems.forEach((item) => {
      const parentId = item.parent_id != null ? String(item.parent_id) : null;
      if (parentId && byId.has(parentId)) {
        if (!childrenMap.has(parentId)) {
          childrenMap.set(parentId, []);
        }
        childrenMap.get(parentId).push(item);
      }
    });

    const buildNode = (item) => ({
      key: String(item.id),
      data: item,
      expanded: true,
      children: (childrenMap.get(String(item.id)) || [])
        .sort(sortByOrderAndTitle)
        .map(buildNode)
    });

    const roots = familyItems.filter((item) => {
      const parentId = item.parent_id != null ? String(item.parent_id) : null;
      return !parentId || !byId.has(parentId);
    });

    return roots.sort(sortByOrderAndTitle).map(buildNode);
  }, [familyItems]);

  if (!objectiveId || !tree.length) {
    return null;
  }

  const wrapperRef = useRef(null);
  const isDragging = useDragToScroll(wrapperRef);

  const handleNodeClick = (node) => {
    const id = node?.data?.id;
    if (!id) return;
    const isShared = Array.isArray(mainTree?.sharedOKRTs)
      && mainTree.sharedOKRTs.some((okrt) => String(okrt?.id) === String(id));
    if (isShared) {
      router.push(`/shared/${id}`);
      return;
    }
    router.push(`/okrt?objective=${id}`);
  };

  const nodeTemplate = (node) => {
    const data = node?.data || {};
    const isCurrent = String(data.id) === String(objectiveId);
    return (
      <button
        type="button"
        className={`${styles.nodeCard} ${isCurrent ? styles.nodeCardActive : ''}`}
        onClick={() => handleNodeClick(node)}
      >
        <div className={styles.nodeTitle} title={data.title}>
          {data.title || 'Untitled objective'}
        </div>
      </button>
    );
  };

  return (
    <section className={`${styles.diagram} ${className}`}>
      <div className={styles.diagramHeader}>Objective Hierarchy</div>
      <div
        ref={wrapperRef}
        className={`${sharedStyles.orgChartWrapper} ${isDragging ? sharedStyles.dragging : ''}`}
      >
        <OrganizationChart
          value={tree}
          nodeTemplate={nodeTemplate}
          className={sharedStyles.orgChart}
        />
      </div>
    </section>
  );
}
