import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Plus, Users } from "lucide-react";
import { GrTrophy } from "react-icons/gr";
import { RiAdminLine } from "react-icons/ri";
import { FaRegUser } from "react-icons/fa";

/*
  Groups — Phase 6 prototype
  - Left: hierarchy (one parent + three children) with 90° connectors
  - Right: expanded Group Card (same visual language as OKRT)
  - Node: 60×60 thumbnail (chamfered), name, shared OKRT count, chevron to expand
  - Expanded content: Objectives (trophy + progress) → divider → Members (admin marker)

  Tailwind-only, drop-in alongside your OKRT components.
*/

// --------- Demo Data ---------
const demo = {
  groups: [
    {
      id: "G0",
      name: "Acme Org",
      type: "Organisation",
      parent_group_id: null,
      thumbnail_url:
        "https://images.unsplash.com/photo-1587614382346-4ec71c159c6d?q=80&w=120&auto=format&fit=crop",
    },
    {
      id: "G1",
      name: "Engineering",
      type: "Department",
      parent_group_id: "G0",
      thumbnail_url:
        "https://images.unsplash.com/photo-1521791136064-7986c2920216?q=80&w=120&auto=format&fit=crop",
    },
    {
      id: "G2",
      name: "Sales",
      type: "Department",
      parent_group_id: "G0",
      thumbnail_url:
        "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?q=80&w=120&auto=format&fit=crop",
    },
    {
      id: "G3",
      name: "Design Squad",
      type: "Squad",
      parent_group_id: "G0",
      thumbnail_url:
        "https://images.unsplash.com/photo-1545167622-3a6ac756afa4?q=80&w=120&auto=format&fit=crop",
    },
  ],
  // Simulated "SHARE" counts per group
  sharedOkrtCount: { G0: 12, G1: 5, G2: 3, G3: 4 },
  objectivesByGroup: {
    G0: [
      { id: "O1", title: "Ship org-wide OKRT v1", progress: 0.72 },
      { id: "O2", title: "Security hardening", progress: 0.41 },
    ],
    G1: [
      { id: "O3", title: "Platform reliability 99.95%", progress: 0.58 },
      { id: "O4", title: "Developer Happiness", progress: 0.33 },
    ],
    G2: [
      { id: "O5", title: "Land 20 enterprise logos", progress: 0.44 },
    ],
    G3: [
      { id: "O6", title: "New design system", progress: 0.67 },
      { id: "O7", title: "Website refresh", progress: 0.22 },
    ],
  },
  membersByGroup: {
    G0: [
      { id: "U1", name: "Ava", admin: true },
      { id: "U2", name: "Ben" },
      { id: "U3", name: "Chloe" },
    ],
    G1: [
      { id: "U1", name: "Ava", admin: true },
      { id: "U4", name: "Diego" },
      { id: "U5", name: "Eli" },
    ],
    G2: [
      { id: "U6", name: "Fay", admin: true },
      { id: "U7", name: "Gus" },
    ],
    G3: [
      { id: "U8", name: "Hana", admin: true },
      { id: "U9", name: "Ivan" },
      { id: "U10", name: "Jae" },
    ],
  },
};

// --------- Small UI bits ---------
function Bar({ value }: { value: number }) {
  const pct = Math.round(Math.max(0, Math.min(100, value * 100)));
  return (
    <div className="w-full h-2 rounded-full bg-slate-200">
      <div className="h-2 rounded-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700">
      {children}
    </span>
  );
}

// --------- Group Node (card inside the tree) ---------
function GroupNode({
  g,
  count,
  selected,
  expanded,
  onSelect,
  onToggle,
  inner,
  overlay,
}: {
  g: any;
  count: number;
  selected: boolean;
  expanded: boolean;
  onSelect: () => void;
  onToggle: () => void;
  inner?: React.ReactNode;
  overlay?: boolean;
}) {
  return (
    <div className={`relative w-[320px] ${overlay && expanded ? 'z-[60]' : 'z-10'}`}>
      <div
        className={
          `flex items-center gap-3 rounded-xl border bg-white p-2 pr-3 shadow-sm ` +
          (selected ? "border-indigo-300 ring-2 ring-indigo-200 " : "border-slate-200 ")
        }
      >
        <img
          src={g.thumbnail_url}
          alt="thumb"
          className="h-[60px] w-[60px] rounded-[12px] object-cover"
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{g.name}</div>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
            <Chip>{g.type}</Chip>
            <span>{count>Objectives</span>
          </div>
        </div>
        <button
          onClick={() => {
            onToggle();
            onSelect();
          }}
          className="rounded-lg border border-slate-200 bg-white p-1.5 hover:bg-slate-50"
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-slate-600" />
          ) : (
            <ChevronRight className="h-4 w-4 text-slate-600" />
          )}
        </button>
      </div>
      {expanded && (
        overlay ? (
          <div className="absolute left-0 top-full z-[70] mt-2 w-[360px] rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
            {inner}
          </div>
        ) : (
          <div className="mt-2 rounded-xl border border-slate-200 bg-white p-3">
            {inner}
          </div>
        )
      )}
    </div>
  );
}

// --------- Expanded content used inside node AND in side panel ---------
function ExpandedGroupContent({ gid }: { gid: string }) {
  const objectives = demo.objectivesByGroup[gid] || [];
  const members = demo.membersByGroup[gid] || [];
  return (
    <div className="space-y-3">
      {/* Objectives */}
      <div className="space-y-2">
        {objectives.map((o) => (
          <div key={o.id} className="flex items-center gap-2">
            <GrTrophy className="h-4 w-4 text-slate-700" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{o.title}</div>
              <div className="mt-1 flex items-center gap-2">
                <Bar value={o.progress} />
                <div className="w-8 text-right text-xs text-slate-600">{Math.round(o.progress * 100)}%</div>
              </div>
            </div>
          </div>
        ))}
        {objectives.length === 0 && (
          <div className="text-xs text-slate-500">No objectives shared yet.</div>
        )}
      </div>

      <div className="my-2 h-px bg-slate-200" />

      {/* Members */}
      <div className="space-y-1">
        {members.map((m) => (
          <div key={m.id} className="flex items-center gap-2 text-sm">
            {m.admin ? (
              <RiAdminLine className="h-4 w-4 text-slate-700" />
            ) : (
              <FaRegUser className="h-4 w-4 text-slate-700" />
            )}
            <span className="truncate">{m.name}</span>
            {m.admin && (
              <span className="ml-auto text-[11px] text-slate-500">admin</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// --------- Main Component ---------
export default function GroupsHierarchy() {
  const parent = demo.groups.find((g) => g.parent_group_id === null)!; // G0
  const children = demo.groups.filter((g) => g.parent_group_id === parent.id); // G1..G3

  // selection & expansion
  const [selectedId, setSelectedId] = useState<string>(parent.id);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // layout refs for connectors
  const wrapRef = useRef<HTMLDivElement>(null);
  const pRef = useRef<HTMLDivElement>(null);
  const cRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [paths, setPaths] = useState<string[]>([]);

  useEffect(() => {
    function redraw() {
      const wrap = wrapRef.current; const p = pRef.current; const cs = cRefs.current;
      if (!wrap || !p || cs.some((n) => !n)) return;
      const wb = wrap.getBoundingClientRect();
      const pb = p.getBoundingClientRect();
      const startX = pb.left - wb.left + pb.width / 2; // bottom center of parent card
      const startY = pb.top - wb.top + pb.height;
      const newPaths: string[] = [];
      cs.forEach((node) => {
        if (!node) return;
        const cb = node.getBoundingClientRect();
        const endX = cb.left - wb.left + cb.width / 2; // top center of child card
        const endY = cb.top - wb.top; // top edge
        const midY = (startY + endY) / 2; // 90° elbow
        // path: down from parent, horizontal to child, down to child
        const d = `M ${startX},${startY} V ${midY} H ${endX} V ${endY}`;
        newPaths.push(d);
      });
      setPaths(newPaths);
    }
    redraw();
    window.addEventListener("resize", redraw);
    return () => window.removeEventListener("resize", redraw);
  }, []);

  const groupById = useMemo(() => Object.fromEntries(demo.groups.map((g) => [g.id, g])), []);

  return (
    <div className="flex h-[88vh] w-full min-w-[320px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
      {/* Left: Groups menu (as requested) */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="font-semibold">Groups</div>
          <button className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs hover:bg-slate-50">
            <Plus className="h-3.5 w-3.5" /> Add Group
          </button>
        </div>
        <div className="p-3 text-xs text-slate-600">Navigate your organisation tree and manage group sharing.</div>
      </aside>

      {/* Center: Tree with 90° connectors */}
      <main className="relative flex-1 overflow-auto p-4 lg:p-6">
        <div ref={wrapRef} className="relative isolate mx-auto grid max-w-5xl grid-cols-1 gap-12 md:grid-cols-3">
          {/* Parent row (spans all) */}
          <div className="col-span-1 md:col-span-3 flex justify-center">
            <div ref={pRef}>
              <GroupNode
                g={parent}
                count={demo.sharedOkrtCount[parent.id]}
                selected={selectedId === parent.id}
                expanded={!!expanded[parent.id]}
                onSelect={() => setSelectedId(parent.id)}
                onToggle={() => setExpanded((s) => ({ ...s, [parent.id]: !s[parent.id] }))}
                inner={<ExpandedGroupContent gid={parent.id} />}
                overlay
              />
            </div>
          </div>

          {/* SVG connectors overlay */}
          <svg className="pointer-events-none absolute left-0 top-0 z-0 h-full w-full" fill="none">
            {paths.map((d, i) => (
              <path key={i} d={d} stroke="#CBD5E1" strokeWidth={2} />
            ))}
            {/* draw small dots at elbows/endpoints for clarity */}
          </svg>

          {/* Children row */}
          {children.map((g, i) => (
            <div key={g.id} className="flex justify-center">
              <div ref={(el) => (cRefs.current[i] = el)} className="relative z-10">
                <GroupNode
                  g={g}
                  count={demo.sharedOkrtCount[g.id]}
                  selected={selectedId === g.id}
                  expanded={!!expanded[g.id]}
                  onSelect={() => setSelectedId(g.id)}
                  onToggle={() => setExpanded((s) => ({ ...s, [g.id]: !s[g.id] }))}
                  inner={<ExpandedGroupContent gid={g.id} />}
                />
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Right: Expanded Group Card for selected node */}
      <aside className="hidden lg:flex w-[420px] shrink-0 flex-col border-l border-slate-200 bg-white">
        {selectedId ? (
          <div className="flex flex-col gap-3 p-4">
            <div className="flex items-center gap-3">
              <img
                src={groupById[selectedId].thumbnail_url}
                alt="thumb"
                className="h-[60px] w-[60px] rounded-[12px] object-cover"
              />
              <div>
                <div className="text-base font-semibold leading-tight">{groupById[selectedId].name}</div>
                <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                  <Chip>{groupById[selectedId].type}</Chip>
                  <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {demo.membersByGroup[selectedId]?.length ?? 0} members</span>
                  <span>•</span>
                  <span>{demo.sharedOkrtCount[selectedId] ?? 0} shared OKRTs</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Objectives</div>
              <div className="mt-2 space-y-2">
                {(demo.objectivesByGroup[selectedId] || []).map((o) => (
                  <div key={o.id} className="flex items-center gap-2">
                    <GrTrophy className="h-4 w-4 text-slate-700" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{o.title}</div>
                      <div className="mt-1 flex items-center gap-2">
                        <Bar value={o.progress} />
                        <div className="w-8 text-right text-xs text-slate-600">{Math.round(o.progress * 100)}%</div>
                      </div>
                    </div>
                  </div>
                ))}
                {(demo.objectivesByGroup[selectedId] || []).length === 0 && (
                  <div className="text-xs text-slate-500">No objectives shared yet.</div>
                )}
              </div>

              <div className="my-3 h-px bg-slate-200" />

              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Members</div>
              <div className="mt-2 space-y-1">
                {(demo.membersByGroup[selectedId] || []).map((m) => (
                  <div key={m.id} className="flex items-center gap-2 text-sm">
                    {m.admin ? (
                      <RiAdminLine className="h-4 w-4 text-slate-700" />
                    ) : (
                      <FaRegUser className="h-4 w-4 text-slate-700" />
                    )}
                    <span className="truncate">{m.name}</span>
                    {m.admin && (
                      <span className="ml-auto text-[11px] text-slate-500">admin</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="m-auto text-sm text-slate-500">Select a group to see details</div>
        )}
      </aside>
    </div>
  );
}
