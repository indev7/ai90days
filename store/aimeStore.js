'use client';

import { create } from 'zustand';
const DEFAULT_AIME_PERSONALITY_ID = 1;

const useAimeStore = create((set) => ({
  messages: [],
  isLoading: false,
  pendingMessage: null,
  selectedPersonalityId: DEFAULT_AIME_PERSONALITY_ID,
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
  setPendingMessage: (message) => set({ pendingMessage: message }),
  setSelectedPersonalityId: (personalityId) => set({ selectedPersonalityId: personalityId })
}));

export default useAimeStore;
