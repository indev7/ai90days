import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

// Global cache for user data across all hook instances
let globalUserCache = null;
let globalFetchPromise = null;
let globalFetchInProgress = false;
const cacheListeners = new Set();

/**
 * Custom hook to get current user with caching
 * This hook will:
 * 1. Return cached user data if available
 * 2. Fetch user data only once across all component instances
 * 3. Handle authentication errors by redirecting to login
 * 4. Provide a refresh method to manually update user data
 */
export function useUser() {
  const router = useRouter();
  const [user, setUser] = useState(globalUserCache);
  const [isLoading, setIsLoading] = useState(!globalUserCache);
  const [error, setError] = useState(null);
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    // If we already have cached data, use it
    if (globalUserCache) {
      setUser(globalUserCache);
      setIsLoading(false);
      return;
    }

    // Skip if this component instance has already triggered a fetch
    if (hasFetchedRef.current) {
      return;
    }

    const fetchUser = async () => {
      // If a fetch is already in progress globally, wait for it
      if (globalFetchInProgress && globalFetchPromise) {
        try {
          await globalFetchPromise;
          setUser(globalUserCache);
          setIsLoading(false);
        } catch (err) {
          setError(err.message);
          setIsLoading(false);
        }
        hasFetchedRef.current = true;
        return;
      }

      try {
        globalFetchInProgress = true;
        setIsLoading(true);

        const fetchPromise = fetch('/api/me')
          .then(async (response) => {
            if (!response.ok) {
              if (response.status === 401) {
                // Unauthorized - redirect to login
                router.push('/login');
                return null;
              }
              throw new Error('Failed to fetch user data');
            }
            return response.json();
          })
          .then((data) => {
            if (data && data.user) {
              globalUserCache = data.user;
              // Notify all listeners about the update
              cacheListeners.forEach(listener => listener(data.user));
              return data.user;
            }
            return null;
          });

        globalFetchPromise = fetchPromise;
        const userData = await fetchPromise;
        
        setUser(userData);
        setIsLoading(false);
        hasFetchedRef.current = true;
      } catch (err) {
        console.error('Error fetching user:', err);
        setError(err.message);
        setIsLoading(false);
      } finally {
        globalFetchInProgress = false;
        globalFetchPromise = null;
      }
    };

    fetchUser();
  }, [router]);

  // Subscribe to cache updates
  useEffect(() => {
    const listener = (updatedUser) => {
      setUser(updatedUser);
    };
    
    cacheListeners.add(listener);
    
    return () => {
      cacheListeners.delete(listener);
    };
  }, []);

  // Method to refresh user data
  const refreshUser = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/me');
      
      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login');
          return null;
        }
        throw new Error('Failed to refresh user data');
      }

      const data = await response.json();
      if (data && data.user) {
        globalUserCache = data.user;
        setUser(data.user);
        // Notify all listeners about the update
        cacheListeners.forEach(listener => listener(data.user));
      }
      
      setIsLoading(false);
      return data.user;
    } catch (err) {
      console.error('Error refreshing user:', err);
      setError(err.message);
      setIsLoading(false);
      return null;
    }
  }, [router]);

  // Method to clear cache (useful for logout)
  const clearUserCache = () => {
    globalUserCache = null;
    setUser(null);
    cacheListeners.forEach(listener => listener(null));
  };

  // When auth changes in another tab (new login/logout), clear caches and refetch
  useEffect(() => {
    const handleAuthChange = () => {
      globalUserCache = null;
      globalFetchPromise = null;
      globalFetchInProgress = false;
      cacheListeners.forEach(listener => listener(null));
      setUser(null);
      setIsLoading(true);
      hasFetchedRef.current = false;
      refreshUser();
    };

    const handleStorage = (event) => {
      if (event.key === 'authChange') {
        handleAuthChange();
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorage);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', handleStorage);
      }
    };
  }, [refreshUser]);

  return {
    user,
    isLoading,
    error,
    refreshUser,
    clearUserCache
  };
}

// Export method to clear cache from outside the hook
export const clearGlobalUserCache = () => {
  globalUserCache = null;
  cacheListeners.forEach(listener => listener(null));
};
