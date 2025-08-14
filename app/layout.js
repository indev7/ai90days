'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { SessionProvider } from 'next-auth/react';
import HeaderBar from '@/components/HeaderBar';
import LeftMenu from '@/components/LeftMenu';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import '@/styles/theme.css';
import '@/styles/app.css';

export default function RootLayout({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMenuCollapsed, setIsMenuCollapsed] = useState(true);
  const pathname = usePathname();
  const router = useRouter();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1023px)');

  // Fetch current user on mount and path changes
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch('/api/me');
        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('Failed to fetch user:', error);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, [pathname]);

  // Listen for authentication events
  useEffect(() => {
    const handleAuthChange = () => {
      // Refetch user when auth changes
      const fetchUser = async () => {
        try {
          const response = await fetch('/api/me');
          if (response.ok) {
            const data = await response.json();
            setUser(data.user);
          } else {
            setUser(null);
          }
        } catch (error) {
          setUser(null);
        }
      };
      fetchUser();
    };

    // Listen for storage events (cross-tab login)
    window.addEventListener('storage', handleAuthChange);
    
    return () => {
      window.removeEventListener('storage', handleAuthChange);
    };
  }, []);

  // Hide layout on auth pages
  const isAuthPage = pathname === '/login' || pathname === '/signup';

  const handleMenuToggle = () => {
    setIsMenuCollapsed(!isMenuCollapsed);
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
  if (isLoading) {
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

  return (
    <html lang="en">
      <body>
        <SessionProvider>
          <HeaderBar user={user} />
          <LeftMenu 
            isCollapsed={isDesktop ? false : isMenuCollapsed} 
            onToggle={isDesktop ? undefined : handleMenuToggle}
          />
          <main style={{
            paddingTop: '72px',
            paddingLeft: isDesktop ? '260px' : 
                        isTablet && !isMenuCollapsed ? '260px' :
                        isTablet ? '80px' : '0'
          }}>
            {children}
          </main>
        </SessionProvider>
      </body>
    </html>
  );
}
