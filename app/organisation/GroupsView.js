"use client";

import React, { useEffect, useMemo, useRef } from "react";
import OrgChart from "d3-org-chart";

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

function GroupDetailsPopover({ group, details, onClose, onEditGroup }) {
  const strategicIds = details.strategicObjectiveIds || [];
  const objectives = details.objectives || [];
  const strategicObjectives = objectives.filter((obj) =>
    strategicIds.includes(obj.id)
  );
  const otherObjectives = objectives.filter(
    (obj) => !strategicIds.includes(obj.id)
  );
  const members = details.members || [];

  return (
    <>
      <div className="popover-backdrop" onClick={onClose} />
      <div className="popover">
        <div className="popover__header">
          <div>
            <div className="popover__title">{group.name}</div>
            <div className="popover__meta">
              <span>{group.objectiveCount} objectives</span>
              <span className="dot">•</span>
              <span>{group.memberCount} members</span>
            </div>
          </div>
          <button className="popover__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {strategicObjectives.length > 0 && (
          <div className="popover__section">
            <div className="popover__sectionTitle">Strategic Objectives</div>
            <ul className="popover__list">
              {strategicObjectives.map((obj) => (
                <li key={obj.id} className="popover__item">
                  <div className="popover__itemTitle">{obj.title}</div>
                  <div className="popover__progress">
                    <div
                      className="popover__progressFill"
                      style={{ width: `${Math.round(obj.progress || 0)}%` }}
                    />
                  </div>
                  <div className="popover__progressText">
                    {Math.round(obj.progress || 0)}%
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {otherObjectives.length > 0 && (
          <div className="popover__section">
            <div className="popover__sectionTitle">Shared Objectives</div>
            <ul className="popover__list">
              {otherObjectives.map((obj) => (
                <li key={obj.id} className="popover__item">
                  <div className="popover__itemTitle">{obj.title}</div>
                  <div className="popover__progress">
                    <div
                      className="popover__progressFill"
                      style={{ width: `${Math.round(obj.progress || 0)}%` }}
                    />
                  </div>
                  <div className="popover__progressText">
                    {Math.round(obj.progress || 0)}%
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="popover__section">
          <div className="popover__sectionTitle">Members</div>
          {members.length === 0 ? (
            <div className="popover__empty">No members</div>
          ) : (
            <ul className="popover__members">
              {members.map((m) => (
                <li key={m.id} className="popover__member">
                  <span className="popover__memberAvatar">
                    {m.display_name?.[0]?.toUpperCase() || "?"}
                  </span>
                  <span className="popover__memberName">{m.display_name}</span>
                  {m.is_admin && <span className="popover__badge">Admin</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="popover__actions">
          <button
            type="button"
            className="popover__editButton"
            onClick={() =>
              onEditGroup &&
              onEditGroup({ id: group.groupId || group.nodeId, name: group.name })
            }
          >
            Edit group
          </button>
        </div>
      </div>
      <style jsx>{`
        .popover-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.25);
          z-index: 999;
        }
        .popover {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: min(640px, calc(100vw - 32px));
          max-height: 80vh;
          overflow-y: auto;
          background: var(--surface, #ffffff);
          border-radius: 12px;
          box-shadow: 0 24px 60px rgba(15, 23, 42, 0.25);
          padding: 18px 20px 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          z-index: 1000;
        }
        .popover__header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }
        .popover__title {
          font-size: 20px;
          font-weight: 700;
          color: var(--text, #0f172a);
        }
        .popover__meta {
          margin-top: 4px;
          display: inline-flex;
          gap: 8px;
          align-items: center;
          color: var(--text-secondary, #475569);
          font-size: 13px;
          font-weight: 600;
        }
        .popover__meta .dot {
          color: var(--muted, #94a3b8);
        }
        .popover__close {
          background: var(--surface-weak, #f1f5f9);
          border: 1px solid var(--border, #e2e8f0);
          width: 28px;
          height: 28px;
          border-radius: 50%;
          color: var(--text, #0f172a);
          font-size: 18px;
          cursor: pointer;
          line-height: 1;
        }
        .popover__section {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .popover__sectionTitle {
          font-size: 14px;
          font-weight: 700;
          color: var(--text, #1f2937);
          letter-spacing: 0.01em;
        }
        .popover__list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .popover__item {
          padding: 10px 12px;
          border: 1px solid var(--border, #e2e8f0);
          border-radius: 8px;
          background: var(--surface-weak, #f8fafc);
        }
        .popover__itemTitle {
          font-size: 14px;
          font-weight: 700;
          color: var(--text, #1f2937);
          margin-bottom: 8px;
        }
        .popover__progress {
          width: 100%;
          height: 6px;
          background: var(--border, #e2e8f0);
          border-radius: 999px;
          overflow: hidden;
          position: relative;
        }
        .popover__progressFill {
          height: 100%;
          background: linear-gradient(
            90deg,
            var(--success-strong, #22c55e),
            var(--success, #16a34a)
          );
          border-radius: 999px;
        }
        .popover__progressText {
          margin-top: 6px;
          font-size: 12px;
          font-weight: 600;
          color: var(--text-secondary, #475569);
        }
        .popover__members {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .popover__member {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
          border: 1px solid var(--border, #e2e8f0);
          border-radius: 8px;
          background: var(--surface-weak, #f8fafc);
        }
        .popover__memberAvatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: var(--pill-bg, #e2e8f0);
          color: var(--text, #0f172a);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 14px;
        }
        .popover__memberName {
          font-size: 14px;
          font-weight: 600;
          color: var(--text, #1f2937);
        }
        .popover__badge {
          font-size: 11px;
          font-weight: 700;
          color: var(--brand-strong, #0f172a);
          background: var(--badge-bg, #e0f2fe);
          border: 1px solid var(--badge-border, #bae6fd);
          border-radius: 999px;
          padding: 4px 8px;
        }
        .popover__empty {
          font-size: 13px;
          color: var(--text-secondary, #64748b);
        }
        .popover__actions {
          display: flex;
          justify-content: flex-end;
          padding-top: 4px;
        }
        .popover__editButton {
          background: var(--brand-primary, #2563eb);
          color: var(--surface, #ffffff);
          border: none;
          border-radius: 8px;
          padding: 10px 14px;
          font-weight: 700;
          font-size: 14px;
          cursor: pointer;
          box-shadow: 0 10px 20px rgba(37, 99, 235, 0.18);
        }
        .popover__editButton:hover {
          background: var(--brand-primary-strong, #1d4ed8);
        }
      `}</style>
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
}) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);

  const flatNodes = useMemo(
    () => buildFlatNodes(orgValue, expandedGroupId),
    [orgValue, expandedGroupId]
  );

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = new OrgChart();
    chartRef.current = chart;

    const baseNode = chart.defaultNode();
    chart
      .container(containerRef.current)
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
        borderRadius: 6,
        borderWidth: 1,
        borderColor: { red: 184, green: 210, blue: 210, alpha: 1 },
        backgroundColor: { red: 255, green: 255, blue: 255, alpha: 1 },
        connectorLineColor: { red: 64, green: 64, blue: 64, alpha: 1 },
        connectorLineWidth: 2.4,
        nodeImage: { ...baseNode.nodeImage, width: 0, height: 0, borderWidth: 0, shadow: false },
        nodeIcon: { ...baseNode.nodeIcon, size: 0 },
      });

    const handleResize = () => {
      if (!chartRef.current || !containerRef.current) {
        return;
      }

      chartRef.current
        .svgWidth(containerRef.current.clientWidth || 900)
        .render();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chartRef.current = null;
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, []);

  useEffect(() => {
  const chart = chartRef.current;
  if (!chart || !containerRef.current) return;

  chart.onNodeClick((nodeId) => {
    if (onNodeClick) {
      onNodeClick(nodeId);
    }
  });

  if (!flatNodes.length) {
    containerRef.current.innerHTML = "";
    return;
  }

    const width = containerRef.current.clientWidth || 900;
    const height = Math.max(520, flatNodes.length * 140);

    chart.svgWidth(width).svgHeight(height).data(flatNodes).render();
  }, [flatNodes, onNodeClick]);

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
        <div
          ref={containerRef}
          className="chartContainer"
          aria-label="Group organization chart"
        />
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
        />
      )}
      <style jsx>{`
        .chartShell {
          width: 100%;
          padding: 20px 12px 32px;
          background: linear-gradient(
            180deg,
            var(--surface-weak, #f4f6f9) 0%,
            var(--surface, #f1f3f6) 100%
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

        .org-card {
          width: 100%;
          height: 100%;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 10px;
          padding: 20px 22px;
          background: var(--surface, #ffffff);
          border: 1px solid var(--border, #cdd7e1);
          border-radius: 6px;
        }

        .org-card__content {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .org-card__title {
          font-size: 20px;
          font-weight: 700;
          color: var(--text, #0f172a);
          line-height: 1.2;
        }

        .org-card__chips {
          display: inline-flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .org-card__chip {
          background: var(--pill-bg, #eef2f2);
          color: var(--pill-text, #1f2937);
          border: 1px solid var(--pill-border, #cdd7e1);
          border-radius: 12px;
          padding: 6px 10px;
          font-size: 13px;
          font-weight: 600;
          line-height: 1;
        }

        .chartContainer .link {
          stroke: var(--connector, #3f3f46);
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
      `}</style>
    </>
  );
}
