"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import OrgChart from "d3-org-chart";
import styles from "./GroupsView.module.css";

const NODE_TEMPLATE = `
  <div class="org-card">
    <div class="org-card__content">
      <div class="org-card__title">{NAME}</div>
      <div class="org-card__chips">
        <span class="org-card__chip">Objectives: {OBJECTIVE_COUNT}</span>
        <span class="org-card__chip">Members: {MEMBER_COUNT}</span>
      </div>
    </div>
  </div>
`;

const TEMPLATE_REPLACE = {
  NAME: "name",
  OBJECTIVE_COUNT: "objectiveCountDisplay",
  MEMBER_COUNT: "memberCountDisplay",
};

function buildFlatNodes(tree, expandedGroupId) {
  const nodes = [];

  const traverse = (items, parentId = null, depth = 0) => {
    if (!Array.isArray(items)) return;

    items.forEach((item, index) => {
      const data = item?.data || {};
      const nodeId = data.id ?? `${parentId || "root"}-${index}`;
      const memberCount = Number.isFinite(data.memberCount)
        ? data.memberCount
        : 0;
      const objectiveCount = Number.isFinite(data.objectiveCount)
        ? data.objectiveCount
        : 0;
      const isActive = expandedGroupId && expandedGroupId === data.id;

      nodes.push({
        nodeId,
        groupId: data.id,
        parentNodeId: parentId,
        name: data.name || item?.label || "Group",
        typeLabel: data.type || "Group",
        meta: "",
        objectiveCount,
        objectiveCountDisplay: `${objectiveCount}`,
        memberCount,
        memberCountDisplay: `${memberCount}`,
        memberLabel: `${memberCount} member${memberCount === 1 ? "" : "s"}`,
        objectiveLabel: `${objectiveCount} objective${
          objectiveCount === 1 ? "" : "s"
        }`,
        depth,
        expanded: true,
        width: 260,
        height: 136,
        borderWidth: isActive ? 2 : 1,
        borderColor: isActive
          ? { red: 88, green: 28, blue: 135, alpha: 1 }
          : { red: 226, green: 232, blue: 240, alpha: 1 },
        backgroundColor: isActive
          ? { red: 247, green: 243, blue: 255, alpha: 1 }
          : { red: 255, green: 255, blue: 255, alpha: 1 },
        template: NODE_TEMPLATE,
        replaceData: TEMPLATE_REPLACE,
      });

      if (Array.isArray(item.children) && item.children.length) {
        traverse(item.children, nodeId, depth + 1);
      }
    });
  };

  traverse(tree);
  return nodes;
}

function groupFlatNodesByRoot(nodes) {
  if (!nodes || nodes.length === 0) return [];

  const nodeMap = new Map(nodes.map((n) => [n.nodeId, n]));
  const rootCache = new Map();

  const findRootId = (node) => {
    if (rootCache.has(node.nodeId)) return rootCache.get(node.nodeId);

    let current = node;
    const visited = new Set();

    while (
      current.parentNodeId &&
      nodeMap.has(current.parentNodeId) &&
      !visited.has(current.parentNodeId)
    ) {
      visited.add(current.parentNodeId);
      current = nodeMap.get(current.parentNodeId);
    }

    const rootId = current.parentNodeId ? current.parentNodeId : current.nodeId;
    rootCache.set(node.nodeId, rootId);
    return rootId;
  };

  const groups = new Map();

  nodes.forEach((node) => {
    const rootId = node.parentNodeId ? findRootId(node) : node.nodeId;
    if (!groups.has(rootId)) {
      groups.set(rootId, []);
    }
    groups.get(rootId).push(node);
  });

  return Array.from(groups.entries()).map(([rootId, groupedNodes]) => ({
    rootId,
    nodes: groupedNodes,
    rootNode:
      nodeMap.get(rootId) ||
      groupedNodes.find((n) => n.nodeId === rootId) ||
      groupedNodes[0],
  }));
}

export function GroupDetailsPopover({
  group,
  details,
  onClose,
  onEditGroup,
  currentUserId,
  currentUserRole,
  onObjectiveClick,
}) {
  const strategicIds = details.strategicObjectiveIds || [];
  const objectives = details.objectives || [];
  const strategicObjectives = objectives.filter((obj) =>
    strategicIds.includes(obj.id)
  );
  const otherObjectives = objectives.filter(
    (obj) => !strategicIds.includes(obj.id)
  );
  const members = details.members || [];
  const isCurrentUserAdmin =
    details.isCurrentUserAdmin ??
    members.some((member) => member.id === currentUserId && member.is_admin);
  const canEditGroup = isCurrentUserAdmin || currentUserRole === "Admin";

  return (
    <>
      <div className={styles.popoverBackdrop} onClick={onClose} />
      <div className={styles.popover}>
        <div className={styles.popoverHeader}>
          <div>
            <div className={styles.popoverTitle}>{group.name}</div>
            <div className={styles.popoverMeta}>
              <span>{group.objectiveCount} objectives</span>
              <span className={styles.popoverMetaDot}>•</span>
              <span>{group.memberCount} members</span>
            </div>
          </div>
          <button
            className={styles.popoverClose}
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {strategicObjectives.length > 0 && (
          <div className={styles.popoverSection}>
            <div className={styles.popoverSectionTitle}>
              Strategic Objectives
            </div>
            <ul className={styles.popoverList}>
              {strategicObjectives.map((obj) => (
                <li
                  key={obj.id}
                  className={styles.popoverItem}
                  onClick={() => onObjectiveClick && onObjectiveClick(obj.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onObjectiveClick && onObjectiveClick(obj.id);
                    }
                  }}
                >
                  <div className={styles.popoverItemTitle}>{obj.title}</div>
                  <div className={styles.popoverProgress}>
                    <div
                      className={styles.popoverProgressFill}
                      style={{ width: `${Math.round(obj.progress || 0)}%` }}
                    />
                  </div>
                  <div className={styles.popoverProgressText}>
                    {Math.round(obj.progress || 0)}%
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {otherObjectives.length > 0 && (
          <div className={styles.popoverSection}>
            <div className={styles.popoverSectionTitle}>Shared Objectives</div>
            <ul className={styles.popoverList}>
              {otherObjectives.map((obj) => (
                <li
                  key={obj.id}
                  className={styles.popoverItem}
                  onClick={() => onObjectiveClick && onObjectiveClick(obj.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onObjectiveClick && onObjectiveClick(obj.id);
                    }
                  }}
                >
                  <div className={styles.popoverItemTitle}>{obj.title}</div>
                  <div className={styles.popoverProgress}>
                    <div
                      className={styles.popoverProgressFill}
                      style={{ width: `${Math.round(obj.progress || 0)}%` }}
                    />
                  </div>
                  <div className={styles.popoverProgressText}>
                    {Math.round(obj.progress || 0)}%
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className={styles.popoverSection}>
          <div className={styles.popoverSectionTitle}>Members</div>
          {members.length === 0 ? (
            <div className={styles.popoverEmpty}>No members</div>
          ) : (
            <ul className={styles.popoverMembers}>
              {members.map((m) => {
                const fullName = [m.first_name, m.last_name].filter(Boolean).join(" ");
                const displayName = fullName || m.display_name || m.email || "Unknown";
                return (
                  <li key={m.id} className={styles.popoverMember}>
                    <span className={styles.popoverMemberAvatar}>
                      {displayName?.[0]?.toUpperCase() || "?"}
                    </span>
                    <span className={styles.popoverMemberName}>{displayName}</span>
                    {m.is_admin && (
                      <span className={styles.popoverBadge}>Admin</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {canEditGroup && (
          <div className={styles.popoverActions}>
            <button
              type="button"
              className={styles.popoverEditButton}
              onClick={() =>
                onEditGroup &&
                onEditGroup({
                  id: group.groupId || group.nodeId,
                  name: group.name,
                })
              }
            >
              Edit group
            </button>
          </div>
        )}
      </div>
    </>
  );
}

export default function GroupsView({
  orgValue = [],
  mainTreeLoading,
  userLoading,
  error,
  onNodeClick,
  expandedGroupId,
  groupDetails = {},
  onEditGroup,
  currentUserId,
  currentUserRole,
  selectedRootId,
}) {
  const router = useRouter();
  const containerRefs = useRef(new Map());
  const chartRefs = useRef(new Map());
  const latestGroupsRef = useRef([]);

  const handleObjectiveClick = (objectiveId) => {
    if (!objectiveId) return;
    router.push(`/shared/${objectiveId}`);
  };

  const flatNodes = useMemo(
    () => buildFlatNodes(orgValue, expandedGroupId),
    [orgValue, expandedGroupId]
  );

  const groupedCharts = useMemo(() => groupFlatNodesByRoot(flatNodes), [flatNodes]);
  const visibleCharts = useMemo(() => {
    if (!selectedRootId) return groupedCharts;
    const match = groupedCharts.find((group) => group.rootId === selectedRootId);
    return match ? [match] : groupedCharts;
  }, [groupedCharts, selectedRootId]);

  latestGroupsRef.current = visibleCharts;

  useEffect(() => {
    const activeRootIds = new Set(visibleCharts.map((g) => g.rootId));

    // Clean up charts for roots that no longer exist
    chartRefs.current.forEach((chart, rootId) => {
      if (!activeRootIds.has(rootId)) {
        chartRefs.current.delete(rootId);
      }
    });

    if (!visibleCharts.length) {
      containerRefs.current.forEach((el) => {
        if (el) el.innerHTML = "";
      });
      return;
    }

    visibleCharts.forEach(({ rootId, nodes }) => {
      const container = containerRefs.current.get(rootId);
      if (!container) return;

      let chart = chartRefs.current.get(rootId);

      if (!chart) {
        chart = new OrgChart();
        chartRefs.current.set(rootId, chart);

        const baseNode = chart.defaultNode();
        chart
          .container(container)
          .backgroundColor("transparent")
          .initialZoom(0.75)
          .duration(450)
          .depth(260)
          .template(NODE_TEMPLATE)
          .replaceData(TEMPLATE_REPLACE)
          .defaultNode({
            ...baseNode,
            width: 340,
            height: 160,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: { red: 184, green: 210, blue: 210, alpha: 1 },
            backgroundColor: { red: 255, green: 255, blue: 255, alpha: 1 },
            connectorLineColor: { red: 64, green: 64, blue: 64, alpha: 1 },
            connectorLineWidth: 2.4,
            nodeImage: { ...baseNode.nodeImage, width: 0, height: 0, borderWidth: 0, shadow: false },
            nodeIcon: { ...baseNode.nodeIcon, size: 0 },
          });
      }

      chart.onNodeClick((nodeId) => {
        if (onNodeClick) {
          onNodeClick(nodeId);
        }
      });

      const width = container.clientWidth || 900;
      const height = Math.max(520, nodes.length * 140);

      chart.svgWidth(width).svgHeight(height).data(nodes).render();
    });
  }, [visibleCharts, onNodeClick]);

  useEffect(() => {
    const handleResize = () => {
      latestGroupsRef.current.forEach(({ rootId, nodes }) => {
        const chart = chartRefs.current.get(rootId);
        const container = containerRefs.current.get(rootId);
        if (!chart || !container) return;
        chart.svgWidth(container.clientWidth || 900).svgHeight(Math.max(520, nodes.length * 140)).render();
      });
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  if (mainTreeLoading || userLoading) {
    return <div className="loading">Loading group hierarchy...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  if (!flatNodes.length) {
    return (
      <div className="empty">
        No groups found. Create a group to get started.
      </div>
    );
  }

  return (
    <>
      <div className="chartShell">
        {visibleCharts.map(({ rootId, rootNode }) => (
          <div
            key={rootId}
            ref={(el) => {
              if (el) {
                containerRefs.current.set(rootId, el);
              } else {
                containerRefs.current.delete(rootId);
              }
            }}
            className="chartContainer"
            aria-label={`Group organization chart for ${rootNode?.name || "organisation root"}`}
          />
        ))}
      </div>
      {expandedGroupId && groupDetails[expandedGroupId] && (
        <GroupDetailsPopover
          group={
            flatNodes.find((n) => n.nodeId === expandedGroupId) || {
              name: "Group",
              objectiveCount: 0,
              memberCount: 0,
            }
          }
          details={groupDetails[expandedGroupId]}
          onClose={() => onNodeClick && onNodeClick(null)}
          onEditGroup={onEditGroup}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          onObjectiveClick={handleObjectiveClick}
        />
      )}
      <style jsx>{`
        .chartShell {
          width: 100%;
          padding: 20px 12px 32px;
          background: linear-gradient(
            180deg,
            var(strategy-toolbar-bg, #f4f6f9) 0%,
            var(--strategy-toolbar-bg, #f1f3f6) 100%
          );
        }

        .chartContainer {
          width: 100%;
          min-height: 540px;
          background: transparent;
          border: none;
          border-radius: 0;
          box-shadow: none;
          padding: 0;
        }

        .chartContainer + .chartContainer {
          margin-top: 32px;
        }

        .loading,
        .error,
        .empty {
          text-align: center;
          padding: 40px;
          color: var(--text-secondary, #64748b);
          font-size: 14px;
          line-height: 1.4;
        }

        .error {
          color: var(--error-color, #dc2626);
        }
      `}</style>
      <style jsx global>{`
        .chartContainer svg {
          background: transparent !important;
        }

        .chartContainer {
          --org-card-bg: var(--surface, #ffffff);
          --org-card-border: var(--border, #e2e8f0);
          --org-card-title: var(--brand-primary, #6a4bff);
          --org-chip-bg: var(--surface-secondary, var(--surface-1, var(--surface, #ffffff)));
          --org-chip-text: var(--text, #1f2937);
          --org-chip-border: var(--border-light, var(--border, #cdd7e1));
          --org-connector: var(--border, #3f3f46);
        }

        .org-card {
          width: 100%;
          height: 100%;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 10px;
          padding: 20px 22px;
          background: var(--org-card-bg);
          border: none;
          border-radius: 10px;
          overflow: hidden;
          box-shadow: inset 0 0 0 1px var(--org-card-border);
        }

        .org-card__content {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .org-card__title {
          font-size: 20px;
          font-weight: 700;
          color: var(--org-card-title);
          line-height: 1.2;
        }

        .org-card__chips {
          display: inline-flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .org-card__chip {
          background: var(--org-chip-bg);
          color: var(--org-chip-text);
          border: 1px solid var(--org-chip-border);
          border-radius: 10px;
          padding: 6px 10px;
          font-size: 13px;
          font-weight: 600;
          line-height: 1;
        }

        .chartContainer .link {
          stroke: var(--org-connector);
          stroke-width: 2.4px;
        }

        .chartContainer .node-icon-image,
        .chartContainer .pattern-image {
          display: none !important;
        }

        .chartContainer .node-button-circle {
          fill: var(--pill-bg, #e7f0f0);
          stroke: var(--connector-accent, #7ba1a7);
          stroke-width: 2px;
        }

        .chartContainer .node-button-text {
          fill: var(--pill-text, #617b80);
          text-anchor: middle;
          dominant-baseline: central;
          font-size: 20px;
          transform: translateY(1px);
        }

        .chartContainer .org-root-spacer {
          width: 1px;
          height: 1px;
          opacity: 0;
          pointer-events: none;
        }
      `}</style>
    </>
  );
}
