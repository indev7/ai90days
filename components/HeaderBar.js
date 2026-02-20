'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import HamburgerButton from './HamburgerButton';
import AvatarDropdown from './AvatarDropdown';
import LoadingIndicators from './LoadingIndicators';
import styles from './HeaderBar.module.css';
import useAimeStore from '@/store/aimeStore';
import useVoiceRecording from '@/hooks/useVoiceRecording';
import useMainTreeStore from '@/store/mainTreeStore';
import { useMainTree } from '@/hooks/useMainTree';
import FavouritePromptsModal from './FavouritePromptsModal';
import { TiMicrophoneOutline } from 'react-icons/ti';
import { FiSearch, FiX } from 'react-icons/fi';
import { LuNotebookText } from 'react-icons/lu';
import { IoMdNotificationsOutline } from 'react-icons/io';

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
 * @property {boolean} [isLeftMenuCollapsed] - Whether left menu is collapsed (mid-range)
 * @property {function} [onLeftMenuToggle] - Handler for left menu toggle (mid-range)
 * @property {function} [onMobileMenuToggle] - Handler for mobile menu toggle
 * @property {boolean} [isMobileMenuOpen] - Whether mobile menu is open
 */

/**
 * Main header bar component
 * @param {HeaderBarProps} props
 */
export default function HeaderBar({ 
  user = null, 
  isDesktopMenuCollapsed = false, 
  onDesktopMenuToggle,
  isLeftMenuCollapsed = false,
  onLeftMenuToggle,
  onMobileMenuToggle,
  isMobileMenuOpen = false
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { isLoading, setPendingMessage } = useAimeStore();
  const unreadFromStore = useMainTreeStore(
    (state) => state.mainTree.notifications.filter((notification) => !notification.is_read).length
  );
  const preferencesDisplayName = useMainTreeStore(
    (state) => state.mainTree?.preferences?.user?.display_name || ''
  );
  const [unreadCount, setUnreadCount] = useState(unreadFromStore);
  const [query, setQuery] = useState('');
  const [isFavouritePromptsOpen, setIsFavouritePromptsOpen] = useState(false);
  const inputRef = useRef(null);

  useMainTree();

  useEffect(() => {
    setUnreadCount(unreadFromStore);
  }, [unreadFromStore]);

  useEffect(() => {
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
        setTimeout(setupSSE, 5000);
      };

      return eventSource;
    };

    const eventSource = setupSSE();
    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, []);

  const handleMobileMenuToggle = () => {
    if (onLeftMenuToggle) {
      // For mid-range screens, control the left menu
      onLeftMenuToggle();
    } else if (onMobileMenuToggle) {
      // For mobile screens, control the mobile slide-in menu
      onMobileMenuToggle();
    }
  };

  const handleLogoClick = (e) => {
    if (onDesktopMenuToggle) {
      e.preventDefault();
      onDesktopMenuToggle();
      return;
    }
    if (onLeftMenuToggle) {
      e.preventDefault();
      onLeftMenuToggle();
      return;
    }
    if (onMobileMenuToggle) {
      e.preventDefault();
      onMobileMenuToggle();
    }
  };

  const handleTranscription = (text) => {
    if (text && text.trim()) {
      setQuery(text);
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  };

  const { isRecording, isProcessing, startRecording, stopRecording } = useVoiceRecording(handleTranscription);

  const handleMicrophoneClick = () => {
    if (isRecording) {
      stopRecording('manual');
    } else {
      startRecording();
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || isLoading) return;
    setPendingMessage({ id: Date.now(), text: trimmed });
    setQuery('');
    if (pathname !== '/aime') {
      router.push('/aime');
    }
  };

  const handlePromptPlay = (promptText) => {
    if (!promptText || isLoading) return;
    setPendingMessage({ id: Date.now(), text: promptText });
    setIsFavouritePromptsOpen(false);
    router.push('/aime');
  };


  const userDisplayName =
    preferencesDisplayName || user?.displayName || user?.username || 'User';

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
          
          {/* Mid-range hamburger for left menu control */}
          {onLeftMenuToggle && !onDesktopMenuToggle && (
            <button
              className={styles.leftMenuToggle}
              onClick={onLeftMenuToggle}
              aria-label={isLeftMenuCollapsed ? "Expand menu" : "Collapse menu"}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
          )}
          
          {/* Mobile hamburger for mobile menu */}
          {!onDesktopMenuToggle && !onLeftMenuToggle && onMobileMenuToggle && (
            <HamburgerButton
              isOpen={isMobileMenuOpen}
              onClick={handleMobileMenuToggle}
              className={styles.mobileHamburger}
            />
          )}
          
          <Link href="/" className={styles.logoLink} aria-label="AIME" onClick={handleLogoClick}>
            <span className={styles.logo}>
              <span className={styles.logoAIM}>AIM</span>
              <span className={styles.logoE}>E</span>
            </span>
          </Link>
        </div>

        <div className={styles.center}>
          <div className={styles.centerActions}>
            {pathname !== '/aime' && (
              <form className={styles.searchForm} onSubmit={handleSubmit}>
                <div className={styles.searchBar}>
                  <input
                    ref={inputRef}
                    className={styles.searchInput}
                    type="text"
                    placeholder="Ask Aime..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    disabled={isLoading}
                  />
                  {query.trim() && (
                    <button
                      type="button"
                      className={styles.searchIconButton}
                      onClick={() => setQuery('')}
                      aria-label="Clear input"
                    >
                      <FiX size={20} />
                    </button>
                  )}
                  <button
                    type="button"
                    className={`${styles.searchIconButton} ${styles.micButton} ${isRecording ? styles.micButtonRecording : ''}`}
                    onClick={handleMicrophoneClick}
                    disabled={isLoading || isProcessing}
                    aria-label={isRecording ? 'Stop voice input' : 'Start voice input'}
                    title="Voice Input"
                  >
                    <TiMicrophoneOutline size={22} />
                  </button>
                  <button
                    type="submit"
                    className={styles.searchIconButton}
                    disabled={isLoading || !query.trim()}
                    aria-label="Send to Aime"
                    title="Ask Aime"
                  >
                    <FiSearch size={20} />
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        <div className={styles.right}>
          {user ? (
            <div className={styles.userMenu}>
              <Link
                href="#"
                className={styles.favoritePromptsLink}
                aria-label="Favourite Prompts"
                title="Favourite Prompts"
                onClick={(event) => {
                  event.preventDefault();
                  setIsFavouritePromptsOpen(true);
                }}
              >
                <span className={styles.favoritePromptsIcon} aria-hidden="true" />
              </Link>
              <Link href="/notifications" className={styles.notificationLink} aria-label="Notifications">
                <IoMdNotificationsOutline size={22} />
                {unreadCount > 0 && (
                  <span className={styles.notificationBadge}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Link>
              <div className={styles.userInfo}>
                <span className={styles.greeting}>
                  Welcome, {userDisplayName}
                </span>
                <div className={styles.userIndicators}>
                  <LoadingIndicators compact />
                </div>
              </div>
              <AvatarDropdown user={user} />
            </div>
          ) : (
            <div className={styles.authLinks}>
              <Link href="/login" className={styles.authLink}>
                Sign in
              </Link>
            </div>
          )}
        </div>
      </header>

      <FavouritePromptsModal
        isOpen={isFavouritePromptsOpen}
        onClose={() => setIsFavouritePromptsOpen(false)}
        onPlay={handlePromptPlay}
        isLoading={isLoading}
      />
    </>
  );
}
