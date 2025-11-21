"use client";
import React from 'react';
import styles from './page.module.css';

/**
 * StrategyHouse Component
 * Displays the strategy pantheon with vision/mission and strategic initiatives
 *
 * ANCHOR SYSTEM:
 * - Invisible anchor points in the SVG define where text boxes should attach
 * - Vision/Mission box anchors to top center (x=50%, y=15% from viewBox)
 * - Strategy pillar boxes anchor to positions above each column (y=33.33%)
 * - Positions calculated dynamically based on number of strategies
 * - HTML components positioned using CSS variables passed from anchor calculations
 */
export default function StrategyHouse() {
  // Placeholder data - will be replaced dynamically later
  const strategies = [
    {
      id: 's1',
      name: 'Launch 90Days product',
      progress: 60,
      initiatives: [
        { id: 'i11', name: 'Ship core OKRT UI', progress: 45 },
        { id: 'i12', name: 'Deploy web & infra', progress: 30 }
      ]
    },
    {
      id: 's2',
      name: 'Raise product quality',
      progress: 42,
      initiatives: [
        { id: 'i21', name: 'Complete QA testing', progress: 55 },
        { id: 'i22', name: 'Fix all launch bugs', progress: 38 }
      ]
    },
    {
      id: 's3',
      name: 'Drive adoption & coaching',
      progress: 28,
      initiatives: [
        { id: 'i31', name: 'AI Coach beta rollout', progress: 20 },
        { id: 'i32', name: 'Onboarding journeys', progress: 16 }
      ]
    },
    {
      id: 's4',
      name: 'Scale org-wide alignment',
      progress: 35,
      initiatives: [
        { id: 'i41', name: 'Org OKRT workshops', progress: 40 },
        { id: 'i42', name: 'Quarterly review ritual', progress: 10 }
      ]
    }
  ];

  // Calculate anchor points (invisible markers for positioning)
  const visionAnchor = { x: 50, y: 11 }; // SVG coordinates: center top
  const missionBandY = 20; // Y position in SVG viewBox
  
  // Calculate strategy anchor points dynamically based on number of pillars
  const strategyAnchors = strategies.map((_, i) => {
    const colWidth = 90 / strategies.length;
    const centerX = 5 + i * colWidth + colWidth / 2;
    return { x: centerX, y: missionBandY };
  });

  return (
    <div className={styles.strategyPantheon}>
      <svg className={styles.templeSvg} viewBox="0 1 100 59" preserveAspectRatio="xMidYMid meet">
        {/* Roof */}
        <polygon
          points="0,20 50,3 100,20"
          fill="var(--strategy-temple-roof)"
          stroke="var(--strategy-temple-stroke)"
          strokeWidth="0.3"
        />
        
        {/* Invisible anchor point for vision/mission (like HTML anchor) */}
        <circle
          id="visionAnchor"
          cx={visionAnchor.x}
          cy={visionAnchor.y}
          r="0.01"
          fill="transparent"
          opacity="0"
        />
        
        {/* Mission band */}
        <rect
          x="0"
          y="21"
          width="100"
          height="2"
          fill="var(--strategy-temple-band)"
          stroke="var(--strategy-temple-stroke)"
          strokeWidth="0.3"
        />
        
        {/* Columns with invisible anchor points */}
        {strategies.map((s, i) => {
          const colWidth = 90 / strategies.length;
          const x = 5 + i * colWidth + colWidth * 0.23;
          const width = colWidth * 0.54;
          const anchor = strategyAnchors[i];
          
          return (
            <g key={s.id}>
              {/* Invisible anchor point for this strategy column */}
              <circle
                id={`strategyAnchor${i}`}
                cx={anchor.x}
                cy={anchor.y}
                r="0.01"
                fill="transparent"
                opacity="0"
              />
              
              <rect
                x={x}
                y="23"
                width={width}
                height="35"
                fill="var(--strategy-temple-column)"
                stroke="var(--strategy-temple-stroke-light)"
                strokeWidth="0.4"
                rx="1"
                opacity="0"
              />
            </g>
          );
        })}
        
        {/* Base line */}
        <line
          x1="5"
          y1="59"
          x2="95"
          y2="59"
          stroke="var(--strategy-temple-stroke)"
          strokeWidth="0.6"
        />
      </svg>

      <div className={styles.contentOverlay}>
        {/* Vision/Mission box anchored to invisible anchor point */}
        <div
          className={styles.visionMission}
          style={{
            '--anchor-x': `${visionAnchor.x}%`,
            '--anchor-y': `${(visionAnchor.y / 60) * 100}%`
          }}
        >
          <div className={styles.visionTitle}>Vision &amp; Mission</div>
          <div className={styles.visionText}>
            Empower every team to achieve meaningful 90-day outcomes.
          </div>
          <div className={styles.missionText}>
            We connect strategy to everyday work, so everyone can see how their initiatives support the bigger picture.
          </div>
        </div>

        {/* Strategies grid with dynamic columns based on number of pillars */}
        <div
          className={styles.strategiesGrid}
          style={{
            gridTemplateColumns: `repeat(${strategies.length}, minmax(0, 1fr))`
          }}
        >
          {strategies.map((s, i) => {
            const anchor = strategyAnchors[i];
            return (
              <div
                key={s.id}
                className={styles.strategyColumn}
                style={{
                  '--anchor-x': `${anchor.x}%`,
                  '--anchor-y': `${(anchor.y / 60) * 100}%`
                }}
              >
                <div className={styles.strategyCard}>
                  <div className={styles.strategyNameRow}>
                    <div className={styles.strategyName}>{s.name}</div>
                    <div className={styles.strategyProgress}>{s.progress}%</div>
                  </div>
                </div>
                {s.initiatives.map((i) => (
                  <div key={i.id} className={styles.initiativeCard}>
                    <div className={styles.initiativeName}>{i.name}</div>
                    <div className={styles.initiativeProgress}>{i.progress}%</div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}