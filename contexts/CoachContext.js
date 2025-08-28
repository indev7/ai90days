'use client';

import { createContext, useContext, useState } from 'react';

const CoachContext = createContext();

export function CoachProvider({ children }) {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const addMessage = (message) => {
    setMessages(prev => {
      const updated = [...prev, message];
      // Keep only last 10 turns (20 messages max - 10 user + 10 assistant)
      return updated.slice(-20);
    });
  };

  const updateMessage = (messageId, updates) => {
    setMessages(prev => 
      prev.map(msg => 
        msg.id === messageId ? { ...msg, ...updates } : msg
      )
    );
  };

  const clearMessages = () => {
    setMessages([]);
  };

  const setLoading = (loading) => {
    setIsLoading(loading);
  };

  return (
    <CoachContext.Provider value={{
      messages,
      addMessage,
      updateMessage,
      clearMessages,
      isLoading,
      setLoading
    }}>
      {children}
    </CoachContext.Provider>
  );
}

export function useCoach() {
  const context = useContext(CoachContext);
  if (!context) {
    throw new Error('useCoach must be used within a CoachProvider');
  }
  return context;
}
