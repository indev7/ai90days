'use client';

import { create } from 'zustand';

const useAimeStore = create((set) => ({
  messages: [],
  isLoading: false,
  pendingMessage: null,
  addMessage: (message) => {
    set((state) => {
      const updated = [...state.messages, message];
      return { messages: updated.slice(-20) };
    });
  },
  updateMessage: (messageId, updates) => {
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === messageId ? { ...msg, ...updates } : msg
      )
    }));
  },
  clearMessages: () => set({ messages: [] }),
  setLoading: (loading) => set({ isLoading: loading }),
  setPendingMessage: (message) => set({ pendingMessage: message })
}));

export default useAimeStore;
