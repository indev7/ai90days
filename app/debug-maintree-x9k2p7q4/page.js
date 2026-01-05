'use client';

import { useEffect, useState } from 'react';
import useMainTreeStore from '@/store/mainTreeStore';
import styles from './page.module.css';

export default function DebugMainTreePage() {
  const { mainTree, lastUpdated, isLoading } = useMainTreeStore();
  const [expandedSections, setExpandedSections] = useState({
    myOKRTs: true,
    sharedOKRTs: true,
    calendar: true,
    notifications: true,
    timeBlocks: true,
    groups: true
  });

  const refreshFromStore = () => {
    // Force a re-render by updating state
    setExpandedSections({ ...expandedSections });
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const renderJSON = (data, depth = 0) => {
    if (data === null) return <span className={styles.null}>null</span>;
    if (data === undefined) return <span className={styles.undefined}>undefined</span>;
    
    if (typeof data === 'string') {
      return <span className={styles.string}>"{data}"</span>;
    }
    
    if (typeof data === 'number') {
      return <span className={styles.number}>{data}</span>;
    }
    
    if (typeof data === 'boolean') {
      return <span className={styles.boolean}>{data.toString()}</span>;
    }
    
    if (Array.isArray(data)) {
      if (data.length === 0) return <span className={styles.array}>[]</span>;
      
      return (
        <div className={styles.array}>
          <span>[</span>
          <div className={styles.indent}>
            {data.map((item, index) => (
              <div key={index} className={styles.arrayItem}>
                {renderJSON(item, depth + 1)}
                {index < data.length - 1 && ','}
              </div>
            ))}
          </div>
          <span>]</span>
        </div>
      );
    }
    
    if (typeof data === 'object') {
      const keys = Object.keys(data);
      if (keys.length === 0) return <span className={styles.object}>{'{}'}</span>;
      
      return (
        <div className={styles.object}>
          <span>{'{'}</span>
          <div className={styles.indent}>
            {keys.map((key, index) => (
              <div key={key} className={styles.objectItem}>
                <span className={styles.key}>"{key}"</span>: {renderJSON(data[key], depth + 1)}
                {index < keys.length - 1 && ','}
              </div>
            ))}
          </div>
          <span>{'}'}</span>
        </div>
      );
    }
    
    return <span>{String(data)}</span>;
  };

  if (isLoading) {
    return (
      <div className={`app-page ${styles.container}`}>
        <div className="app-pageContent app-pageContent--full">
          <div className={styles.loading}>Loading mainTree from store...</div>
        </div>
      </div>
    );
  }

  if (!mainTree) {
    return (
      <div className={`app-page ${styles.container}`}>
        <div className="app-pageContent app-pageContent--full">
          <div className={styles.error}>
            <h2>No MainTree Data</h2>
            <p>The Zustand store does not contain any mainTree data yet.</p>
            <p>Navigate to another page to load the data, then return here.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`app-page ${styles.container}`}>
      <div className="app-pageContent app-pageContent--full">
        <div className={styles.header}>
          <h1>🐛 MainTree Debug Viewer (Zustand Store)</h1>
          <div className={styles.headerInfo}>
            {lastUpdated && (
              <span className={styles.lastUpdated}>
                Last Updated: {new Date(lastUpdated).toLocaleString()}
              </span>
            )}
            <button onClick={refreshFromStore} className={styles.refreshButton}>
              🔄 Refresh View
            </button>
          </div>
        </div>

      {mainTree && (
        <div className={styles.content}>
          <div className={styles.summary}>
            <h2>Summary</h2>
            <div className={styles.stats}>
              <div className={styles.stat}>
                <span className={styles.statLabel}>My OKRTs:</span>
                <span className={styles.statValue}>{mainTree.myOKRTs?.length || 0}</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statLabel}>Shared OKRTs:</span>
                <span className={styles.statValue}>{mainTree.sharedOKRTs?.length || 0}</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statLabel}>Calendar Events:</span>
                <span className={styles.statValue}>{mainTree.calendar?.events?.length || 0}</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statLabel}>Notifications:</span>
                <span className={styles.statValue}>{mainTree.notifications?.length || 0}</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statLabel}>Time Blocks:</span>
                <span className={styles.statValue}>{mainTree.timeBlocks?.length || 0}</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statLabel}>Groups:</span>
                <span className={styles.statValue}>{mainTree.groups?.length || 0}</span>
              </div>
            </div>
          </div>

          {Object.keys(expandedSections).map(section => (
            <div key={section} className={styles.section}>
              <div 
                className={styles.sectionHeader}
                onClick={() => toggleSection(section)}
              >
                <span className={styles.toggle}>
                  {expandedSections[section] ? '▼' : '▶'}
                </span>
                <h3>{section}</h3>
                <span className={styles.count}>
                  ({Array.isArray(mainTree[section]) 
                    ? mainTree[section].length 
                    : section === 'calendar' 
                      ? mainTree[section]?.events?.length || 0
                      : 'object'})
                </span>
              </div>
              
              {expandedSections[section] && (
                <div className={styles.sectionContent}>
                  {renderJSON(mainTree[section])}
                </div>
              )}
            </div>
          ))}

          <div className={styles.rawJson}>
            <h3>Raw JSON</h3>
            <pre>{JSON.stringify(mainTree, null, 2)}</pre>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
