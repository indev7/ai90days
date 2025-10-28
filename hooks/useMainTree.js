import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useMainTreeStore from '@/store/mainTreeStore';

/**
 * Custom hook to ensure mainTree is loaded
 * This hook will:
 * 1. Check if mainTree data exists in the store
 * 2. If not, or if it's stale (older than 5 minutes), fetch fresh data
 * 3. Handle authentication errors by redirecting to login
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

  useEffect(() => {
    const loadMainTree = async () => {
      // Check if we already have data and it's fresh (less than 5 minutes old)
      if (lastUpdated) {
        const lastUpdateTime = new Date(lastUpdated).getTime();
        const now = new Date().getTime();
        const fiveMinutes = 5 * 60 * 1000;
        
        // If data is fresh and we have OKRTs, don't reload
        if (now - lastUpdateTime < fiveMinutes && mainTree.myOKRTs.length > 0) {
          console.log('MainTree data is fresh, skipping reload');
          return;
        }
      }

      // If we're already loading, don't start another load
      if (isLoading) {
        return;
      }

      try {
        setLoading(true);
        console.log('Loading mainTree data...');

        const response = await fetch('/api/main-tree');
        
        if (!response.ok) {
          if (response.status === 401) {
            // Unauthorized - redirect to login
            console.log('Unauthorized, redirecting to login');
            router.push('/login');
            return;
          }
          throw new Error('Failed to load mainTree');
        }

        const data = await response.json();
        setMainTree(data.mainTree);
        console.log('MainTree loaded successfully:', {
          myOKRTs: data.mainTree.myOKRTs.length,
          sharedOKRTs: data.mainTree.sharedOKRTs.length,
          notifications: data.mainTree.notifications.length,
          timeBlocks: data.mainTree.timeBlocks.length,
          groups: data.mainTree.groups.length
        });
      } catch (error) {
        console.error('Error loading mainTree:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    loadMainTree();
  }, []); // Only run once on mount

  return {
    mainTree,
    isLoading,
    lastUpdated
  };
}