'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';

import { LuLayoutDashboard } from "react-icons/lu";
import { GoClock } from "react-icons/go";

import { MdOutlineSelfImprovement } from "react-icons/md";
import { SiSlideshare } from "react-icons/si";
import { RiOrganizationChart } from "react-icons/ri";

import { IoMdNotificationsOutline } from 'react-icons/io';
import { IoChatboxEllipsesOutline } from 'react-icons/io5';
import { IoAdd } from 'react-icons/io5';
import { RiCalendarScheduleLine } from "react-icons/ri";

import styles from './LeftMenu.module.css';

const topMenuItems = [
  { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  {
    href: '/okrt',
    label: 'My OKRs',
    icon: 'goals',
    children: [
      { href: '/new', label: 'Add OKR', icon: 'new', isAction: true }
    ] // Will be populated with objectives dynamically
  },
  { href: '/calendar', label: 'Calendar', icon: 'calendar', disabled: false },
  { href: '/shared', label: 'Shared OKRs', icon: 'shared', disabled: false },
  {
    href: '/groups',
    label: 'Group OKRs',
    icon: 'groups',
    disabled: false,
    children: [
      { href: '/groups/create', label: 'Add Group', icon: 'new' }
    ]
  },
];

const bottomMenuItems = [
  { href: '/coach', label: 'Coach', icon: 'coach', disabled: false },
  { href: '/notifications', label: 'Notifications', icon: 'notifications', disabled: false },
];

function getIcon(iconName, isCollapsed = false, unreadCount = 0) {
  const iconSize = isCollapsed ? 24 : 20;
  const icons = {
    dashboard: <GoClock  size={iconSize} />,
    goals: <MdOutlineSelfImprovement size={iconSize} />,
    calendar: <RiCalendarScheduleLine size={iconSize} />,
    shared: <SiSlideshare size={iconSize} />,
    groups: <RiOrganizationChart size={iconSize} />,
    new: <IoAdd size={iconSize} />,
    coach: <IoChatboxEllipsesOutline size={iconSize} />,
    notifications: (
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <IoMdNotificationsOutline size={iconSize} />
        {unreadCount > 0 && (
          <span className={styles.notificationBadge}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </div>
    ),
  };
  return icons[iconName] || null;
}

/**
 * @typedef {Object} LeftMenuProps
 * @property {boolean} [isCollapsed] - Whether the menu is in collapsed state
 * @property {function} [onToggle] - Toggle handler for collapsed state
 * @property {boolean} [isDesktopCollapsed] - Whether desktop menu is in icon-only mode
 * @property {boolean} [isMobileSlideIn] - Whether menu is in mobile slide-in mode
 * @property {function} [onMobileClose] - Handler for closing mobile slide-in menu
 */

/**
 * Left navigation menu for tablet/desktop
 * @param {LeftMenuProps} props
 */
export default function LeftMenu({ 
  isCollapsed = false, 
  onToggle, 
  isDesktopCollapsed = false, 
  isMobileSlideIn = false,
  onMobileClose 
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [expandedItems, setExpandedItems] = useState(new Set());
  const [adminGroups, setAdminGroups] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [objectives, setObjectives] = useState([]);

  // Fetch admin groups, objectives, and setup notifications on component mount
  useEffect(() => {
    const fetchAdminGroups = async () => {
      try {
        const response = await fetch('/api/groups/admin');
        if (response.ok) {
          const data = await response.json();
          setAdminGroups(data.groups || []);
        }
      } catch (error) {
        console.error('Error fetching admin groups:', error);
      }
    };

    const fetchObjectives = async () => {
      try {
        const response = await fetch('/api/okrt');
        if (response.ok) {
          const data = await response.json();
          const allItems = data.okrts || [];
          const objs = allItems.filter(item => item.type === 'O');
          setObjectives(objs);
        }
      } catch (error) {
        console.error('Error fetching objectives:', error);
      }
    };

    const fetchUnreadCount = async () => {
      try {
        const response = await fetch('/api/notifications?count=true');
        if (response.ok) {
          const data = await response.json();
          setUnreadCount(data.count || 0);
        }
      } catch (error) {
        console.error('Error fetching unread count:', error);
      }
    };

    const setupSSE = () => {
      const eventSource = new EventSource('/api/notifications/sse');
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'unread_count') {
            setUnreadCount(data.count);
          }
        } catch (error) {
          console.error('Error parsing SSE data:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        eventSource.close();
        // Retry connection after 5 seconds
        setTimeout(setupSSE, 5000);
      };

      return eventSource;
    };

    fetchAdminGroups();
    fetchObjectives();
    fetchUnreadCount();
    const eventSource = setupSSE();

    // Listen for focus mode events
    const handleEnterFocusMode = () => {
      setIsFocusMode(true);
    };

    const handleExitFocusMode = () => {
      setIsFocusMode(false);
    };

    window.addEventListener('enterFocusMode', handleEnterFocusMode);
    window.addEventListener('exitFocusMode', handleExitFocusMode);

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      window.removeEventListener('enterFocusMode', handleEnterFocusMode);
      window.removeEventListener('exitFocusMode', handleExitFocusMode);
    };
  }, []);

  const handleNewClick = () => {
    // Close all expanded items when clicking New
    setExpandedItems(new Set());
    // Dispatch a custom event that the My Goals page can listen to
    if (pathname === '/okrt') {
      window.dispatchEvent(new CustomEvent('createObjective'));
    }
    
    // Close mobile menu
    if (isMobileSlideIn && onMobileClose) {
      onMobileClose();
    }
  };

  const handleAddGroupClick = (e) => {
    e.preventDefault();
    // Always dispatch the event to show modal
    if (pathname === '/groups') {
      window.dispatchEvent(new CustomEvent('createGroup'));
    } else {
      // Navigate to groups page and show modal after navigation
      router.push('/groups?showAddModal=true');
    }
    
    // Close mobile menu
    if (isMobileSlideIn && onMobileClose) {
      onMobileClose();
    }
  };

  const handleGroupEditClick = (groupId, e) => {
    e.preventDefault();
    // Navigate to groups page with edit mode for specific group
    if (pathname === '/groups') {
      window.dispatchEvent(new CustomEvent('editGroup', { detail: { groupId } }));
    } else {
      router.push(`/groups?editGroup=${groupId}`);
    }
    
    // Close mobile menu
    if (isMobileSlideIn && onMobileClose) {
      onMobileClose();
    }
  };

  const handleObjectiveClick = (objectiveId, e) => {
    e.preventDefault();
    // Navigate to OKRT page with specific objective
    router.push(`/okrt?objective=${objectiveId}`);
    
    // Close mobile menu
    if (isMobileSlideIn && onMobileClose) {
      onMobileClose();
    }
  };

  const isChildActive = (item) => {
    if (!item.children) return false;
    return item.children.some(child => pathname === child.href);
  };

  const toggleExpanded = (itemHref) => {
    setExpandedItems(prev => {
      const newSet = new Set();
      if (!prev.has(itemHref)) {
        newSet.add(itemHref);
      }
      return newSet;
    });
  };

    const handleMenuItemClick = (href, hasChildren) => {
    if (hasChildren && !isDesktopCollapsed && !isCollapsed) {
      handleItemToggle(href);
    }
    
    // Close mobile menu when navigating
    if (isMobileSlideIn && onMobileClose) {
      onMobileClose();
    }
  };

  const isExpanded = (itemHref) => {
    // Auto-expand Groups submenu when on groups page
    if (itemHref === '/groups' && pathname === '/groups') {
      return true;
    }
    // Auto-expand My Goals submenu when on OKRT page
    if (itemHref === '/okrt' && pathname === '/okrt') {
      return true;
    }
    return expandedItems.has(itemHref);
  };

  // Handle mobile slide-in overlay click
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && onMobileClose) {
      onMobileClose();
    }
  };

  const menuContent = (
    <nav className={`${styles.leftMenu} ${isCollapsed && !isMobileSlideIn ? styles.collapsed : ''} ${isDesktopCollapsed || isFocusMode ? styles.desktopCollapsed : ''} ${isMobileSlideIn ? styles.mobileSlideIn : ''}`}>
      <div className={styles.menuContent}>
        <ul className={styles.menuList}>
          {topMenuItems.map((item) => {
            // Special handling for shared goals - highlight when on /shared or /shared/[id]
            const isActive = item.href === '/shared'
              ? pathname === item.href || pathname.startsWith('/shared/')
              : pathname === item.href;
            const hasActiveChild = isChildActive(item);
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
                      {getIcon(item.icon, isDesktopCollapsed, item.icon === 'notifications' ? unreadCount : 0)}
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
                      {getIcon(item.icon, isDesktopCollapsed, item.icon === 'notifications' ? unreadCount : 0)}
                    </span>
                    <span className={styles.label}>{item.label}</span>
                  </button>
                ) : (
                  <>
                    {item.children ? (
                      <Link
                        href={item.href}
                        className={`${styles.menuLink} ${isActive || hasActiveChild ? styles.active : ''}`}
                        aria-current={isActive ? 'page' : undefined}
                        onClick={() => handleMenuItemClick(item.href, true)}
                      >
                        <span className={styles.icon}>
                          {getIcon(item.icon, isDesktopCollapsed, item.icon === 'notifications' ? unreadCount : 0)}
                        </span>
                        <span className={styles.label}>{item.label}</span>
                      </Link>
                    ) : (
                      <Link
                        href={item.href}
                        className={`${styles.menuLink} ${isActive || hasActiveChild ? styles.active : ''}`}
                        aria-current={isActive ? 'page' : undefined}
                        onClick={() => handleMenuItemClick(item.href, false)}
                      >
                        <span className={styles.icon}>
                          {getIcon(item.icon, isDesktopCollapsed, item.icon === 'notifications' ? unreadCount : 0)}
                        </span>
                        <span className={styles.label}>{item.label}</span>
                      </Link>
                    )}
                    {item.children && !isDesktopCollapsed && !isCollapsed && isExpanded(item.href) && (
                      <ul className={styles.childMenuList}>
                        {/* Show objectives for My Goals menu */}
                        {item.href === '/okrt' && objectives.map((objective) => (
                          <li key={`objective-${objective.id}`} className={styles.childMenuItem}>
                            <button
                              onClick={(e) => handleObjectiveClick(objective.id, e)}
                              className={styles.childMenuLink}
                              title={objective.title}
                            >
                              <span className={styles.label}>{objective.title}</span>
                            </button>
                          </li>
                        ))}
                        
                        {/* Show admin groups first */}
                        {item.href === '/groups' && adminGroups.map((group) => (
                          <li key={`group-${group.id}`} className={styles.childMenuItem}>
                            <button
                              onClick={(e) => handleGroupEditClick(group.id, e)}
                              className={styles.childMenuLink}
                              title={`Edit ${group.name}`}
                            >
                       
                              <span className={styles.label}>{group.name}</span>
                            </button>
                          </li>
                        ))}
                        
                        {/* Show original children */}
                        {item.children.map((child) => {
                          const isChildActiveLink = pathname === child.href;
                          const isAddGroup = child.href === '/groups/create';
                          const isAddOKR = child.isAction && child.label === 'Add OKR';
                          return (
                            <li key={child.href} className={styles.childMenuItem}>
                              {isAddGroup ? (
                                <button
                                  onClick={handleAddGroupClick}
                                  className={`${styles.childMenuLink} ${isChildActiveLink ? styles.active : ''}`}
                                >
                                  <span className={styles.icon}>
                                    {getIcon(child.icon, false)}
                                  </span>
                                  <span className={styles.label}>{child.label}</span>
                                </button>
                              ) : isAddOKR ? (
                                <button
                                  onClick={handleNewClick}
                                  className={styles.childMenuLink}
                                  title="Create New Objective"
                                  disabled={pathname !== '/okrt'}
                                >
                                  <span className={styles.icon}>
                                    {getIcon(child.icon, false)}
                                  </span>
                                  <span className={styles.label}>{child.label}</span>
                                </button>
                              ) : (
                                <Link
                                  href={child.href}
                                  className={`${styles.childMenuLink} ${isChildActiveLink ? styles.active : ''}`}
                                  aria-current={isChildActiveLink ? 'page' : undefined}
                                >
                                  <span className={styles.icon}>
                                    {getIcon(child.icon, false)}
                                  </span>
                                  <span className={styles.label}>{child.label}</span>
                                </Link>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      
      <div className={styles.bottomMenu}>
        <ul className={styles.menuList}>
          {bottomMenuItems.map((item) => {
            // Special handling for shared goals - highlight when on /shared or /shared/[id]
            const isActive = item.href === '/shared'
              ? pathname === item.href || pathname.startsWith('/shared/')
              : pathname === item.href;
            const isDisabled = item.disabled;

            return (
              <li key={item.href} className={styles.menuItem}>
                {isDisabled ? (
                  <span
                    className={`${styles.menuLink} ${styles.disabled}`}
                    title={`${item.label} (Coming Soon)`}
                  >
                    <span className={styles.icon}>
                      {getIcon(item.icon, isDesktopCollapsed, item.icon === 'notifications' ? unreadCount : 0)}
                    </span>
                    <span className={styles.label}>{item.label}</span>
                  </span>
                ) : (
                  <Link
                    href={item.href}
                    className={`${styles.menuLink} ${isActive ? styles.active : ''}`}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => handleMenuItemClick(item.href, false)}
                  >
                    <span className={styles.icon}>
                      {getIcon(item.icon, isDesktopCollapsed, item.icon === 'notifications' ? unreadCount : 0)}
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

  // If mobile slide-in, wrap in overlay
  if (isMobileSlideIn) {
    return (
      <div className={styles.mobileOverlay} onClick={handleOverlayClick}>
        {menuContent}
      </div>
    );
  }

  return menuContent;
}
