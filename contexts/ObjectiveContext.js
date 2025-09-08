'use client';

import { createContext, useContext, useState } from 'react';

const ObjectiveContext = createContext();

export function ObjectiveProvider({ children }) {
  const [selectedObjectiveId, setSelectedObjectiveId] = useState(null);

  return (
    <ObjectiveContext.Provider 
      value={{ 
        selectedObjectiveId, 
        setSelectedObjectiveId 
      }}
    >
      {children}
    </ObjectiveContext.Provider>
  );
}

export function useObjective() {
  const context = useContext(ObjectiveContext);
  if (!context) {
    throw new Error('useObjective must be used within an ObjectiveProvider');
  }
  return context;
}
