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
  isTransitioning: boolean;
}

const UIContext = createContext<UIContextType | null>(null);

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const router = useRouter();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [currentPanel, setCurrentPanel] = useState<'messages' | 'management' | 'welcome' | 'ongoing' | 'failed' | 'done'>('welcome');
  const [selectedQueueId, setSelectedQueueId] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const toastCounterRef = React.useRef(0);
  const transitionTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Sync state with URL on mount and pathname changes
  // Use ref to prevent infinite loops when state updates trigger URL changes
  const isUpdatingFromUrl = React.useRef(false);
  const lastPathnameRef = React.useRef<string | null>(null);
  const isNavigatingProgrammatically = React.useRef(false);
  
  useEffect(() => {
    // Skip if already updating or pathname hasn't changed
    // Also skip if we're in the middle of programmatic navigation
    if (!pathname || isUpdatingFromUrl.current || isNavigatingProgrammatically.current || lastPathnameRef.current === pathname) {
      return;
    }
    
    lastPathnameRef.current = pathname;
    isUpdatingFromUrl.current = true;

    // Clear any existing transition timeout
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
    }

    // Start transition - show loading when URL changes
    setIsTransitioning(true);

    // Parse URL to determine panel and queue
    // Use functional updates to avoid stale closure issues
    if (pathname === '/messages') {
      setCurrentPanel(prev => {
        if (prev !== 'messages') return 'messages';
        return prev;
      });
      setSelectedQueueId(prev => {
        if (prev !== null) return null;
        return prev;
      });
    } else if (pathname === '/management') {
      setCurrentPanel(prev => {
        if (prev !== 'management') return 'management';
        return prev;
      });
      setSelectedQueueId(prev => {
        if (prev !== null) return null;
        return prev;
      });
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
        
        setSelectedQueueId(prev => {
          if (prev !== queueId) return queueId;
          return prev;
        });
        setCurrentPanel(prev => {
          if (prev !== targetPanel) return targetPanel;
          return prev;
        });
      }
    } else if (pathname === '/') {
      setCurrentPanel(prev => {
        if (prev !== 'welcome') return 'welcome';
        return prev;
      });
      setSelectedQueueId(prev => {
        if (prev !== null) return null;
        return prev;
      });
    }
    
    // End transition after a brief delay to allow panel to render
    // Reduced timeout for faster response
    transitionTimeoutRef.current = setTimeout(() => {
      setIsTransitioning(false);
      // Reset flag after navigation completes
      setTimeout(() => {
        isUpdatingFromUrl.current = false;
      }, 50);
    }, 150);

    return () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, [pathname]); // Only depend on pathname to prevent loops

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
    // Authentication check for management panel
    if (panel === 'management') {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (!token) {
        // Don't allow navigation to management without authentication
        // The caller should handle this, but we add a safety check here
        return;
      }
    }
    
    // Panels that don't require a queue - clear queue selection first
    const panelsWithoutQueue = ['messages', 'management', 'welcome'];
    const shouldClearQueue = panelsWithoutQueue.includes(panel) && selectedQueueId !== null;
    
    // Calculate target path first to check if URL needs updating
    let targetPath = '/';
    if (panel === 'messages') {
      targetPath = '/messages';
    } else if (panel === 'management') {
      targetPath = '/management';
    } else if (selectedQueueId && !shouldClearQueue) {
      // If we have a queue selected and we're not clearing it, navigate to appropriate queue route
      if (panel === 'ongoing') {
        targetPath = `/queues/${selectedQueueId}/ongoing`;
      } else if (panel === 'failed') {
        targetPath = `/queues/${selectedQueueId}/failed`;
      } else if (panel === 'done') {
        targetPath = `/queues/${selectedQueueId}/done`;
      } else {
        targetPath = `/queues/${selectedQueueId}`;
      }
    }
    
    // Prevent updates only if both panel state AND URL are already at target AND queue state is correct
    // This ensures URL always stays in sync with panel state
    if (currentPanel === panel && pathname === targetPath && !shouldClearQueue) {
      return;
    }
    
    // Clear any existing transition timeout
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
    }
    
    // Start transition - show loading
    setIsTransitioning(true);
    isUpdatingFromUrl.current = true; // Prevent URL sync from triggering state update
    
    // Clear queue selection if needed (for panels that don't use queues)
    // Use the state setter directly to avoid triggering handleSetSelectedQueueId which would navigate to '/'
    // We'll handle the URL navigation ourselves based on the target panel
    if (shouldClearQueue) {
      // Update state directly without triggering the handler
      setSelectedQueueId(prev => {
        if (prev !== null) return null;
        return prev;
      });
    }
    
    // Update panel state (only if different)
    if (currentPanel !== panel) {
      setCurrentPanel(panel);
    }
    
    // Always update URL if it doesn't match target path
    // This ensures URL stays in sync even if panel state was already correct
    if (pathname !== targetPath) {
      // Mark that we're navigating programmatically to prevent URL sync from interfering
      isNavigatingProgrammatically.current = true;
      router.push(targetPath);
      
      // Reduced timeout for faster navigation - Next.js router is usually fast
      transitionTimeoutRef.current = setTimeout(() => {
        setIsTransitioning(false);
        // Reset flags after navigation completes
        setTimeout(() => {
          isUpdatingFromUrl.current = false;
          isNavigatingProgrammatically.current = false;
        }, 50);
      }, 150);
    } else {
      // URL already matches, just end transition quickly
      transitionTimeoutRef.current = setTimeout(() => {
        setIsTransitioning(false);
        isUpdatingFromUrl.current = false;
        isNavigatingProgrammatically.current = false;
      }, 100);
    }
  }, [router, selectedQueueId, currentPanel, pathname]);

  // Enhanced setSelectedQueueId that updates URL
  const handleSetSelectedQueueId = useCallback((id: string | null) => {
    // Calculate target path first
    const targetPath = id ? `/queues/${id}` : '/';
    
    // Prevent updates only if both state AND URL are already at target
    // This ensures URL always stays in sync with queue selection
    if (selectedQueueId === id && pathname === targetPath) {
      return;
    }
    
    // Clear any existing transition timeout
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
    }
    
    // Start transition - show loading
    setIsTransitioning(true);
    isUpdatingFromUrl.current = true; // Prevent URL sync from triggering state update
    
    // When selecting a queue, also set panel to 'welcome' (queue dashboard)
    // This prevents conflicts and ensures correct panel state
    if (id !== null) {
      // Set panel to 'welcome' for queue dashboard view
      if (currentPanel !== 'welcome' && !pathname.startsWith('/queues/')) {
        setCurrentPanel('welcome');
      }
    }
    
    // Update state (only if different)
    if (selectedQueueId !== id) {
      setSelectedQueueId(id);
    }
    
    // Always update URL if it doesn't match target path
    // This ensures URL stays in sync even if queue selection was already correct
    if (pathname !== targetPath) {
      // Mark that we're navigating programmatically to prevent URL sync from interfering
      isNavigatingProgrammatically.current = true;
      router.push(targetPath);
      
      // Reduced timeout for faster navigation
      transitionTimeoutRef.current = setTimeout(() => {
        setIsTransitioning(false);
        setTimeout(() => {
          isUpdatingFromUrl.current = false;
          isNavigatingProgrammatically.current = false;
        }, 50);
      }, 150);
    } else {
      // URL already matches, just end transition quickly
      transitionTimeoutRef.current = setTimeout(() => {
        setIsTransitioning(false);
        isUpdatingFromUrl.current = false;
        isNavigatingProgrammatically.current = false;
      }, 100);
    }
  }, [router, selectedQueueId, pathname, currentPanel]);

  // Cleanup transition timeout on unmount
  useEffect(() => {
    return () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, []);

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
        isTransitioning,
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
