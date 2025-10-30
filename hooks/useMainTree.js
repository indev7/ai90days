import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import useMainTreeStore from '@/store/mainTreeStore';

// Global flag to track if a fetch is in progress across all hook instances
let globalFetchInProgress = false;
let globalFetchPromise = null;

/**
 * Custom hook to ensure mainTree is loaded
 * This hook will:
 * 1. Check if mainTree data exists in the store
 * 2. If not, or if it's stale (older than 5 minutes), fetch fresh data
 * 3. Handle authentication errors by redirecting to login
 * 4. Prevent multiple simultaneous fetches across all component instances
 */
export function useMainTree() {
  const router = useRouter();
  const {
    mainTree,
    lastUpdated,
    isLoading,
    setMainTree,
    setLoading,
    setError
  } = useMainTreeStore();
  
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    // Skip if this component instance has already triggered a fetch
    if (hasFetchedRef.current) {
      return;
    }

    const loadMainTree = async () => {
      // Check if we already have data and it's fresh (less than 5 minutes old)
      if (lastUpdated) {
        const lastUpdateTime = new Date(lastUpdated).getTime();
        const now = new Date().getTime();
        const fiveMinutes = 5 * 60 * 1000;
        
        // If data is fresh, don't reload (even if user has no OKRTs yet)
        if (now - lastUpdateTime < fiveMinutes) {
          console.log('MainTree data is fresh, skipping reload');
          hasFetchedRef.current = true;
          return;
        }
      }

      // If a fetch is already in progress globally, wait for it
      if (globalFetchInProgress && globalFetchPromise) {
        console.log('Fetch already in progress, waiting...');
        await globalFetchPromise;
        hasFetchedRef.current = true;
        return;
      }

      // If we're already loading in the store, don't start another load
      if (isLoading) {
        console.log('Store is already loading, skipping...');
        hasFetchedRef.current = true;
        return;
      }

      try {
        globalFetchInProgress = true;
        setLoading(true);
        console.log('Loading mainTree data...');

        const fetchPromise = fetch('/api/main-tree')
          .then(async (response) => {
            if (!response.ok) {
              if (response.status === 401) {
                // Unauthorized - redirect to login
                console.log('Unauthorized, redirecting to login');
                router.push('/login');
                return null;
              }
              throw new Error('Failed to load mainTree');
            }
            return response.json();
          })
          .then((data) => {
            if (data) {
              setMainTree(data.mainTree);
              console.log('MainTree loaded successfully:', {
                myOKRTs: data.mainTree.myOKRTs.length,
                sharedOKRTs: data.mainTree.sharedOKRTs.length,
                notifications: data.mainTree.notifications.length,
                timeBlocks: data.mainTree.timeBlocks.length,
                groups: data.mainTree.groups.length
              });
            }
          });

        globalFetchPromise = fetchPromise;
        await fetchPromise;
        hasFetchedRef.current = true;
      } catch (error) {
        console.error('Error loading mainTree:', error);
        setError(error.message);
      } finally {
        setLoading(false);
        globalFetchInProgress = false;
        globalFetchPromise = null;
      }
    };

    loadMainTree();
  }, []); // Only run once on mount

  /**
   * Force refresh mainTree data from server
   * Useful after group create/update/delete operations
   */
  const refreshMainTree = async () => {
    try {
      setLoading(true);
      console.log('Manually refreshing mainTree data...');

      const response = await fetch('/api/main-tree');
      if (!response.ok) {
        if (response.status === 401) {
          console.log('Unauthorized, redirecting to login');
          router.push('/login');
          return;
        }
        throw new Error('Failed to refresh mainTree');
      }

      const data = await response.json();
      if (data) {
        setMainTree(data.mainTree);
        console.log('MainTree refreshed successfully:', {
          myOKRTs: data.mainTree.myOKRTs.length,
          sharedOKRTs: data.mainTree.sharedOKRTs.length,
          notifications: data.mainTree.notifications.length,
          timeBlocks: data.mainTree.timeBlocks.length,
          groups: data.mainTree.groups.length
        });
      }
    } catch (error) {
      console.error('Error refreshing mainTree:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return {
    mainTree,
    isLoading,
    lastUpdated,
    refreshMainTree
  };
}