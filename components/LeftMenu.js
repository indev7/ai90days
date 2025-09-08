'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useObjective } from '@/contexts/ObjectiveContext';

import styles from './LeftMenu.module.css';

const topMenuItems = [
  { href: '/dashboard', label: 'Dashboard', icon: 'profile' },
  { href: '/okrt', label: 'My Goals', icon: 'goals' },
  { href: '/shared', label: 'Shared Goals', icon: 'shared', disabled: true },
  { href: '/new', label: '+ New Objective', icon: 'new', disabled: false },
];

const bottomMenuItems = [
  { href: '/coach', label: 'Coach', icon: 'coach', disabled: false },
  { href: '/notifications', label: 'Notifications', icon: 'notifications', disabled: true },
];

function getIcon(iconName) {
  const icons = {
    profile: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
        <polyline points="16 7 22 7 22 13" />
      </svg>
    ),
    goals: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" />
        <path d="M7 7l10 10" />
        <path d="M14 7l3 0l0 3" />
      </svg>
    ),
    shared: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="8" r="6" />
        <circle cx="12" cy="8" r="3" />
        <circle cx="12" cy="8" r="1" />
        <path d="M14 6l4-2" />
        <path d="M18 4l-1 1" />
        <circle cx="6" cy="18" r="2" />
        <circle cx="12" cy="18" r="2" />
        <circle cx="18" cy="18" r="2" />
        <path d="M6 16v-1" />
        <path d="M12 16v-1" />
        <path d="M18 16v-1" />
      </svg>
    ),
    new: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </svg>
    ),
    coach: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
    notifications: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
    settings: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  };
  return icons[iconName] || null;
}

/**
 * @typedef {Object} LeftMenuProps
 * @property {boolean} [isCollapsed] - Whether the menu is in collapsed state (tablet portrait)
 * @property {function} [onToggle] - Toggle handler for collapsed state
 */

/**
 * Left navigation menu for tablet/desktop
 * @param {LeftMenuProps} props
 */
export default function LeftMenu({ isCollapsed = false, onToggle }) {
  const pathname = usePathname();
  const { selectedObjectiveId, setSelectedObjectiveId } = useObjective();
  const [isGoalsExpanded, setIsGoalsExpanded] = useState(false);
  const [objectives, setObjectives] = useState([]);
  const [loading, setLoading] = useState(false);

  // Auto-expand goals if we're on the okrt page, collapse if not
  useEffect(() => {
    if (pathname === '/okrt') {
      setIsGoalsExpanded(true);
    } else {
      setIsGoalsExpanded(false);
    }
  }, [pathname]);

  // Fetch objectives when component mounts
  useEffect(() => {
    const fetchObjectives = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/okrt');
        if (response.ok) {
          const data = await response.json();
          // Filter only objectives (type 'O') that have no parent (top-level objectives)
          const topLevelObjectives = data.okrts.filter(item => 
            item.type === 'O' && !item.parent_id
          );
          setObjectives(topLevelObjectives);
        }
      } catch (error) {
        console.error('Error fetching objectives:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchObjectives();
  }, []);

  const handleGoalsClick = (e) => {
    // Only allow manual expansion/collapse when on the okrt page
    if (pathname === '/okrt') {
      setIsGoalsExpanded(!isGoalsExpanded);
    }
  };

  return (
    <nav className={`${styles.leftMenu} ${isCollapsed ? styles.collapsed : ''}`}>
      <div className={styles.menuContent}>
        <ul className={styles.menuList}>
          {topMenuItems.map((item) => {
            const isActive = pathname === item.href;
            const isDisabled = item.disabled;

            // Special handling for "My Goals" item
            if (item.href === '/okrt') {
              return (
                <li key={item.href} className={styles.menuItem}>
                  <div>
                    <Link
                      href={item.href}
                      onClick={handleGoalsClick}
                      className={`${styles.menuLink} ${isActive ? styles.active : ''}`}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <span className={styles.icon}>
                        {getIcon(item.icon)}
                      </span>
                      <span className={styles.label}>{item.label}</span>
                    </Link>
                    
                    {/* Expandable objectives list */}
                    {isGoalsExpanded && (
                      <ul className={styles.subMenuList}>
                        {loading ? (
                          <li className={styles.subMenuItem}>
                            <span className={styles.subMenuLink}>
                              <span className={styles.subMenuLabel}>Loading...</span>
                            </span>
                          </li>
                        ) : objectives.length > 0 ? (
                          objectives.map((objective) => (
                            <li key={objective.id} className={styles.subMenuItem}>
                              <button
                                onClick={() => {
                                  setSelectedObjectiveId(objective.id);
                                  // Navigate to okrt page if not already there
                                  if (pathname !== '/okrt') {
                                    window.location.href = '/okrt';
                                  }
                                }}
                                className={`${styles.subMenuLink} ${selectedObjectiveId === objective.id ? styles.active : ''}`}
                              >
                                <span className={styles.subMenuLabel} title={objective.title}>
                                  {objective.title}
                                </span>
                              </button>
                            </li>
                          ))
                        ) : (
                          <li className={styles.subMenuItem}>
                            <span className={styles.subMenuLink}>
                              <span className={styles.subMenuLabel}>No objectives yet</span>
                            </span>
                          </li>
                        )}
                      </ul>
                    )}
                  </div>
                </li>
              );
            }

            return (
              <li key={item.href} className={styles.menuItem}>
                {isDisabled ? (
                  <span 
                    className={`${styles.menuLink} ${styles.disabled}`}
                    title={`${item.label} (Coming Soon)`}
                  >
                    <span className={styles.icon}>
                      {getIcon(item.icon)}
                    </span>
                    <span className={styles.label}>{item.label}</span>
                  </span>
                ) : (
                  <Link
                    href={item.href}
                    className={`${styles.menuLink} ${isActive ? styles.active : ''}`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <span className={styles.icon}>
                      {getIcon(item.icon)}
                    </span>
                    <span className={styles.label}>{item.label}</span>
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      
      <div className={styles.bottomMenu}>
        <ul className={styles.menuList}>
          {bottomMenuItems.map((item) => {
            const isActive = pathname === item.href;
            const isDisabled = item.disabled;

            return (
              <li key={item.href} className={styles.menuItem}>
                {isDisabled ? (
                  <span 
                    className={`${styles.menuLink} ${styles.disabled}`}
                    title={`${item.label} (Coming Soon)`}
                  >
                    <span className={styles.icon}>
                      {getIcon(item.icon)}
                    </span>
                    <span className={styles.label}>{item.label}</span>
                  </span>
                ) : (
                  <Link
                    href={item.href}
                    className={`${styles.menuLink} ${isActive ? styles.active : ''}`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <span className={styles.icon}>
                      {getIcon(item.icon)}
                    </span>
                    <span className={styles.label}>{item.label}</span>
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      
      {/* Toggle button for tablet portrait */}
      {onToggle && (
        <button
          className={styles.toggleButton}
          onClick={onToggle}
          aria-label={isCollapsed ? "Expand menu" : "Collapse menu"}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d={isCollapsed ? "M9 18l6-6-6-6" : "M15 18l-6-6 6-6"} />
          </svg>
        </button>
      )}
    </nav>
  );
}
