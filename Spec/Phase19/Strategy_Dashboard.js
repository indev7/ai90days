import React, { useEffect } from "react";

const MOCK_OBJECTIVES = [
  {
    id: 1,
    title: "Skill Development – Increase job readiness",
    progress: 100,
    category: "Personal Growth",
    keyResults: [
      { id: 11, title: "Apply at least 3 new techniques/tools", progress: 100 },
      { id: 12, title: "Complete 1 professional course", progress: 100 },
      { id: 13, title: "Get positive feedback from manager", progress: 100 },
    ],
  },
  {
    id: 2,
    title: "Test D – Enhancing Personal Skills",
    progress: 35,
    category: "Personal Growth",
    keyResults: [
      { id: 21, title: "Practice a new skill 3x per week", progress: 20 },
      { id: 22, title: "Share learning with the team", progress: 50 },
    ],
  },
  {
    id: 3,
    title: "Complete QA testing of the 90Days app",
    progress: 45,
    category: "Product",
    keyResults: [
      { id: 31, title: "Define use cases for all functions", progress: 0 },
      { id: 32, title: "Execute testing for all defined cases", progress: 0 },
      { id: 33, title: "Log and triage all defects", progress: 40 },
    ],
  },
  {
    id: 4,
    title: "Finish and launch 90Days app",
    progress: 75,
    category: "Product",
    keyResults: [
      { id: 41, title: "Resolve remaining bugs before beta", progress: 10 },
      { id: 42, title: "Deliver a fully responsive UI", progress: 33 },
      { id: 43, title: "Prepare launch comms + docs", progress: 80 },
    ],
  },
];

const styles = `
:root {
  --strategy-bg: #f7f5ff;
  --strategy-surface: #ffffff;
  --strategy-primary: #6a4bff;
  --strategy-primary-soft: rgba(106, 75, 255, 0.08);
  --strategy-border-subtle: rgba(15, 23, 42, 0.06);
  --strategy-text-main: #0f172a;
  --strategy-text-muted: #64748b;
  --strategy-radius-lg: 24px;
  --strategy-radius-md: 16px;
  --strategy-shadow-soft: 0 14px 40px rgba(15, 23, 42, 0.08);
  --strategy-transition: 160ms ease-out;
}

.strategy-root {
  min-height: 100vh;
  padding: 32px 40px 40px;
  background: radial-gradient(circle at top left, #f0e9ff 0, #f7f5ff 48%, #f9fafb 100%);
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text",
    "Segoe UI", sans-serif;
  color: var(--strategy-text-main);
}

.strategy-nav {
  display: inline-flex;
  padding: 4px;
  background: var(--strategy-primary-soft);
  border-radius: 999px;
  margin: 0 auto 28px;
  box-shadow: 0 6px 24px rgba(88, 28, 135, 0.15);
}

.strategy-nav-pill {
  padding: 8px 20px;
  border-radius: 999px;
  font-size: 13px;
  cursor: pointer;
  color: var(--strategy-text-muted);
  transition: background var(--strategy-transition),
    color var(--strategy-transition), transform var(--strategy-transition);
  white-space: nowrap;
}

.strategy-nav-pill--active {
  background: #fff;
  color: var(--strategy-primary);
  font-weight: 600;
  transform: translateY(-1px);
}

/* split hero: vision / mission */

.strategy-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 0;
  padding: 0;
  border-radius: var(--strategy-radius-lg);
  border: 1px solid var(--strategy-border-subtle);
  box-shadow: var(--strategy-shadow-soft);
  background: rgba(255, 255, 255, 0.96);
  overflow: hidden;
  margin-bottom: 24px;
}

.strategy-hero-pane {
  padding: 24px 26px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.strategy-hero-pane + .strategy-hero-pane {
  border-left: 1px solid rgba(148, 163, 184, 0.24);
  background: radial-gradient(circle at top right, #f2ecff 0, #ffffff 60%);
}

.strategy-pill-tag {
  align-self: flex-start;
  padding: 4px 12px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.12);
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--strategy-text-muted);
}

.strategy-hero-title {
  font-size: 18px;
  line-height: 1.4;
  margin: 0;
  font-weight: 600;
}

/* metrics strip */

.strategy-hero-metrics {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 18px 0 24px;
}

.strategy-metric-card {
  padding: 12px 16px;
  border-radius: var(--strategy-radius-md);
  border: 1px solid rgba(148, 163, 184, 0.25);
  background: linear-gradient(145deg, #fdfbff, #f6f3ff);
  display: inline-flex;
  align-items: center;
  gap: 12px;
}

.strategy-metric-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--strategy-text-muted);
}

.strategy-metric-main {
  font-size: 18px;
  font-weight: 600;
}

.strategy-metric-caption {
  font-size: 11px;
  color: var(--strategy-text-muted);
}

.strategy-donut {
  width: 48px;
  height: 48px;
  border-radius: 999px;
  background:
    conic-gradient(
      var(--strategy-primary) calc(var(--donut-value, 60) * 1%),
      rgba(203, 213, 225, 0.8) 0
    );
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.strategy-donut-inner {
  width: 30px;
  height: 30px;
  border-radius: inherit;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
  color: var(--strategy-primary);
}

.strategy-metric-inline {
  display: flex;
  gap: 8px;
}

.strategy-metric-chip {
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.03);
  border: 1px solid rgba(148, 163, 184, 0.4);
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.strategy-metric-chip-label {
  font-size: 11px;
  color: var(--strategy-text-muted);
}

.strategy-metric-chip-value {
  font-size: 12px;
  font-weight: 600;
}

/* sections */

.strategy-section {
  margin-bottom: 24px;
}

.strategy-section-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 12px;
}

.strategy-section-header h2 {
  font-size: 16px;
  margin: 0;
}

.strategy-section-caption {
  font-size: 12px;
  color: var(--strategy-text-muted);
}

/* objectives grid */

.strategy-objective-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.strategy-objective-card {
  text-align: left;
  padding: 14px 14px 12px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.94);
  border: 1px solid transparent;
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.05);
}

.strategy-objective-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.strategy-objective-category {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.15);
  color: var(--strategy-text-muted);
}

.strategy-objective-progress-pill {
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(148, 163, 184, 0.6);
}

.strategy-objective-title {
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 8px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.strategy-progress-bar {
  position: relative;
  width: 100%;
  height: 6px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.25);
  overflow: hidden;
}

.strategy-progress-bar-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(
    90deg,
    var(--strategy-primary),
    #a855f7,
    #22c55e
  );
}

.strategy-objective-owner {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.strategy-objective-avatar {
  width: 20px;
  height: 20px;
  border-radius: 999px;
  background: linear-gradient(135deg, var(--strategy-primary), #a855f7);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 600;
  color: #ffffff;
}

/* key results as columns */

.strategy-kr-grid {
  display: grid;
  gap: 16px;
}

.strategy-kr-column {
  background: rgba(255, 255, 255, 0.96);
  border-radius: 18px;
  padding: 12px 12px 10px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.06);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.strategy-kr-column-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 4px;
}

.strategy-kr-column-title {
  font-size: 13px;
  font-weight: 600;
}

.strategy-kr-column-sub {
  font-size: 11px;
  color: var(--strategy-text-muted);
}

.strategy-kr-column-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.strategy-kr-card {
  padding: 8px 8px 6px;
  border-radius: 14px;
  background: rgba(249, 250, 251, 0.9);
  border: 1px solid rgba(148, 163, 184, 0.25);
}

.strategy-kr-title {
  font-size: 12px;
  font-weight: 500;
  margin-bottom: 4px;
}

.strategy-kr-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--strategy-text-muted);
}

.strategy-progress-bar--small {
  height: 4px;
}

@media (max-width: 1040px) {
  .strategy-root {
    padding: 20px;
  }

  .strategy-hero {
    grid-template-columns: minmax(0, 1fr);
  }

  .strategy-hero-pane + .strategy-hero-pane {
    border-left: none;
    border-top: 1px solid rgba(148, 163, 184, 0.24);
  }

  .strategy-objective-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .strategy-objective-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .strategy-nav {
    transform: scale(0.94);
  }

  .strategy-kr-grid {
    grid-template-columns: minmax(0, 1fr) !important;
  }
}
`;

export default function StrategyDashboardPreview() {
  const avgProgress =
    MOCK_OBJECTIVES.reduce((sum, o) => sum + o.progress, 0) /
    MOCK_OBJECTIVES.length;

  const totalKeyResults = MOCK_OBJECTIVES.reduce(
    (sum, o) => sum + o.keyResults.length,
    0
  );

  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = styles;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <div className="strategy-root">
      <header className="strategy-nav">
        <div className="strategy-nav-pill strategy-nav-pill--active">
          Strategy
        </div>
        <div className="strategy-nav-pill">Groups</div>
        <div className="strategy-nav-pill">Objectives</div>
      </header>

      {/* Split hero: Vision / Mission */}
      <section className="strategy-hero">
        <div className="strategy-hero-pane">
          <div className="strategy-pill-tag">Vision</div>
          <h1 className="strategy-hero-title">
            Create a class-leading environment that transforms knowledge into
            outstanding technology and services.
          </h1>
        </div>
        <div className="strategy-hero-pane">
          <div className="strategy-pill-tag">Mission</div>
          <h1 className="strategy-hero-title">
            Empower and reward individuals who passionately pursue perfection in
            harmony with teamwork and collaboration.
          </h1>
        </div>
      </section>

      {/* Metrics under hero */}
      <div className="strategy-hero-metrics">
        <div className="strategy-metric-card">
          <div className="strategy-donut">
            <div className="strategy-donut-inner">
              {Math.round(avgProgress)}%
            </div>
          </div>
          <div>
            <div className="strategy-metric-label">Overall progress</div>
            <div className="strategy-metric-main">
              {Math.round(avgProgress)}%
            </div>
            <div className="strategy-metric-caption">
              average strategic objective
            </div>
          </div>
        </div>

        <div className="strategy-metric-inline">
          <div className="strategy-metric-chip">
            <span className="strategy-metric-chip-label">Objectives</span>
            <span className="strategy-metric-chip-value">
              {MOCK_OBJECTIVES.length}
            </span>
          </div>
          <div className="strategy-metric-chip">
            <span className="strategy-metric-chip-label">Key Results</span>
            <span className="strategy-metric-chip-value">
              {totalKeyResults}
            </span>
          </div>
        </div>
      </div>

      {/* Strategic objectives */}
      <section className="strategy-section">
        <div className="strategy-section-header">
          <h2>Strategic objectives</h2>
          <span className="strategy-section-caption">
            High-level focus areas for this 90-day cycle.
          </span>
        </div>

        <div className="strategy-objective-grid">
          {MOCK_OBJECTIVES.map((o) => (
            <div key={o.id} className="strategy-objective-card">
              <div className="strategy-objective-header">
                <div className="strategy-objective-owner">
                  <div className="strategy-objective-avatar">
                    {o.category
                      .split(" ")
                      .map((w) => w[0])
                      .join("")
                      .slice(0, 2)}
                  </div>
                  <span className="strategy-objective-category">{o.category}</span>
                </div>
                <span className="strategy-objective-progress-pill">
                  {o.progress}%
                </span>
              </div>
              <div className="strategy-objective-title" title={o.title}>
                {o.title}
              </div>
              <div className="strategy-progress-bar">
                <div
                  className="strategy-progress-bar-fill"
                  style={{ width: `${o.progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Key results columns */}
      <section className="strategy-section">
        <div className="strategy-section-header">
          <h2>Key results by strategy</h2>
          <span className="strategy-section-caption">
            Each column tracks measurable outcomes under its strategic objective.
          </span>
        </div>

        <div
          className="strategy-kr-grid"
          style={{
            gridTemplateColumns: `repeat(${MOCK_OBJECTIVES.length}, minmax(0, 1fr))`,
          }}
        >
          {MOCK_OBJECTIVES.map((o) => (
            <div key={o.id} className="strategy-kr-column">
              <div className="strategy-kr-column-header">
                <div className="strategy-kr-column-title">{o.title}</div>
                <div className="strategy-kr-column-sub">
                  {o.keyResults.length} key result
                  {o.keyResults.length > 1 ? "s" : ""} · {o.progress}% overall
                </div>
              </div>
              <div className="strategy-kr-column-list">
                {o.keyResults.map((kr) => (
                  <div key={kr.id} className="strategy-kr-card">
                    <div className="strategy-kr-title">{kr.title}</div>
                    <div className="strategy-kr-meta">
                      <span>{kr.progress}%</span>
                      <div className="strategy-progress-bar strategy-progress-bar--small">
                        <div
                          className="strategy-progress-bar-fill"
                          style={{ width: `${kr.progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
