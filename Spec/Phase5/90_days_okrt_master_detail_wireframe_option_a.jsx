import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Flag,
  Menu,
  Plus,
  Search,
  Share2,
  Shield,
  Users,
} from "lucide-react";

/*
  90Days — Master–Detail OKRT Wireframe (responsive)
  - Left: Objective tree with progress rings
  - Center: Focus panel for selected Objective + KRs list
  - Right: Context drawer for selected KR (tasks, notes)

  Tailwind only; no external UI deps. Uses lucide-react for icons.
  Tip: Resize the canvas to see responsive behavior.
*/

const chip = (text, tone = "slate") => (
  <span
    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-${tone}-100 text-${tone}-700 border border-${tone}-200`}
  >
    {text}
  </span>
);

function ProgressRing({ value = 0.62, size = 40, stroke = 6, color = "#6366f1", track = "#E5E7EB" }) {
  // Clamp and compute geometry
  const v = Math.max(0, Math.min(1, value ?? 0));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  // Small epsilon so Safari doesn't hide a full-offset arc at 0%
  const offset = circumference * (1 - v) + 0.0001;

  return (
    <svg
      width={size}
      height={size}
      className="shrink-0"
      role="img"
      aria-label={`Progress ${Math.round(v * 100)}%`}
    >
      {/* Rotate drawing group so progress starts at 12 o'clock */}
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle
          stroke={track}
          strokeOpacity="0.6"
          fill="transparent"
          strokeWidth={stroke}
          r={radius}
          cx={size / 2}
          cy={size / 2}
          vectorEffect="non-scaling-stroke"
        />
        <circle
          stroke={color}
          fill="transparent"
          strokeLinecap="round"
          strokeWidth={stroke}
          r={radius}
          cx={size / 2}
          cy={size / 2}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset .4s ease" }}
          vectorEffect="non-scaling-stroke"
        />
      </g>
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        className="text-[10px] fill-slate-700 font-semibold"
      >
        {Math.round(v * 100)}%
      </text>
    </svg>
  );
}

function Bar({ value }) {
  return (
    <div className="w-full h-2 rounded-full bg-slate-200">
      <div
        className="h-2 rounded-full bg-indigo-500 transition-all"
        style={{ width: `${Math.min(100, Math.max(0, Math.round(value * 100)))}%` }}
      />
    </div>
  );
}

const demo = {
  cycle: "2025-Q3",
  objectives: [
    {
      id: "OBJ-1",
      title: "Start My AI‑first App Development Journey",
      owner: "LA",
      visibility: "team",
      status: "in_progress",
      progress: 0.298,
      confidence: 0.7,
      krs: [
        {
          id: "KR-1",
          title: "Brainstorm simple app ideas (chatbot, recommendation tool, etc.)",
          progress: 0.9,
          status: "in_progress",
          due: "Sep 30",
          tasks: [
            { id: "T-1", title: "List 10 app ideas", done: true },
            { id: "T-2", title: "Pick 1 to prototype", done: true },
            { id: "T-3", title: "Define success metrics", done: false },
          ],
        },
        {
          id: "KR-2",
          title:
            "Build a basic AI‑powered app and share a demo or code online",
          progress: 0.297,
          status: "in_progress",
          due: "Oct 10",
          tasks: [
            { id: "T-4", title: "Create repo", done: true },
            { id: "T-5", title: "Scaffold UI", done: false },
            { id: "T-6", title: "Record demo", done: false },
          ],
        },
        {
          id: "KR-3",
          title:
            "Complete an Intro course on AI/ML (Coursera/Udemy) and notes",
          progress: 0.0,
          status: "todo",
          due: "Oct 25",
          tasks: [
            { id: "T-7", title: "Pick course", done: false },
            { id: "T-8", title: "Block study hours", done: false },
          ],
        },
      ],
    },
    {
      id: "OBJ-2",
      title: "Launch the 90Days OKRT Coach Beta",
      owner: "LA",
      visibility: "private",
      status: "not_started",
      progress: 0.0,
      confidence: 0.6,
      krs: [],
    },
  ],
};

function Sidebar({ objectives, selectedId, onSelect }) {
  return (
    <aside className="hidden lg:flex w-72 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center gap-2 p-4 border-b">
        <div className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold">90</div>
        <div className="font-semibold">90Days • OKRT</div>
      </div>
      <div className="p-3">
        <div className="flex items-center gap-2 rounded-xl border bg-slate-50 px-2 py-1.5">
          <Search className="h-4 w-4 text-slate-500" />
          <input className="w-full bg-transparent text-sm outline-none" placeholder="Search objectives…" />
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs">
          {chip("All", "slate")} {chip("Mine", "slate")} {chip("Team", "slate")} {chip("At‑risk", "amber")}
        </div>
      </div>
      <div className="overflow-auto px-2 pb-4">
        {objectives.map((o) => (
          <button
            key={o.id}
            onClick={() => onSelect(o.id)}
            className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left hover:bg-slate-50 ${
              selectedId === o.id ? "border-indigo-300 bg-indigo-50" : "border-slate-200"
            }`}
          >
            <ProgressRing value={o.progress} size={36} />
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{o.title}</div>
              <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
                <Calendar className="h-3 w-3" /> 2025‑Q3
                <span className="mx-1">•</span>
                <Users className="h-3 w-3" /> {o.visibility}
              </div>
            </div>
            <ChevronRight className="ml-auto h-4 w-4 text-slate-400" />
          </button>
        ))}
      </div>
      <div className="mt-auto p-3">
        <button className="w-full rounded-xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700">
          <Plus className="mr-1 inline h-4 w-4" /> New Objective
        </button>
      </div>
    </aside>
  );
}

function ObjectiveHeader({ objective }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-2xl bg-indigo-100 flex items-center justify-center">
          <Flag className="h-5 w-5 text-indigo-600" />
        </div>
        <div>
          <div className="text-base font-semibold leading-tight">{objective.title}</div>
          <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
            {chip("2025‑Q3")}
            {chip(objective.visibility === "private" ? "Private" : "Team", objective.visibility === "private" ? "slate" : "indigo")}
            {chip(objective.status.replace("_", " "))}
          </div>
        </div>
      </div>
      <div className="ml-auto flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="text-center">
            <ProgressRing value={objective.progress} size={56} />
            <div className="mt-1 text-[11px] text-slate-500">progress</div>
          </div>
          <div className="hidden sm:block">
            <div className="text-xs text-slate-500">confidence</div>
            <div className="text-sm font-semibold">{Math.round(objective.confidence * 100)}%</div>
          </div>
        </div>
        <button className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50">
          <Share2 className="mr-1 inline h-4 w-4" /> Share (read‑only)
        </button>
        <button className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-black/90">
          Focus
        </button>
      </div>
    </div>
  );
}

function KRCard({ kr, selected, onOpen }) {
  const atRisk = kr.status === "blocked" || (kr.progress < 0.35 && kr.status !== "done");
  return (
    <button
      onClick={() => onOpen(kr)}
      className={`flex w-full flex-col gap-3 rounded-2xl border bg-white p-4 text-left transition ${
        selected ? "border-indigo-300 ring-2 ring-indigo-200" : "border-slate-200 hover:bg-slate-50"
      } ${atRisk ? "outline outline-1 outline-amber-300" : ""}`}
    >
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center">
          <CheckCircle2 className="h-5 w-5 text-slate-600" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium leading-snug line-clamp-2">{kr.title}</div>
          <div className="mt-2"><Bar value={kr.progress} /></div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <Calendar className="h-3.5 w-3.5" /> {kr.due}
            <span className="mx-1">•</span>
            {chip(kr.status.replace("_", " "))}
            {atRisk && (
              <span className="inline-flex items-center gap-1 text-amber-700">
                <AlertTriangle className="h-3.5 w-3.5" /> at‑risk
              </span>
            )}
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-slate-400" />
      </div>
    </button>
  );
}

function Drawer({ kr, onClose }) {
  if (!kr) return null;
  return (
    <div className="fixed inset-0 z-30 lg:static lg:z-auto">
      {/* Backdrop (mobile) */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm lg:hidden"
        onClick={onClose}
      />
      <aside className="absolute right-0 top-0 h-full w-[90%] max-w-md border-l border-slate-200 bg-white p-4 lg:static lg:w-96">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">Key Result</div>
          <button onClick={onClose} className="lg:hidden rounded-lg border px-2 py-1 text-xs">Close</button>
        </div>
        <div className="mt-2 text-base font-medium leading-snug">{kr.title}</div>
        <div className="mt-3 space-y-2">
          <div>
            <div className="mb-1 text-xs text-slate-500">progress</div>
            <Bar value={kr.progress} />
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <Calendar className="h-3.5 w-3.5" /> due {kr.due}
            <span className="mx-1">•</span>
            {chip("in review", "slate")}
          </div>
        </div>
        <div className="mt-5">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Tasks</div>
          <ul className="space-y-2">
            {kr.tasks?.map((t) => (
              <li key={t.id} className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
                <input type="checkbox" defaultChecked={t.done} className="mt-1" />
                <span className={`text-sm ${t.done ? "line-through text-slate-400" : ""}`}>{t.title}</span>
              </li>
            ))}
          </ul>
          <button className="mt-3 inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs hover:bg-slate-50">
            <Plus className="h-3.5 w-3.5" /> Add task
          </button>
        </div>
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          <div className="mb-1 font-semibold text-slate-700">Coach suggestions</div>
          <ul className="list-disc pl-4 space-y-1">
            <li>Block 2× 45‑min focus sessions this week.</li>
            <li>Add a measurable metric to this KR title.</li>
          </ul>
          <div className="mt-3 flex gap-2">
            <button className="rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-700">Accept</button>
            <button className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50">Later</button>
          </div>
        </div>
      </aside>
    </div>
  );
}

export default function OKRTMasterDetailWireframe() {
  const [selectedObjId, setSelectedObjId] = useState(demo.objectives[0].id);
  const selectedObj = useMemo(
    () => demo.objectives.find((o) => o.id === selectedObjId)!,
    [selectedObjId]
  );
  const [openKR, setOpenKR] = useState(selectedObj.krs[0]);

  return (
    <div className="flex h-[88vh] w-full min-w-[320px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
      {/* Mobile topbar */}
      <div className="fixed left-0 top-0 z-20 flex w-full items-center gap-2 border-b border-slate-200 bg-white/90 px-3 py-2 backdrop-blur lg:hidden">
        <button className="rounded-lg border px-2 py-1 text-xs">
          <Menu className="h-4 w-4" />
        </button>
        <div className="font-semibold">OKRT</div>
        <div className="ml-auto text-xs text-slate-500">{demo.cycle}</div>
      </div>

      <Sidebar
        objectives={demo.objectives}
        selectedId={selectedObjId}
        onSelect={(id) => {
          setSelectedObjId(id);
          const o = demo.objectives.find((x) => x.id === id)!;
          setOpenKR(o.krs[0]);
        }}
      />

      {/* Main area */}
      <main className="flex-1 overflow-auto p-3 lg:p-6 pt-12 lg:pt-6">
        <ObjectiveHeader objective={selectedObj} />

        {/* KRs */}
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {selectedObj.krs.map((kr) => (
            <KRCard key={kr.id} kr={kr} selected={openKR?.id === kr.id} onOpen={setOpenKR} />
          ))}
          <button className="flex items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500 hover:border-slate-400 hover:text-slate-700">
            <Plus className="mr-2 h-4 w-4" /> Add Key Result
          </button>
        </div>

        {/* Bottom Action Bar */}
        <div className="fixed bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 shadow-lg backdrop-blur">
          <div className="flex items-center gap-2 text-sm">
            <Shield className="h-4 w-4 text-slate-600" />
            <span className="text-slate-700">Coach</span>
            <button className="rounded-lg bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-700">Recalc progress</button>
            <button className="rounded-lg border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50">Suggest next step</button>
          </div>
        </div>
      </main>

      {/* Right Drawer (context) */}
      <div className="hidden lg:block w-96 border-l border-slate-200 bg-white">
        <Drawer kr={openKR} onClose={() => setOpenKR(undefined)} />
      </div>

      {/* Mobile Drawer overlay */}
      <div className="lg:hidden">{openKR && <Drawer kr={openKR} onClose={() => setOpenKR(undefined)} />}</div>
    </div>
  );
}
