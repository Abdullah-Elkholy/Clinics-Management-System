'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface SidebarWidthContextType {
  customWidth: number | null;
  setCustomWidth: (width: number | null) => void;
}

const SidebarWidthContext = createContext<SidebarWidthContextType | undefined>(undefined);

export function SidebarWidthProvider({ children }: { children: ReactNode }) {
  const [customWidth, setCustomWidth] = useState<number | null>(null);

  return (
    <SidebarWidthContext.Provider value={{ customWidth, setCustomWidth }}>
      {children}
    </SidebarWidthContext.Provider>
  );
}

export function useSidebarWidth() {
  const context = useContext(SidebarWidthContext);
  if (!context) {
    throw new Error('useSidebarWidth must be used within SidebarWidthProvider');
  }
  return context;
}
