"use client";
import React, { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import useMainTreeStore from '@/store/mainTreeStore';
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
  const mainTree = useMainTreeStore((state) => state.mainTree);
  const router = useRouter();

  // Handle click on objective or KR card
  const handleCardClick = (objectiveId) => {
    if (objectiveId) {
      router.push(`/shared/${objectiveId}`);
    }
  };

  // Find the first Organisation type group and extract strategy data
  const strategyData = useMemo(() => {
    if (!mainTree || !mainTree.groups || mainTree.groups.length === 0) {
      return {
        groupName: '',
        vision: 'No organisation group found',
        mission: 'Please create an Organisation type group to define your strategy',
        strategies: []
      };
    }

    // Find first Organisation type group
    const orgGroup = mainTree.groups.find(g => g.type === 'Organisation');
    
    if (!orgGroup) {
      return {
        groupName: '',
        vision: 'No organisation group found',
        mission: 'Please create an Organisation type group to define your strategy',
        strategies: []
      };
    }

    // Get strategic objectives from the organisation group
    const strategicObjectiveIds = orgGroup.strategicObjectiveIds || [];
    
    if (strategicObjectiveIds.length === 0) {
      return {
        groupName: orgGroup.name || '',
        vision: orgGroup.vision || 'Define your organisation vision',
        mission: orgGroup.mission || 'Define your organisation mission',
        strategies: []
      };
    }

    // Combine myOKRTs and sharedOKRTs to find strategic objectives
    const allOKRTs = [...(mainTree.myOKRTs || []), ...(mainTree.sharedOKRTs || [])];
    
    // Build strategies array with objectives and their KRs
    const strategies = strategicObjectiveIds.map(objId => {
      const objective = allOKRTs.find(okrt => okrt.id === objId);
      
      if (!objective) {
        return null;
      }

      // Find KRs for this objective from both myOKRTs and sharedOKRTs
      // Type is 'K' (KeyResult) - only Key Results are loaded for shared objectives
      const keyResults = allOKRTs
        .filter(okrt => {
          const isChild = okrt.parent_id === objId;
          const isKR = okrt.type === 'K' || okrt.type === 'KeyResult';
          return isChild && isKR;
        })
        .map(kr => ({
          id: kr.id,
          name: kr.description || kr.title,
          progress: Math.round(kr.progress || 0)
        }));

      return {
        id: objective.id,
        name: objective.title,
        progress: Math.round(objective.progress || 0),
        initiatives: keyResults
      };
    }).filter(Boolean); // Remove null entries

    return {
      groupName: orgGroup.name || '',
      vision: orgGroup.vision || 'Define your organisation vision',
      mission: orgGroup.mission || 'Define your organisation mission',
      strategies
    };
  }, [mainTree]);

  const { groupName, vision, mission, strategies } = strategyData;

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
          <div className={styles.visionTitle}>{groupName ? `${groupName} Vision & Mission` : 'Vision & Mission'}</div>
          <div className={styles.visionText}>
            {vision}
          </div>
          <div className={styles.missionText}>
            {mission}
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
                <div
                  className={styles.strategyCard}
                  onClick={() => handleCardClick(s.id)}
                >
                  <div className={styles.strategyNameRow}>
                    <div className={styles.strategyName}>{s.name}</div>
                    <div className={styles.strategyProgress}>{s.progress}%</div>
                  </div>
                </div>
                {s.initiatives.map((i) => (
                  <div
                    key={i.id}
                    className={styles.initiativeCard}
                    onClick={() => handleCardClick(s.id)}
                  >
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