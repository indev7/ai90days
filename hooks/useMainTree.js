import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/hooks/useUser';
import useMainTreeStore from '@/store/mainTreeStore';
import { getCurrentTheme, loadTheme, normalizeThemeId } from '@/lib/themeManager';

const FRESHNESS_WINDOW = 5 * 60 * 1000;

// Global flag to track if a fetch is in progress across all hook instances
let globalFetchInProgress = false;
let globalFetchPromise = null;
let globalCalendarLoadInProgress = false;
let globalCalendarPromise = null;

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
  const { user } = useUser();
  const {
    mainTree,
    lastUpdated,
    isLoading,
    setMainTree,
    setLoading,
    setError,
    setSectionLoading,
    setSectionLoaded,
    setCalendar,
    clearMainTree,
    currentUserId,
    setCurrentUserId
  } = useMainTreeStore();
  
  const hasFetchedRef = useRef(false);
  const hasLoadedCalendarRef = useRef(false);
  const prevUserIdRef = useRef(null);

  useEffect(() => {
    // Reset fetch flag when user changes (new login)
    if (user?.id !== prevUserIdRef.current) {
      hasFetchedRef.current = false;
      prevUserIdRef.current = user?.id || null;
    }

    // Skip if this component instance has already triggered a fetch
    if (hasFetchedRef.current) {
      return;
    }

    const loadMainTree = async () => {
      // If user changed (new login), reset cached tree
      if (user && currentUserId && currentUserId !== user.id) {
        clearMainTree();
      }
      if (user && currentUserId !== user.id) {
        setCurrentUserId(user.id);
      }

      // Check if we already have data and it's fresh (less than 5 minutes old)
      if (lastUpdated && mainTree?.preferences && currentUserId === user?.id) {
        const lastUpdateTime = new Date(lastUpdated).getTime();
        const now = new Date().getTime();
        
        // If data is fresh, don't reload (even if user has no OKRTs yet)
        if (now - lastUpdateTime < FRESHNESS_WINDOW) {
          console.log('MainTree data is fresh, skipping reload');
          hasFetchedRef.current = true;
          
          // Load calendar in background if not already loaded
          if (!hasLoadedCalendarRef.current) {
            loadCalendarInBackground();
          }
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
        
        // Mark all sections as loading
        setSectionLoading('myOKRTs', true);
        setSectionLoading('timeBlocks', true);
        setSectionLoading('notifications', true);
        setSectionLoading('sharedOKRTs', true);
        setSectionLoading('groups', true);
        setSectionLoading('jiraTickets', true);
        setSectionLoading('preferences', true);
        
        console.log('Loading mainTree data progressively...');

        const fetchPromise = (async () => {
          const response = await fetch('/api/main-tree/progressive');
          
          if (!response.ok) {
            if (response.status === 401) {
              console.log('Unauthorized, redirecting to login');
              router.push('/login');
              return;
            }
            throw new Error('Failed to load mainTree');
          }

          // Process streaming response
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line in buffer
            
            for (const line of lines) {
              if (!line.trim()) continue;
              
              try {
                const message = JSON.parse(line);
                
                if (message.complete) {
                  console.log('Progressive loading complete');
                  continue;
                }
                
                if (message.section && message.data) {
                  const { section, data } = message;
                  console.log(`✅ Received ${section}:`, Array.isArray(data) ? data.length : 'object');
                  
                  // Update store for each section as it arrives
                  const store = useMainTreeStore.getState();
                  switch (section) {
                    case 'preferences':
                      store.setPreferences(data);
                      break;
                    case 'myOKRTs':
                      store.setMyOKRTs(data);
                      break;
                    case 'timeBlocks':
                      store.setTimeBlocks(data);
                      break;
                    case 'notifications':
                      store.setNotifications(data);
                      break;
                    case 'sharedOKRTs':
                      store.setSharedOKRTs(data);
                      break;
                    case 'jiraTickets':
                      store.setJiraTickets(data);
                      break;
                    case 'groups':
                      store.setGroups(data);
                      break;
                  }
                }
              } catch (e) {
                console.error('Error parsing progressive response:', e);
              }
            }
          }
          
          // Load calendar in background after main sections are loaded
          loadCalendarInBackground();
        })();

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

    // Load calendar events in background (separate from main tree)
    const loadCalendarInBackground = async () => {
      if (hasLoadedCalendarRef.current) {
        return;
      }

      const calendarState = useMainTreeStore.getState().sectionStates?.calendar;
      const isCalendarFresh = calendarState?.lastUpdated
        ? (Date.now() - new Date(calendarState.lastUpdated).getTime()) < FRESHNESS_WINDOW
        : false;

      // Skip reload if we already have fresh calendar data
      if (calendarState?.loaded && isCalendarFresh) {
        hasLoadedCalendarRef.current = true;
        return;
      }

      // If another instance is already loading calendar, wait for it
      if (globalCalendarLoadInProgress && globalCalendarPromise) {
        await globalCalendarPromise;
        hasLoadedCalendarRef.current = true;
        return;
      }

      try {
        globalCalendarLoadInProgress = true;
        const calendarPromise = (async () => {
          setSectionLoading('calendar', true);
          console.log('Loading calendar events in background...');
          
          const response = await fetch('/api/main-tree/calendar');
          if (!response.ok) {
            console.error('Failed to load calendar events');
            setSectionLoading('calendar', false);
            return false;
          }
          
          const data = await response.json();
          if (data && data.calendar) {
            setCalendar(data.calendar);
            setSectionLoaded('calendar');
            console.log('Calendar loaded successfully:', {
              events: data.calendar.events?.length || 0
            });
            return true;
          }

          setSectionLoading('calendar', false);
          return false;
        })();

        globalCalendarPromise = calendarPromise;
        const calendarLoaded = await calendarPromise;
        hasLoadedCalendarRef.current = calendarLoaded;
      } catch (error) {
        console.error('Error loading calendar:', error);
        // Don't fail the whole app if calendar fails
        setSectionLoading('calendar', false);
      } finally {
        globalCalendarLoadInProgress = false;
        globalCalendarPromise = null;
      }
    };

    loadMainTree();
  }, [user?.id, currentUserId, lastUpdated]); // rerun when user or freshness changes

  // Clear cached tree when auth state changes in another tab (login/logout)
  useEffect(() => {
    const handleAuthChange = (event) => {
      if (event.key !== 'authChange') {
        return;
      }

      console.log('Auth change detected, clearing cached mainTree');
      clearMainTree();
      setCurrentUserId(null);
      hasFetchedRef.current = false;
      globalFetchInProgress = false;
      globalFetchPromise = null;
      globalCalendarLoadInProgress = false;
      globalCalendarPromise = null;

      try {
        window.localStorage.removeItem('main-tree-storage');
      } catch (err) {
        console.warn('Failed to clear main-tree storage on auth change', err);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleAuthChange);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', handleAuthChange);
      }
    };
  }, [clearMainTree, setCurrentUserId]);

  // Apply theme preference as soon as preferences are available
  useEffect(() => {
    const preferredTheme = mainTree?.preferences?.theme;
    if (!preferredTheme) return;

    const normalizedTheme = normalizeThemeId(preferredTheme);
    const currentTheme = getCurrentTheme();

    if (normalizedTheme !== currentTheme) {
      loadTheme(normalizedTheme);
    }
  }, [mainTree?.preferences?.theme]);

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
