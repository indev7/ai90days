'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import styles from './MobileMenu.module.css';

const topMenuItems = [
  { href: '/dashboard', label: 'Dashboard', icon: 'profile' },
  { href: '/okrt', label: 'My Goals', icon: 'goals'},
  { href: '/shared', label: 'Shared Goals', icon: 'shared', disabled: true },
  { href: '/new', label: 'New', icon: 'new', disabled: true },
];

const bottomMenuItems = [
  { href: '/coach', label: 'Coach', icon: 'coach'},
  { href: '/notifications', label: 'Notifications', icon: 'notifications', disabled: true },
];

function getIcon(iconName) {
  const icons = {
    profile: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
        <polyline points="16 7 22 7 22 13" />
      </svg>
    ),
    goals: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" />
        <path d="M7 7l10 10" />
        <path d="M14 7l3 0l0 3" />
      </svg>
    ),
    shared: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </svg>
    ),
    coach: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
    notifications: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
    settings: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  };
  return icons[iconName] || null;
}

/**
 * @typedef {Object} MobileMenuProps
 * @property {boolean} isOpen - Whether the menu is open
 * @property {function} onClose - Close handler
 */

/**
 * Full-screen mobile menu overlay
 * @param {MobileMenuProps} props
 */
export default function MobileMenu({ isOpen, onClose }) {
  const pathname = usePathname();
  const firstLinkRef = useRef(null);
  const overlayRef = useRef(null);

  // Focus management
  useEffect(() => {
    if (isOpen && firstLinkRef.current) {
      firstLinkRef.current.focus();
    }
  }, [isOpen]);

  // Escape key handler
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  // Focus trap
  useEffect(() => {
    if (!isOpen) return;

    const overlay = overlayRef.current;
    if (!overlay) return;

    const focusableElements = overlay.querySelectorAll(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTabKey = (e) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    overlay.addEventListener('keydown', handleTabKey);
    return () => overlay.removeEventListener('keydown', handleTabKey);
  }, [isOpen]);

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleLinkClick = () => {
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      id="mobile-menu"
      onClick={handleBackdropClick}
    >
      <div className={styles.menu}>
        <div className={styles.header}>
          <h2 className={styles.title}>Menu</h2>
          <button
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close menu"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18" />
              <path d="M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className={styles.navigation}>
          <ul className={styles.menuList}>
            {topMenuItems.map((item, index) => {
              const isActive = pathname === item.href;
              const isDisabled = item.disabled;

              return (
                <li key={item.href} className={styles.menuItem}>
                  {isDisabled ? (
                    <span className={`${styles.menuLink} ${styles.disabled}`}>
                      <span className={styles.icon}>
                        {getIcon(item.icon)}
                      </span>
                      <span className={styles.label}>{item.label}</span>
                      <span className={styles.badge}>Soon</span>
                    </span>
                  ) : (
                    <Link
                      ref={index === 0 ? firstLinkRef : null}
                      href={item.href}
                      className={`${styles.menuLink} ${isActive ? styles.active : ''}`}
                      onClick={handleLinkClick}
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
          
          <div className={styles.bottomSection}>
            <ul className={styles.menuList}>
              {bottomMenuItems.map((item) => {
                const isActive = pathname === item.href;
                const isDisabled = item.disabled;

                return (
                  <li key={item.href} className={styles.menuItem}>
                    {isDisabled ? (
                      <span className={`${styles.menuLink} ${styles.disabled}`}>
                        <span className={styles.icon}>
                          {getIcon(item.icon)}
                        </span>
                        <span className={styles.label}>{item.label}</span>
                        <span className={styles.badge}>Soon</span>
                      </span>
                    ) : (
                      <Link
                        href={item.href}
                        className={`${styles.menuLink} ${isActive ? styles.active : ''}`}
                        onClick={handleLinkClick}
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
        </nav>
      </div>
    </div>
  );
}
