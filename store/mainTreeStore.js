import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * Cross-tab synchronization middleware
 * Listens to storage events and updates the store when changes occur in other tabs
 */
const crossTabSync = (config) => (set, get, api) => {
  const storeKey = 'main-tree-storage';
  
  // Listen for storage events from other tabs
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key === storeKey && e.newValue) {
        try {
          const newState = JSON.parse(e.newValue);
          // Update the store with the new state from another tab
          set({
            mainTree: newState.state.mainTree,
            lastUpdated: newState.state.lastUpdated
          });
          console.log('Cross-tab sync: Store updated from another tab');
        } catch (error) {
          console.error('Cross-tab sync error:', error);
        }
      }
    });
  }
  
  return config(set, get, api);
};

/**
 * Main Tree Store - Global state management for user data
 *
 * Structure:
 * {
 *   myOKRTs: [],        // User's own OKRTs (lazy loaded fields)
 *   sharedOKRTs: [],    // OKRTs shared with user (lazy loaded fields)
 *   notifications: [],  // User's notifications (lazy loaded fields)
 *   timeBlocks: [],     // User's time blocks (all fields for calendar/clock)
 *   groups: []          // User's groups with members and objectives
 * }
 */

const useMainTreeStore = create(
  crossTabSync(
    persist(
      (set, get) => ({
  // Main tree data structure
  mainTree: {
    preferences: null,
    myOKRTs: [],
    sharedOKRTs: [],
    notifications: [],
    timeBlocks: [],
    groups: [],
    calendar: {
      events: [],
      quarter: null
    }
  },
  
  // Section loading states for LED indicators
  sectionStates: {
    preferences: { loading: false, loaded: false, lastUpdated: null },
    myOKRTs: { loading: false, loaded: false, lastUpdated: null },
    sharedOKRTs: { loading: false, loaded: false, lastUpdated: null },
    notifications: { loading: false, loaded: false, lastUpdated: null },
    timeBlocks: { loading: false, loaded: false, lastUpdated: null },
    groups: { loading: false, loaded: false, lastUpdated: null },
    calendar: { loading: false, loaded: false, lastUpdated: null }
  },
  
  // Loading states
  isLoading: false,
  error: null,
  lastUpdated: null,
  llmActivity: { active: false, lastStarted: null },
  
  // Actions
  setMainTree: (tree) => set((state) => {
    const now = new Date().toISOString();
    // Mark all sections as loaded when full tree is set
    const newSectionStates = {
      preferences: { loading: false, loaded: true, lastUpdated: now },
      myOKRTs: { loading: false, loaded: true, lastUpdated: now },
      sharedOKRTs: { loading: false, loaded: true, lastUpdated: now },
      notifications: { loading: false, loaded: true, lastUpdated: now },
      timeBlocks: { loading: false, loaded: true, lastUpdated: now },
      groups: { loading: false, loaded: true, lastUpdated: now },
      calendar: { loading: false, loaded: true, lastUpdated: now }
    };
    return {
      mainTree: tree,
      lastUpdated: now,
      sectionStates: newSectionStates
    };
  }),
  
  // Update section loading state
  setSectionLoading: (section, isLoading) => set((state) => ({
    sectionStates: {
      ...state.sectionStates,
      [section]: {
        ...state.sectionStates[section],
        loading: isLoading,
        loaded: isLoading ? false : state.sectionStates[section].loaded
      }
    }
  })),
  
  // Mark section as loaded
  setSectionLoaded: (section) => set((state) => ({
    sectionStates: {
      ...state.sectionStates,
      [section]: {
        loading: false,
        loaded: true,
        lastUpdated: new Date().toISOString()
      }
    }
  })),
  
  setMyOKRTs: (okrts) => set((state) => {
    const now = new Date().toISOString();
    return {
      mainTree: {
        ...state.mainTree,
        myOKRTs: okrts
      },
      lastUpdated: now,
      sectionStates: {
        ...state.sectionStates,
        myOKRTs: { loading: false, loaded: true, lastUpdated: now }
      }
    };
  }),

  setPreferences: (preferences) => set((state) => {
    const now = new Date().toISOString();
    return {
      mainTree: {
        ...state.mainTree,
        preferences
      },
      lastUpdated: now,
      sectionStates: {
        ...state.sectionStates,
        preferences: { loading: false, loaded: true, lastUpdated: now }
      }
    };
  }),
  
  setSharedOKRTs: (okrts) => set((state) => {
    const now = new Date().toISOString();
    return {
      mainTree: {
        ...state.mainTree,
        sharedOKRTs: okrts
      },
      lastUpdated: now,
      sectionStates: {
        ...state.sectionStates,
        sharedOKRTs: { loading: false, loaded: true, lastUpdated: now }
      }
    };
  }),
  
  setNotifications: (notifications) => set((state) => {
    const now = new Date().toISOString();
    return {
      mainTree: {
        ...state.mainTree,
        notifications: notifications
      },
      lastUpdated: now,
      sectionStates: {
        ...state.sectionStates,
        notifications: { loading: false, loaded: true, lastUpdated: now }
      }
    };
  }),
  
  setTimeBlocks: (timeBlocks) => set((state) => {
    const now = new Date().toISOString();
    return {
      mainTree: {
        ...state.mainTree,
        timeBlocks: timeBlocks
      },
      lastUpdated: now,
      sectionStates: {
        ...state.sectionStates,
        timeBlocks: { loading: false, loaded: true, lastUpdated: now }
      }
    };
  }),
  
  setGroups: (groups) => set((state) => {
    const now = new Date().toISOString();
    return {
      mainTree: {
        ...state.mainTree,
        groups: groups
      },
      lastUpdated: now,
      sectionStates: {
        ...state.sectionStates,
        groups: { loading: false, loaded: true, lastUpdated: now }
      }
    };
  }),
  
  // Set calendar events
  setCalendar: (calendar) => set((state) => {
    const now = new Date().toISOString();
    return {
      mainTree: {
        ...state.mainTree,
        calendar: calendar
      },
      lastUpdated: now,
      sectionStates: {
        ...state.sectionStates,
        calendar: { loading: false, loaded: true, lastUpdated: now }
      }
    };
  }),
  
  // Add a single OKRT to myOKRTs
  addMyOKRT: (okrt) => set((state) => ({
    mainTree: {
      ...state.mainTree,
      myOKRTs: [...state.mainTree.myOKRTs, okrt]
    },
    lastUpdated: new Date().toISOString()
  })),
  
  // Update a single OKRT in myOKRTs
  updateMyOKRT: (id, updates) => set((state) => ({
    mainTree: {
      ...state.mainTree,
      myOKRTs: state.mainTree.myOKRTs.map(okrt => 
        okrt.id === id ? { ...okrt, ...updates } : okrt
      )
    },
    lastUpdated: new Date().toISOString()
  })),
  
  // Remove a single OKRT from myOKRTs
  removeMyOKRT: (id) => set((state) => ({
    mainTree: {
      ...state.mainTree,
      myOKRTs: state.mainTree.myOKRTs.filter(okrt => okrt.id !== id)
    },
    lastUpdated: new Date().toISOString()
  })),
  
  // Add a notification
  addNotification: (notification) => set((state) => ({
    mainTree: {
      ...state.mainTree,
      notifications: [notification, ...state.mainTree.notifications]
    },
    lastUpdated: new Date().toISOString()
  })),
  
  // Mark notification as read
  markNotificationRead: (id) => set((state) => ({
    mainTree: {
      ...state.mainTree,
      notifications: state.mainTree.notifications.map(notif =>
        notif.id === id ? { ...notif, is_read: true } : notif
      )
    },
    lastUpdated: new Date().toISOString()
  })),
  
  // Add a time block
  addTimeBlock: (timeBlock) => set((state) => ({
    mainTree: {
      ...state.mainTree,
      timeBlocks: [...state.mainTree.timeBlocks, timeBlock]
    },
    lastUpdated: new Date().toISOString()
  })),
  
  // Update a time block
  updateTimeBlock: (id, updates) => set((state) => ({
    mainTree: {
      ...state.mainTree,
      timeBlocks: state.mainTree.timeBlocks.map(block =>
        block.id === id ? { ...block, ...updates } : block
      )
    },
    lastUpdated: new Date().toISOString()
  })),
  
  // Remove a time block
  removeTimeBlock: (id) => set((state) => ({
    mainTree: {
      ...state.mainTree,
      timeBlocks: state.mainTree.timeBlocks.filter(block => block.id !== id)
    },
    lastUpdated: new Date().toISOString()
  })),
  
  // Add a group
  addGroup: (group) => set((state) => ({
    mainTree: {
      ...state.mainTree,
      groups: [...state.mainTree.groups, group]
    },
    lastUpdated: new Date().toISOString()
  })),
  
  // Update a group
  updateGroup: (id, updates) => set((state) => ({
    mainTree: {
      ...state.mainTree,
      groups: state.mainTree.groups.map(group =>
        group.id === id ? { ...group, ...updates } : group
      )
    },
    lastUpdated: new Date().toISOString()
  })),
  
  // Set loading state
  setLoading: (isLoading) => set({ isLoading }),
  
  // Set error state
  setError: (error) => set({ error }),

  // Track LLM activity for UI indicators
  setLLMActivity: (isActive) => set((state) => ({
    llmActivity: {
      active: isActive,
      lastStarted: isActive ? new Date().toISOString() : state.llmActivity.lastStarted
    }
  })),
  
  // Clear all data
  clearMainTree: () => set({
    mainTree: {
      preferences: null,
      myOKRTs: [],
      sharedOKRTs: [],
      notifications: [],
      timeBlocks: [],
      groups: [],
      calendar: {
        events: [],
        quarter: null
      }
    },
    sectionStates: {
      preferences: { loading: false, loaded: false, lastUpdated: null },
      myOKRTs: { loading: false, loaded: false, lastUpdated: null },
      sharedOKRTs: { loading: false, loaded: false, lastUpdated: null },
      notifications: { loading: false, loaded: false, lastUpdated: null },
      timeBlocks: { loading: false, loaded: false, lastUpdated: null },
      groups: { loading: false, loaded: false, lastUpdated: null },
      calendar: { loading: false, loaded: false, lastUpdated: null }
    },
    lastUpdated: null,
    error: null
  }),
  
  // Get unread notification count
  getUnreadNotificationCount: () => {
    const state = get();
    return state.mainTree.notifications.filter(n => !n.is_read).length;
  },
  
  // Get time blocks for a specific date
  getTimeBlocksForDate: (date) => {
    const state = get();
    return state.mainTree.timeBlocks.filter(block => {
      const blockDate = new Date(block.start_time).toISOString().split('T')[0];
      return blockDate === date;
    });
  }
}),
      {
        name: 'main-tree-storage', // unique name for localStorage key
        storage: createJSONStorage(() => localStorage),
        // Only persist the mainTree data, not loading/error states
        partialize: (state) => ({
          mainTree: state.mainTree,
          lastUpdated: state.lastUpdated,
          sectionStates: state.sectionStates
        })
      }
    )
  )
);

export default useMainTreeStore;
