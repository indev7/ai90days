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
 */

/**
 * Main header bar component
 * @param {HeaderBarProps} props
 */
export default function HeaderBar({ user = null }) {
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
          <Link href="/" className={styles.logoLink}>
            <span className={styles.logoText}>
              <span className={styles.logoNumber}>90</span>
              <span className={styles.logoWord}>Days</span>
            </span>
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
