'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { AiOutlineDashboard } from 'react-icons/ai';
import { GoGoal } from 'react-icons/go';
import { RiUserSharedLine } from 'react-icons/ri';
import { ImTree } from 'react-icons/im';
import { IoMdNotificationsOutline } from 'react-icons/io';
import { IoChatboxEllipsesOutline } from 'react-icons/io5';
import { IoAdd } from 'react-icons/io5';

import styles from './LeftMenu.module.css';

const topMenuItems = [
  { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { href: '/okrt', label: 'My Goals', icon: 'goals' },
  { href: '/shared', label: 'Shared Goals', icon: 'shared', disabled: true },
  { href: '/groups', label: 'Groups', icon: 'groups', disabled: true },
  { href: '/new', label: 'New', icon: 'new', isAction: true },
];

const bottomMenuItems = [
  { href: '/coach', label: 'Coach', icon: 'coach', disabled: false },
  { href: '/notifications', label: 'Notifications', icon: 'notifications', disabled: true },
];

function getIcon(iconName, isCollapsed = false) {
  const iconSize = isCollapsed ? 24 : 20;
  const icons = {
    dashboard: <AiOutlineDashboard size={iconSize} />,
    goals: <GoGoal size={iconSize} />,
    shared: <RiUserSharedLine size={iconSize} />,
    groups: <ImTree size={iconSize} />,
    new: <IoAdd size={iconSize} />,
    coach: <IoChatboxEllipsesOutline size={iconSize} />,
    notifications: <IoMdNotificationsOutline size={iconSize} />,
  };
  return icons[iconName] || null;
}

/**
 * @typedef {Object} LeftMenuProps
 * @property {boolean} [isCollapsed] - Whether the menu is in collapsed state
 * @property {function} [onToggle] - Toggle handler for collapsed state
 * @property {boolean} [isDesktopCollapsed] - Whether desktop menu is in icon-only mode
 */

/**
 * Left navigation menu for tablet/desktop
 * @param {LeftMenuProps} props
 */
export default function LeftMenu({ isCollapsed = false, onToggle, isDesktopCollapsed = false }) {
  const pathname = usePathname();

  const handleNewClick = () => {
    // Dispatch a custom event that the My Goals page can listen to
    if (pathname === '/okrt') {
      window.dispatchEvent(new CustomEvent('createObjective'));
    }
  };

  return (
    <nav className={`${styles.leftMenu} ${isCollapsed ? styles.collapsed : ''} ${isDesktopCollapsed ? styles.desktopCollapsed : ''}`}>
      <div className={styles.menuContent}>
        <ul className={styles.menuList}>
          {topMenuItems.map((item) => {
            const isActive = pathname === item.href;
            const isDisabled = item.disabled;
            const isAction = item.isAction;

            return (
              <li key={item.href} className={styles.menuItem}>
                {isDisabled ? (
                  <span
                    className={`${styles.menuLink} ${styles.disabled}`}
                    title={`${item.label} (Coming Soon)`}
                  >
                    <span className={styles.icon}>
                      {getIcon(item.icon, isDesktopCollapsed)}
                    </span>
                    <span className={styles.label}>{item.label}</span>
                  </span>
                ) : isAction ? (
                  <button
                    className={styles.menuLink}
                    onClick={handleNewClick}
                    title="Create New Objective"
                    disabled={pathname !== '/okrt'}
                  >
                    <span className={styles.icon}>
                      {getIcon(item.icon, isDesktopCollapsed)}
                    </span>
                    <span className={styles.label}>{item.label}</span>
                  </button>
                ) : (
                  <Link
                    href={item.href}
                    className={`${styles.menuLink} ${isActive ? styles.active : ''}`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <span className={styles.icon}>
                      {getIcon(item.icon, isDesktopCollapsed)}
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
                      {getIcon(item.icon, isDesktopCollapsed)}
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
                      {getIcon(item.icon, isDesktopCollapsed)}
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
