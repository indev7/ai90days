import { create } from 'zustand';

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

const useMainTreeStore = create((set, get) => ({
  // Main tree data structure
  mainTree: {
    myOKRTs: [],
    sharedOKRTs: [],
    notifications: [],
    timeBlocks: [],
    groups: []
  },
  
  // Loading states
  isLoading: false,
  error: null,
  lastUpdated: null,
  
  // Actions
  setMainTree: (tree) => set({ 
    mainTree: tree,
    lastUpdated: new Date().toISOString()
  }),
  
  setMyOKRTs: (okrts) => set((state) => ({
    mainTree: {
      ...state.mainTree,
      myOKRTs: okrts
    },
    lastUpdated: new Date().toISOString()
  })),
  
  setSharedOKRTs: (okrts) => set((state) => ({
    mainTree: {
      ...state.mainTree,
      sharedOKRTs: okrts
    },
    lastUpdated: new Date().toISOString()
  })),
  
  setNotifications: (notifications) => set((state) => ({
    mainTree: {
      ...state.mainTree,
      notifications: notifications
    },
    lastUpdated: new Date().toISOString()
  })),
  
  setTimeBlocks: (timeBlocks) => set((state) => ({
    mainTree: {
      ...state.mainTree,
      timeBlocks: timeBlocks
    },
    lastUpdated: new Date().toISOString()
  })),
  
  setGroups: (groups) => set((state) => ({
    mainTree: {
      ...state.mainTree,
      groups: groups
    },
    lastUpdated: new Date().toISOString()
  })),
  
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
  
  // Clear all data
  clearMainTree: () => set({
    mainTree: {
      myOKRTs: [],
      sharedOKRTs: [],
      notifications: [],
      timeBlocks: [],
      groups: []
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
}));

export default useMainTreeStore;