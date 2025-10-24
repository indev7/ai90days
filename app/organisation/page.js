"use client";
import React, { useState, useEffect } from "react";
import { OrganizationChart } from "primereact/organizationchart";
import "primereact/resources/themes/lara-light-blue/theme.css";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";

/*************************
 * Helpers
 *************************/
/** Transform API group data to OrganizationChart format */
function transformGroupToChartNode(group) {
  const node = {
    label: group.name,
    expanded: true,
    data: {
      name: group.name,
      type: group.type,
      thumbnail_url: group.thumbnail_url,
      objectiveCount: group.objectiveCount || 0,
      memberCount: group.memberCount || 0,
    },
  };

  if (group.children && group.children.length > 0) {
    node.children = group.children.map(transformGroupToChartNode);
  }

  return node;
}

/** Build display name with type suffix.
 *  Rules:
 *   - Group => suffix "Organisation" (UK spelling)
 *   - Otherwise, use the given type (e.g., Squad, Department)
 *   - Avoid duplicating the suffix if name already ends with it (case-insensitive).
 *   - For Group, also avoid duplicating if name already ends with "Organization" (US) or "Organisation" (UK).
 */
function displayNameFor(name = "", type = "") {
  const suffix = type === "Group" ? "Organisation" : type || "";
  if (!suffix) return name;

  const lowerName = name.trim().toLowerCase();
  const endsWithSuffix = lowerName.endsWith(suffix.toLowerCase());
  const endsWithOrgUS = type === "Group" && lowerName.endsWith("organization");
  const endsWithOrgUK = type === "Group" && lowerName.endsWith("organisation");

  if (endsWithSuffix || endsWithOrgUS || endsWithOrgUK) return name;
  return `${name} ${suffix}`;
}

/*************************
 * Node Template (UI) — PURE CSS (no Tailwind)
 *************************/
function NodeTemplate(node) {
  const d = node.data || {};

  // Title: plain name only (no icon, no type suffix)
  const title = d.name || node.label;

  // Lower line: human-readable type (Group => Organisation), then counts
  const typeLabel = d.type === "Group" ? "Organisation" : d.type || "";
  const metaParts = [];
  if (typeLabel) metaParts.push(typeLabel);
  if (d.memberCount !== undefined)
    metaParts.push(`${d.memberCount} member${d.memberCount === 1 ? "" : "s"}`);
  if (d.objectiveCount !== undefined)
    metaParts.push(`${d.objectiveCount} objective${d.objectiveCount === 1 ? "" : "s"}`);
  const meta = metaParts.join(" • ");

  // Fixed-size, vertically & horizontally centered content, 5px corner radius
  const nodeBoxStyle = {
    width: 200,
    height: 80,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    padding: 0,
    borderRadius: 5,
  };

  const titleStyle = {
    width: "100%",
    textAlign: "center",
    fontWeight: 600,
    lineHeight: 1,
  };

  const metaStyle = {
    width: "100%",
    textAlign: "center",
    fontSize: 12,
    color: "#64748b", // slate-500
  };

  return (
    <div style={nodeBoxStyle}>
      <div style={titleStyle}>{title}</div>
      <div style={metaStyle}>{meta}</div>
    </div>
  );
}

/*************************
 * Runtime sanity checks ("tests")
 *************************/
(function runDevAssertions() {
  try {
    // Existing tests (kept intact)
    console.assert(
      displayNameFor("Intervest", "Group") === "Intervest Organisation",
      "Group suffix failed"
    );
    console.assert(
      displayNameFor("Intervest Organization", "Group") ===
        "Intervest Organization",
      "Should not duplicate Organization/Organisation"
    );
    console.assert(
      displayNameFor("Intervest Organisation", "Group") ===
        "Intervest Organisation",
      "Should not duplicate Organisation if already present"
    );
    console.assert(
      displayNameFor("Development", "Squad") === "Development Squad",
      "Squad suffix failed"
    );
    console.assert(
      displayNameFor("UI Department", "Department") === "UI Department",
      "Should not duplicate Department if already present"
    );
    console.assert(
      displayNameFor("Finance", "Group") === "Finance Organisation",
      "Group suffix should append Organisation"
    );

    // Additional tests (new)
    console.assert(
      displayNameFor("", "") === "",
      "Empty name/type should remain empty"
    );
    console.assert(
      displayNameFor("Alpha ", "Group") === "Alpha Organisation",
      "Trim + Group suffix should append once"
    );
    console.assert(
      displayNameFor("Research Team", "Team") === "Research Team",
      "If name already ends with suffix (Team), do not duplicate"
    );
    console.assert(
      displayNameFor("Ops", "Department") === "Ops Department",
      "Generic type should append to name"
    );
  } catch (e) {
    // no-op; assertions are for local dev visibility only
  }
})();

/*************************
 * Component
 *************************/
export default function IntervestOrgChart() {
  const [orgValue, setOrgValue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchGroupHierarchy();
  }, []);

  const fetchGroupHierarchy = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/groups?hierarchy=true');
      if (!response.ok) {
        throw new Error('Failed to fetch group hierarchy');
      }
      
      const data = await response.json();
      
      // Transform the API data to OrganizationChart format
      const chartData = data.groups.map(transformGroupToChartNode);
      setOrgValue(chartData);
    } catch (err) {
      console.error('Error fetching group hierarchy:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", width: "100%", background: "#f8fafc", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 8 }}>
      {/* PrimeReact overrides & connector tuning */}
      <style>{`
        /* 1) Horizontal gap between sibling boxes via TD padding (table-safe) */
        .p-organizationchart .p-organizationchart-node { padding: 0 12px !important; }

        /* 2) Node box: no margin; ensure positioning context for toggler */
        .p-organizationchart .p-organizationchart-node-content {
          padding: 0 !important;
          border-radius: 5px;
          border: 1px solid #334155 !important; /* slate-700 */
          background: #ffffff;
          margin: 0 !important;       /* margin on table content can be ignored/collapsed */
          position: relative;          /* anchor for chevron centering */
          box-sizing: border-box;      /* stable sizing with border */
        }

        /* 3) Center the chevron/toggler precisely under the node content */
        .p-organizationchart .p-organizationchart-node-content .p-organizationchart-toggler {
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          bottom: -12px;               /* adjust ±2px if needed */
          margin: 0;
        }

        /* 4) Make connector lines visible and consistent */
        .p-organizationchart .p-organizationchart-line-down {
          height: 12px !important;
          min-height: 12px !important;
          margin: 0 auto !important;
          border-left: 1px solid #334155 !important;
        }
        .p-organizationchart .p-organizationchart-lines .p-organizationchart-line-left { border-right: 1px solid #334155 !important; }
        .p-organizationchart .p-organizationchart-lines .p-organizationchart-line-right { border-left: 1px solid #334155 !important; }
        .p-organizationchart .p-organizationchart-lines .p-organizationchart-line-top { border-top: 1px solid #334155 !important; }

        /* 5) Moderate vertical spacing for legibility */
        .p-organizationchart .p-organizationchart-lines td { padding-top: 8px !important; padding-bottom: 8px !important; line-height: 0; }
        .p-organizationchart .p-organizationchart-node { margin-top: 0 !important; margin-bottom: 0 !important; }
      `}</style>

      <div style={{ maxWidth: "100%", overflow: "auto" }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 16px" }}>Groups</h1>
        
        {loading && (
          <div style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
            Loading group hierarchy...
          </div>
        )}
        
        {error && (
          <div style={{ textAlign: "center", padding: "40px", color: "#ef4444" }}>
            Error: {error}
          </div>
        )}
        
        {!loading && !error && orgValue.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
            No groups found. Create a group to get started.
          </div>
        )}
        
        {!loading && !error && orgValue.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
            {orgValue.map((rootGroup, index) => (
              <div key={rootGroup.data?.name || index} style={{ width: "100%" }}>
                <OrganizationChart value={[rootGroup]} nodeTemplate={NodeTemplate} collapsible={false} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


