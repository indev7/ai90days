'use client';

import { useEffect, useRef, useState } from 'react';
import useMainTreeStore from '@/store/mainTreeStore';
import styles from './LoadingIndicators.module.css';

// Order matches the progressive loading sequence from the API
const SECTIONS = [
  { key: 'preferences', label: 'Preferences', shortLabel: 'Prefs' },
  { key: 'myOKRTs', label: 'My OKRTs', shortLabel: 'OKRTs' },
  { key: 'timeBlocks', label: 'Time Blocks', shortLabel: 'Time' },
  { key: 'notifications', label: 'Notifications', shortLabel: 'Notif' },
  { key: 'sharedOKRTs', label: 'Shared OKRTs', shortLabel: 'Shared' },
  { key: 'groups', label: 'Groups', shortLabel: 'Groups' },
  { key: 'calendar', label: 'Calendar', shortLabel: 'Cal' }
];

export default function LoadingIndicators({ compact = false }) {
  const sectionStates = useMainTreeStore((state) => state.sectionStates) || {};
  const llmActivity = useMainTreeStore((state) => state.llmActivity);
  const [showLabels, setShowLabels] = useState(false);
  const [scanIndex, setScanIndex] = useState(0);
  const scanDirectionRef = useRef(1);

  const isLLMActive = !!llmActivity?.active;

  useEffect(() => {
    if (!isLLMActive) {
      // Reset scanner when LLM activity stops
      setScanIndex(0);
      scanDirectionRef.current = 1;
      return;
    }

    // Knight Rider style sweep across LEDs during LLM calls
    const interval = setInterval(() => {
      setScanIndex((current) => {
        let next = current + scanDirectionRef.current;

        if (next >= SECTIONS.length || next < 0) {
          scanDirectionRef.current = -scanDirectionRef.current;
          next = current + scanDirectionRef.current;
        }

        return next;
      });
    }, 140);

    return () => clearInterval(interval);
  }, [isLLMActive]);

  // Get LED state for a section
  const getLEDState = (section) => {
    const state = sectionStates[section];
    if (!state) return 'idle';
    if (state.loading) return 'loading';
    if (state.loaded) return 'loaded';
    return 'idle';
  };

  return (
    <div 
      className={`${styles.container} ${compact ? styles.compact : ''}`}
      onMouseEnter={() => setShowLabels(true)}
      onMouseLeave={() => setShowLabels(false)}
    >
      <div className={styles.indicators}>
        {SECTIONS.map((section, idx) => {
          const ledState = isLLMActive ? 'llmSweep' : getLEDState(section.key);

          // Set brightness levels for Knight Rider sweep
          let brightness = 0.4;
          if (isLLMActive) {
            const distance = Math.abs(idx - scanIndex);
            if (distance === 0) brightness = 1;
            else if (distance === 1) brightness = 0.8;
            else if (distance === 2) brightness = 0.6;
          }

          return (
            <div 
              key={section.key} 
              className={styles.indicatorWrapper}
              title={section.label}
            >
              <div 
                className={`${styles.led} ${styles[ledState]}`}
                style={isLLMActive ? { '--llmBrightness': brightness } : undefined}
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
