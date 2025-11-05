'use client';

import { useEffect, useState } from 'react';
import useMainTreeStore from '@/store/mainTreeStore';
import styles from './LoadingIndicators.module.css';

// Order matches the progressive loading sequence from the API
const SECTIONS = [
  { key: 'myOKRTs', label: 'My OKRTs', shortLabel: 'OKRTs' },
  { key: 'timeBlocks', label: 'Time Blocks', shortLabel: 'Time' },
  { key: 'notifications', label: 'Notifications', shortLabel: 'Notif' },
  { key: 'sharedOKRTs', label: 'Shared OKRTs', shortLabel: 'Shared' },
  { key: 'groups', label: 'Groups', shortLabel: 'Groups' },
  { key: 'calendar', label: 'Calendar', shortLabel: 'Cal' }
];

export default function LoadingIndicators() {
  const sectionStates = useMainTreeStore((state) => state.sectionStates);
  const [showLabels, setShowLabels] = useState(false);

  // Get LED state for a section
  const getLEDState = (section) => {
    const state = sectionStates[section];
    if (state.loading) return 'loading';
    if (state.loaded) return 'loaded';
    return 'idle';
  };

  return (
    <div 
      className={styles.container}
      onMouseEnter={() => setShowLabels(true)}
      onMouseLeave={() => setShowLabels(false)}
    >
      <div className={styles.indicators}>
        {SECTIONS.map((section) => {
          const ledState = getLEDState(section.key);
          return (
            <div 
              key={section.key} 
              className={styles.indicatorWrapper}
              title={section.label}
            >
              <div 
                className={`${styles.led} ${styles[ledState]}`}
                aria-label={`${section.label}: ${ledState}`}
              >
                <div className={styles.ledGlow}></div>
              </div>
              {showLabels && (
                <span className={styles.label}>{section.shortLabel}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}