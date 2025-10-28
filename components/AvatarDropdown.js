'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import useMainTreeStore from '@/store/mainTreeStore';
import styles from './AvatarDropdown.module.css';

/**
 * @typedef {Object} User
 * @property {number} id
 * @property {string} username
 * @property {string} displayName
 */

/**
 * @typedef {Object} AvatarDropdownProps
 * @property {User} user - Current user data
 */

/**
 * Avatar dropdown menu component
 * @param {AvatarDropdownProps} props
 */
export default function AvatarDropdown({ user }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);
  const router = useRouter();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close dropdown on escape key
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  const clearMainTree = useMainTreeStore((state) => state.clearMainTree);
  
  const handleLogout = async () => {
    setIsOpen(false);
    
    try {
      // Wait for logout API to complete
      const response = await fetch('/api/logout', {
        method: 'POST',
        credentials: 'include', // Ensure cookies are sent
      });

      if (response.ok) {
        console.log('Logout successful');
      } else {
        console.warn('Logout API failed, but proceeding with client-side cleanup');
      }
    } catch (error) {
      console.error('Logout error:', error);
    }

    // Clear mainTree from Zustand store and localStorage
    clearMainTree();
    
    // Clear the persisted mainTree from localStorage
    window.localStorage.removeItem('main-tree-storage');
    
    // Clear any client-side auth state
    window.localStorage.setItem('authChange', Date.now().toString());
    window.localStorage.removeItem('authChange');
    
    // Force a hard redirect to login page to clear all state
    window.location.href = '/login';
  };

  const handleMenuItemClick = () => {
    setIsOpen(false);
  };

  return (
    <div className={styles.dropdown} ref={dropdownRef}>
      <button
        ref={buttonRef}
        className={styles.avatarButton}
        onClick={handleToggle}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="User menu"
      >
        <div className={styles.avatar}>
          {user.profilePictureUrl ? (
            <img
              src={user.profilePictureUrl}
              alt={user.displayName}
              className={styles.avatarImage}
            />
          ) : (
            user.displayName.charAt(0).toUpperCase()
          )}
        </div>
      </button>

      {isOpen && (
        <div className={styles.menu} role="menu">
          <div className={styles.header}>
            <div className={styles.userInfo}>
              <div className={styles.name}>{user.displayName}</div>
              <div className={styles.email}>{user.username}</div>
            </div>
          </div>
          
          <div className={styles.menuItems}>
            <Link
              href="/profile"
              className={styles.menuItem}
              onClick={handleMenuItemClick}
              role="menuitem"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              Profile
            </Link>
            
            <Link
              href="/settings"
              className={styles.menuItem}
              onClick={handleMenuItemClick}
              role="menuitem"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              Settings
            </Link>
            
            <button
              className={`${styles.menuItem} ${styles.logoutItem}`}
              onClick={handleLogout}
              role="menuitem"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16,17 21,12 16,7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
