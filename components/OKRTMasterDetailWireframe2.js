import React, { useMemo, useState } from "react";
import styles from "./OKRTMasterDetailWireframe2.module.css";
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

function ProgressRing({ value = 0.62, size = 40, stroke = 6, color = "#6366f1" }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - value);
  return (
    <svg width={size} height={size} className={styles.progressRing}>
      <circle
        stroke="#E5E7EB"
        fill="transparent"
        strokeWidth={stroke}
        r={radius}
        cx={size / 2}
        cy={size / 2}
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
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        className={styles.progressText}
      >
        {Math.round(value * 100)}%
      </text>
    </svg>
  );
}

function Bar({ value }) {
  return (
    <div className={styles.barBg}>
      <div
        className={styles.barFill}
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
      title: "Start My AI-first App Development Journey",
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
          title: "Build a basic AI-powered app and share a demo or code online",
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
          title: "Complete an Intro course on AI/ML (Coursera/Udemy) and notes",
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
    <aside className={styles.sidebar}>
      <div className={styles.sidebarHeader}>
        <div className={styles.logo}>90</div>
        <div className={styles.title}>90Days • OKRT</div>
      </div>
      <div className={styles.sidebarContent}>
        <div className={styles.searchBox}>
          <Search className={styles.icon} />
          <input className={styles.searchInput} placeholder="Search objectives…" />
        </div>
      </div>
      <div className={styles.sidebarList}>
        {objectives.map((o) => (
          <button
            key={o.id}
            onClick={() => onSelect(o.id)}
            className={`${styles.sidebarItem} ${selectedId === o.id ? styles.sidebarItemActive : ""}`}
          >
            <ProgressRing value={o.progress} size={36} />
            <div className={styles.sidebarItemText}>
              <div className={styles.sidebarItemTitle}>{o.title}</div>
            </div>
            <ChevronRight className={styles.chevron} />
          </button>
        ))}
      </div>
      <div className={styles.sidebarFooter}>
        <button className={styles.newObjective}>
          <Plus className={styles.plus} /> New Objective
        </button>
      </div>
    </aside>
  );
}

function ObjectiveHeader({ objective }) {
  return (
    <div className={styles.objectiveHeader}>
      <div className={styles.objectiveIcon}><Flag /></div>
      <div>
        <div className={styles.objectiveTitle}>{objective.title}</div>
        <div className={styles.objectiveMeta}>
          <span className={styles.chip}>2025-Q3</span>
          <span className={styles.chip}>{objective.visibility}</span>
          <span className={styles.chip}>{objective.status.replace("_", " ")}</span>
        </div>
      </div>
      <div className={styles.objectiveActions}>
        <ProgressRing value={objective.progress} size={56} />
        <button className={styles.shareButton}><Share2 /> Share(Read Only)</button>
        <button className={styles.focusButton}>Focus</button>
      </div>
    </div>
  );
}

function KRCard({ kr, selected, onOpen }) {
  const atRisk = kr.status === "blocked" || (kr.progress < 0.35 && kr.status !== "done");
  return (
    <button
      onClick={() => onOpen(kr)}
      className={`${styles.krCard} ${selected ? styles.krCardSelected : ""} ${atRisk ? styles.krCardAtRisk : ""}`}
    >
      <div className={styles.krCardHeader}>
        <CheckCircle2 className={styles.krIcon} />
        <div className={styles.krText}>
          <div className={styles.krTitle}>{kr.title}</div>
          <Bar value={kr.progress} />
          <div className={styles.krMeta}>
            <Calendar /> {kr.due}
            <span className={styles.chip}>{kr.status}</span>
            {atRisk && <span className={styles.atRisk}><AlertTriangle /> at-risk</span>}
          </div>
        </div>
        <ChevronRight className={styles.chevron} />
      </div>
    </button>
  );
}

function Drawer({ kr, onClose }) {
  if (!kr) return null;
  return (
    <aside className={styles.drawer}>
      <div className={styles.drawerHeader}>
        <span>Key Result</span>
        <button onClick={onClose} className={styles.closeButton}>Close</button>
      </div>
      <div className={styles.drawerTitle}>{kr.title}</div>
      <Bar value={kr.progress} />
      <div className={styles.taskList}>
        {kr.tasks?.map((t) => (
          <div key={t.id} className={styles.taskItem}>
            <input type="checkbox" defaultChecked={t.done} />
            <span className={t.done ? styles.taskDone : ""}>{t.title}</span>
          </div>
        ))}
      </div>
      <button className={styles.addTask}><Plus /> Add task</button>
    </aside>
  );
}

export default function OKRTMasterDetailWireframe() {
  const [selectedObjId, setSelectedObjId] = useState(demo.objectives[0].id);
  const selectedObj = useMemo(
    () => demo.objectives.find((o) => o.id === selectedObjId),
    [selectedObjId]
  );
  const [openKR, setOpenKR] = useState(selectedObj?.krs[0]);

  return (
    <div className={styles.container}>
      <Sidebar
        objectives={demo.objectives}
        selectedId={selectedObjId}
        onSelect={(id) => {
          setSelectedObjId(id); // Update the selected objective ID
          const o = demo.objectives.find((x) => x.id === id); // Find the objective
          setOpenKR(o?.krs[0]); // Set the first KR of the new objective, or undefined if no objective/KRs
        }}
      />
      <main className={styles.main}>
        <ObjectiveHeader objective={selectedObj} />
        <div className={styles.krGrid}>
          {selectedObj.krs.map((kr) => (
            <KRCard key={kr.id} kr={kr} selected={openKR?.id === kr.id} onOpen={setOpenKR} />
          ))}
          <button className={styles.addKR}><Plus /> Add Key Result</button>
        </div>
      </main>
      {openKR && <Drawer kr={openKR} onClose={() => setOpenKR(undefined)} />}
    </div>
  );
}
