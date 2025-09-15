'use client';

import { useState, useEffect } from 'react';

import Link from 'next/link';
import HamburgerButton from './HamburgerButton';
import MobileMenu from './MobileMenu';
import AvatarDropdown from './AvatarDropdown';
import styles from './HeaderBar.module.css';

/**
 * @typedef {Object} User
 * @property {number} id
 * @property {string} username
 * @property {string} displayName
 */

/**
 * @typedef {Object} HeaderBarProps
 * @property {User|null} [user] - Current user data
 * @property {boolean} [isDesktopMenuCollapsed] - Whether desktop menu is collapsed
 * @property {function} [onDesktopMenuToggle] - Handler for desktop menu toggle
 */

/**
 * Main header bar component
 * @param {HeaderBarProps} props
 */
export default function HeaderBar({ user = null, isDesktopMenuCollapsed = false, onDesktopMenuToggle }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleMobileMenuToggle = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const handleMobileMenuClose = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      <header className={styles.header}>
        <div className={styles.left}>
          {onDesktopMenuToggle && (
            <button
              className={styles.menuToggle}
              onClick={onDesktopMenuToggle}
              aria-label={isDesktopMenuCollapsed ? "Expand menu" : "Collapse menu"}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
          )}
          <Link href="/" className={styles.logoLink}>
            <div className={styles.logo}>90Days</div>
          </Link>
        </div>

        <div className={styles.center}>
        </div>

        <div className={styles.right}>
          {user ? (
            <div className={styles.userMenu}>
              <span className={styles.greeting}>
                Welcome, {user.displayName}
              </span>
              <AvatarDropdown user={user} />
            </div>
          ) : (
            <div className={styles.authLinks}>
              <Link href="/login" className={styles.authLink}>
                Sign in
              </Link>
            </div>
          )}

          <HamburgerButton
            isOpen={isMobileMenuOpen}
            onClick={handleMobileMenuToggle}
            className={styles.hamburger}
          />
        </div>
      </header>

      <MobileMenu 
        isOpen={isMobileMenuOpen} 
        onClose={handleMobileMenuClose} 
      />
    </>
  );
}
