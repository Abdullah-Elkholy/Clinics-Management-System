'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
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
  const pathname = usePathname();
  const router = useRouter();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [currentPanel, setCurrentPanel] = useState<'messages' | 'management' | 'welcome' | 'ongoing' | 'failed' | 'done'>('welcome');
  const [selectedQueueId, setSelectedQueueId] = useState<string | null>(null);
  const toastCounterRef = React.useRef(0);

  // Sync state with URL on mount and pathname changes
  // Use ref to prevent infinite loops when state updates trigger URL changes
  const isUpdatingFromUrl = React.useRef(false);
  
  useEffect(() => {
    if (!pathname || isUpdatingFromUrl.current) return;
    
    isUpdatingFromUrl.current = true;

    // Parse URL to determine panel and queue
    if (pathname === '/messages') {
      if (currentPanel !== 'messages' || selectedQueueId !== null) {
        setCurrentPanel('messages');
        setSelectedQueueId(null);
      }
    } else if (pathname === '/management') {
      if (currentPanel !== 'management' || selectedQueueId !== null) {
        setCurrentPanel('management');
        setSelectedQueueId(null);
      }
    } else if (pathname.startsWith('/queues/')) {
      const match = pathname.match(/^\/queues\/(\d+)(?:\/(ongoing|failed|done))?$/);
      if (match) {
        const queueId = match[1];
        const subPanel = match[2];
        let targetPanel: 'welcome' | 'ongoing' | 'failed' | 'done' = 'welcome';
        if (subPanel === 'ongoing') {
          targetPanel = 'ongoing';
        } else if (subPanel === 'failed') {
          targetPanel = 'failed';
        } else if (subPanel === 'done') {
          targetPanel = 'done';
        }
        
        if (selectedQueueId !== queueId || currentPanel !== targetPanel) {
          setSelectedQueueId(queueId);
          setCurrentPanel(targetPanel);
        }
      }
    } else if (pathname === '/') {
      if (currentPanel !== 'welcome' || selectedQueueId !== null) {
        setCurrentPanel('welcome');
        setSelectedQueueId(null);
      }
    }
    
    // Reset flag after a short delay to allow state updates
    setTimeout(() => {
      isUpdatingFromUrl.current = false;
    }, 100);
  }, [pathname, currentPanel, selectedQueueId]);

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

  // Enhanced setCurrentPanel that updates URL
  const handleSetCurrentPanel = useCallback((panel: 'messages' | 'management' | 'welcome' | 'ongoing' | 'failed' | 'done') => {
    // Prevent updates if already at target state
    if (currentPanel === panel) return;
    
    setCurrentPanel(panel);
    isUpdatingFromUrl.current = true; // Prevent URL sync from triggering state update
    
    // Update URL based on panel
    if (panel === 'messages') {
      router.push('/messages');
    } else if (panel === 'management') {
      router.push('/management');
    } else if (selectedQueueId) {
      // If we have a queue selected, navigate to appropriate queue route
      if (panel === 'ongoing') {
        router.push(`/queues/${selectedQueueId}/ongoing`);
      } else if (panel === 'failed') {
        router.push(`/queues/${selectedQueueId}/failed`);
      } else if (panel === 'done') {
        router.push(`/queues/${selectedQueueId}/done`);
      } else {
        router.push(`/queues/${selectedQueueId}`);
      }
    } else if (panel === 'welcome') {
      router.push('/');
    }
    
    setTimeout(() => {
      isUpdatingFromUrl.current = false;
    }, 100);
  }, [router, selectedQueueId, currentPanel]);

  // Enhanced setSelectedQueueId that updates URL
  const handleSetSelectedQueueId = useCallback((id: string | null) => {
    // Prevent updates if already at target state
    if (selectedQueueId === id) return;
    
    setSelectedQueueId(id);
    isUpdatingFromUrl.current = true; // Prevent URL sync from triggering state update
    
    if (id) {
      // Navigate to queue dashboard
      router.push(`/queues/${id}`);
    } else {
      // If deselecting queue, go to welcome screen
      router.push('/');
    }
    
    setTimeout(() => {
      isUpdatingFromUrl.current = false;
    }, 100);
  }, [router, selectedQueueId]);

  return (
    <UIContext.Provider
      value={{
        toasts,
        addToast,
        removeToast,
        currentPanel,
        setCurrentPanel: handleSetCurrentPanel,
        selectedQueueId,
        setSelectedQueueId: handleSetSelectedQueueId,
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
