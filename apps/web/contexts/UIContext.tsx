'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import type { Toast } from '../types';

interface UIContextType {
  toasts: Toast[];
  addToast: (message: string, type: 'success' | 'error' | 'info' | 'warning', debugData?: Record<string, any>) => void;
  removeToast: (id: string) => void;
  currentPanel: 'messages' | 'management' | 'welcome' | 'ongoing' | 'failed' | 'done';
  setCurrentPanel: (panel: 'messages' | 'management' | 'welcome' | 'ongoing' | 'failed' | 'done') => void;
  selectedQueueId: string | null;
  setSelectedQueueId: (id: string | null) => void;
}

const UIContext = createContext<UIContextType | null>(null);

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [currentPanel, setCurrentPanel] = useState<'messages' | 'management' | 'welcome' | 'ongoing' | 'failed' | 'done'>('welcome');
  const [selectedQueueId, setSelectedQueueId] = useState<string | null>(null);
  const toastCounterRef = React.useRef(0);

  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning', debugData?: Record<string, any>) => {
    const id = `${Date.now()}-${++toastCounterRef.current}`;
    const toast: Toast = { id, message, type, debugData };
    setToasts((prev) => [...prev, toast]);

    setTimeout(() => {
      removeToast(id);
    }, 3000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <UIContext.Provider
      value={{
        toasts,
        addToast,
        removeToast,
        currentPanel,
        setCurrentPanel,
        selectedQueueId,
        setSelectedQueueId,
      }}
    >
      {children}
    </UIContext.Provider>
  );
};

export const useUI = () => {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error('useUI must be used within UIProvider');
  }
  return context;
};
