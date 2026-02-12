'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { SessionProvider } from 'next-auth/react';
import HeaderBar from '@/components/HeaderBar';
import LeftMenu from '@/components/LeftMenu';
import { CoachProvider } from '@/contexts/CoachContext';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useUser } from '@/hooks/useUser';
import { initializeTheme } from '@/lib/themeManager';

// Theme CSS imports
import '@/styles/theme.css';
import '@/styles/themes/base.css';
import '@/styles/themes/coffee.css';
import '@/styles/themes/microsoft.css';
import '@/styles/themes/purple.css';
import '@/styles/themes/nature.css';
import '@/styles/themes/dreambig.css';
import '@/styles/app.css';

export default function RootLayout({ children }) {
  const { user, isLoading: userLoading } = useUser();
  const [isMenuCollapsed, setIsMenuCollapsed] = useState(true);
  const [isDesktopMenuCollapsed, setIsDesktopMenuCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const isDesktop = useMediaQuery('(min-width: 1380px)');
  const isTabletLandscape = useMediaQuery('(min-width: 1024px) and (max-width: 1379px)');
  const isTabletPortrait = useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
  const isMobile = useMediaQuery('(max-width: 767px)');
  const headerHeight = isMobile ? 128 : 72;
  const jiraStatusCheckedRef = useRef(false);

  // Initialize theme system
  useEffect(() => {
    initializeTheme();
  }, []);

  // Auto-refresh Jira auth on sign-in if a refresh token exists
  useEffect(() => {
    if (!user || jiraStatusCheckedRef.current) return;
    jiraStatusCheckedRef.current = true;

    fetch('/api/jira/auth/status')
      .catch((error) => {
        console.warn('Failed to preflight Jira auth status:', error);
      });
  }, [user]);


  // Listen for focus mode events from OKRT pages
  useEffect(() => {
    const handleEnterFocusMode = () => {
      // Collapse the appropriate menu based on screen size
      if (isDesktop) {
        setIsDesktopMenuCollapsed(true);
      } else if (isTabletLandscape) {
        setIsMenuCollapsed(true);
      }
    };

    const handleExitFocusMode = () => {
      // Expand the appropriate menu based on screen size
      if (isDesktop) {
        setIsDesktopMenuCollapsed(false);
      } else if (isTabletLandscape) {
        setIsMenuCollapsed(false);
      }
    };

    window.addEventListener('enterFocusMode', handleEnterFocusMode);
    window.addEventListener('exitFocusMode', handleExitFocusMode);

    return () => {
      window.removeEventListener('enterFocusMode', handleEnterFocusMode);
      window.removeEventListener('exitFocusMode', handleExitFocusMode);
    };
  }, [isDesktop, isTabletLandscape]);

  // Hide layout on auth pages
  const isAuthPage = pathname === '/login' || pathname === '/signup';

  const handleMenuToggle = () => {
    const newCollapsedState = !isMenuCollapsed;
    setIsMenuCollapsed(newCollapsedState);
    
    // If menu is being expanded (collapsed -> not collapsed), dispatch event to collapse OKRTs
    if (!newCollapsedState) {
      window.dispatchEvent(new CustomEvent('exitFocusMode'));
      window.dispatchEvent(new CustomEvent('menuToggleToExpanded'));
    }
  };

  const handleDesktopMenuToggle = () => {
    const newCollapsedState = !isDesktopMenuCollapsed;
    setIsDesktopMenuCollapsed(newCollapsedState);
    
    // If menu is being expanded (collapsed -> not collapsed), dispatch event to collapse OKRTs
    if (!newCollapsedState) {
      window.dispatchEvent(new CustomEvent('exitFocusMode'));
      window.dispatchEvent(new CustomEvent('menuToggleToExpanded'));
    }
  };

  const handleMobileMenuToggle = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const handleMobileMenuClose = () => {
    setIsMobileMenuOpen(false);
  };

  if (isAuthPage) {
    return (
      <html lang="en">
        <body>
          <SessionProvider>
            {children}
          </SessionProvider>
        </body>
      </html>
    );
  }

  // Don't show layout components for non-authenticated users
  if (userLoading) {
    return (
      <html lang="en">
        <body>
          <SessionProvider>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
              Loading...
            </div>
          </SessionProvider>
        </body>
      </html>
    );
  }

  // Show different layout based on authentication
  if (!user) {
    return (
      <html lang="en">
        <body>
          <SessionProvider>
            {children}
          </SessionProvider>
        </body>
      </html>
    );
  }

  // Calculate the current menu width
  const getMenuWidth = () => {
    if (isDesktop) {
      return isDesktopMenuCollapsed ? 80 : 240;
    } else if (isTabletLandscape) {
      return isMenuCollapsed ? 80 : 240; // Can be toggled on tablet landscape
    } else {
      return 0; // Hidden on mobile and tablet portrait (slide-in overlay doesn't affect content padding)
    }
  };

  return (
    <html lang="en">
      <body>
        <SessionProvider>
          <CoachProvider>
            <HeaderBar
              user={user}
              isDesktopMenuCollapsed={isDesktopMenuCollapsed}
              onDesktopMenuToggle={isDesktop ? handleDesktopMenuToggle : undefined}
              onLeftMenuToggle={isTabletLandscape ? handleMenuToggle : undefined}
              isLeftMenuCollapsed={isMenuCollapsed}
              onMobileMenuToggle={(isMobile || isTabletPortrait) ? handleMobileMenuToggle : undefined}
              isMobileMenuOpen={isMobileMenuOpen}
            />
            <LeftMenu
              isCollapsed={isDesktop ? false : isMenuCollapsed}
              onToggle={isDesktop ? undefined : handleMenuToggle}
              isDesktopCollapsed={isDesktop ? isDesktopMenuCollapsed : false}
              isMobileSlideIn={(isMobile || isTabletPortrait) && isMobileMenuOpen}
              onMobileClose={handleMobileMenuClose}
            />
            <main style={{
              '--app-header-height': `${headerHeight}px`,
              paddingTop: `${headerHeight}px`,
              paddingLeft: `${getMenuWidth()}px`,
              transition: 'padding-left 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
            }}>
              {children}
            </main>
          </CoachProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
