'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

// Added portal-specific tab types to support vertical SaaS client portals
type Tab = 'generate' | 'portal-sosohan' | 'portal-insurance' | 'portal-beauty' | 'portal-studio';

interface TabContextType {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
}

const TabContext = createContext<TabContextType | undefined>(undefined);

export function TabProvider({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTab] = useState<Tab>('generate'); // Default to generation flow

  return (
    <TabContext.Provider value={{ activeTab, setActiveTab }}>
      {children}
    </TabContext.Provider>
  );
}

export function useTab() {
  const context = useContext(TabContext);
  if (context === undefined) {
    throw new Error('useTab must be used within a TabProvider');
  }
  return context;
}
