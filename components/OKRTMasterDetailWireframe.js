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
import styles from "./OKRTMasterDetailWireframe.module.css";

const chip = (text, tone = "slate") => (
  <span className={`${styles.chip} ${styles[`chip_${tone}`]}`}>{text}</span>
);

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
        className={styles.progressRingLabel}
      >
        {Math.round(value * 100)}%
      </text>
    </svg>
  );
}

function Bar({ value }) {
  return (
    <div className={styles.bar}>
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


function ObjectiveHeader({ objective }) {
  return (
    <div className={styles.objHeader}>
      <div className={styles.objHeaderLeft}>
        <div className={styles.objHeaderIcon}>
          <Flag className={styles.iconMedium} />
        </div>
        <div>
          <div className={styles.objTitle}>{objective.title}</div>
          <div className={styles.objMeta}>
            {chip("2025-Q3")}
            {chip(objective.visibility === "private" ? "Private" : "Team", objective.visibility === "private" ? "slate" : "indigo")}
            {chip(objective.status.replace("_", " "))}
          </div>
        </div>
      </div>
      <div className={styles.objHeaderRight}>
        <div className={styles.objProgressWrapper}>
          <div className={styles.objProgress}>
            <ProgressRing value={objective.progress} size={56} />
            <div className={styles.progressLabel}>progress</div>
          </div>
          <div className={styles.objConfidence}>
            <div className={styles.confLabel}>confidence</div>
            <div className={styles.confValue}>{Math.round(objective.confidence * 100)}%</div>
          </div>
        </div>
        <button className={styles.btn}>
          <Share2 className={styles.iconSmall} /> Share (read-only)
        </button>
        <button className={styles.btnDark}>Focus</button>
      </div>
    </div>
  );
}

export default function OKRTMasterDetailWireframe() {
  const [selectedObjId, setSelectedObjId] = useState(demo.objectives[0].id);
  const selectedObj = useMemo(
    () => demo.objectives.find((o) => o.id === selectedObjId),
    [selectedObjId]
  );
  const [openKR, setOpenKR] = useState(selectedObj.krs[0]);

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <ObjectiveHeader objective={selectedObj} />
        {/* KR Grid and Drawer will use styles.xxx */}
      </main>
    </div>
  );
}
