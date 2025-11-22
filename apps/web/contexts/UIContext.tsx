'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { Toast } from '../types';

interface UIContextType {
  toasts: Toast[];
  addToast: (message: string, type: 'success' | 'error' | 'info' | 'warning', debugData?: Record<string, any>) => void;
  removeToast: (id: string) => void;
  currentPanel: 'messages' | 'management' | 'welcome' | 'ongoing' | 'failed' | 'completed';
  setCurrentPanel: (panel: 'messages' | 'management' | 'welcome' | 'ongoing' | 'failed' | 'completed') => void;
  selectedQueueId: string | null;
  setSelectedQueueId: (id: string | null) => void;
  isTransitioning: boolean;
}

const UIContext = createContext<UIContextType | null>(null);

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const router = useRouter();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [currentPanel, setCurrentPanel] = useState<'messages' | 'management' | 'welcome' | 'ongoing' | 'failed' | 'completed'>('welcome');
  const [selectedQueueId, setSelectedQueueId] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const toastCounterRef = React.useRef(0);
  const transitionTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const navigationTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Restore selectedQueueId from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('selectedQueueId');
    if (stored) {
      setSelectedQueueId(stored);
    }
  }, []);

  // Persist selectedQueueId to localStorage whenever it changes
  useEffect(() => {
    if (selectedQueueId) {
      localStorage.setItem('selectedQueueId', selectedQueueId);
    } else {
      localStorage.removeItem('selectedQueueId');
    }
  }, [selectedQueueId]);

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

    // Parse URL to determine panel - no loading transition needed
    // New route structure: /home, /messages, /management, /queues/{dashboard|ongoing|failed|completed}
    // Use functional updates to avoid stale closure issues
    if (pathname === '/home') {
      setCurrentPanel(prev => {
        if (prev !== 'welcome') return 'welcome';
        return prev;
      });
      // Clear queue selection when on home
      setSelectedQueueId(prev => {
        if (prev !== null) return null;
        return prev;
      });
    } else if (pathname === '/messages') {
      setCurrentPanel(prev => {
        if (prev !== 'messages') return 'messages';
        return prev;
      });
      // Clear queue selection
      setSelectedQueueId(prev => {
        if (prev !== null) return null;
        return prev;
      });
    } else if (pathname === '/management') {
      setCurrentPanel(prev => {
        if (prev !== 'management') return 'management';
        return prev;
      });
      // Clear queue selection
      setSelectedQueueId(prev => {
        if (prev !== null) return null;
        return prev;
      });
    } else if (pathname.startsWith('/queues/')) {
      // Queue routes: /queues/dashboard, /queues/ongoing, /queues/failed, /queues/completed
      const match = pathname.match(/^\/queues\/(dashboard|ongoing|failed|completed)$/);
      if (match) {
        const subPanel = match[1];
        let targetPanel: 'welcome' | 'ongoing' | 'failed' | 'completed' = 'welcome';
        if (subPanel === 'dashboard') {
          targetPanel = 'welcome';
        } else if (subPanel === 'ongoing') {
          targetPanel = 'ongoing';
        } else if (subPanel === 'failed') {
          targetPanel = 'failed';
        } else if (subPanel === 'completed') {
          targetPanel = 'completed';
        }
        
        setCurrentPanel(prev => {
          if (prev !== targetPanel) return targetPanel;
          return prev;
        });
        
        // Queue routes require a selected queue - restore from localStorage if needed
        if (!selectedQueueId) {
          const stored = localStorage.getItem('selectedQueueId');
          if (stored) {
            setSelectedQueueId(stored);
          }
        }
      }
    }
    
    // Reset flag after URL sync completes
    transitionTimeoutRef.current = setTimeout(() => {
      isUpdatingFromUrl.current = false;
    }, 50);

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
  const handleSetCurrentPanel = useCallback((panel: 'messages' | 'management' | 'welcome' | 'ongoing' | 'failed' | 'completed') => {
    // Authentication check for management panel
    if (panel === 'management') {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (!token) {
        // Don't allow navigation to management without authentication
        return;
      }
    }
    
    // Panels that don't require a queue - clear queue selection first
    // Note: 'welcome' panel represents queue dashboard, so it DOES require a queue
    const panelsWithoutQueue = ['messages', 'management'];
    const shouldClearQueue = panelsWithoutQueue.includes(panel) && selectedQueueId !== null;
    
    // Calculate target path first to check if URL needs updating
    // New route structure: /home, /messages, /management, /queues/{dashboard|ongoing|failed|completed}
    let targetPath = '/home';
    if (panel === 'messages') {
      targetPath = '/messages';
    } else if (panel === 'management') {
      targetPath = '/management';
    } else if (panel === 'welcome') {
      // Welcome panel always navigates to /queues/dashboard
      targetPath = '/queues/dashboard';
    } else if (panel === 'ongoing') {
      targetPath = '/queues/ongoing';
    } else if (panel === 'failed') {
      targetPath = '/queues/failed';
    } else if (panel === 'completed') {
      targetPath = '/queues/completed';
    } else {
      targetPath = '/home';
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
    
    // Mark that we're about to navigate - prevent URL sync effect from running
    lastPathnameRef.current = targetPath;
    isUpdatingFromUrl.current = true;
    isNavigatingProgrammatically.current = true;
    
    // Show loading during navigation
    setIsTransitioning(true);
    
    // Clear queue selection if needed (for panels that don't use queues)
    if (shouldClearQueue) {
      setSelectedQueueId(prev => {
        if (prev !== null) return null;
        return prev;
      });
    }
    
    // Update panel state immediately (only if different)
    if (currentPanel !== panel) {
      setCurrentPanel(panel);
    }
    
    // Navigate to target path if needed
    if (pathname !== targetPath) {
      router.push(targetPath);
    }
    
    // Clear any existing navigation timeout
    if (navigationTimeoutRef.current) {
      clearTimeout(navigationTimeoutRef.current);
    }
    
    // Hide loading after navigation completes and component renders
    navigationTimeoutRef.current = setTimeout(() => {
      setIsTransitioning(false);
    }, 400);
    
    // Reset flags after a longer delay to ensure URL has propagated
    transitionTimeoutRef.current = setTimeout(() => {
      isUpdatingFromUrl.current = false;
      isNavigatingProgrammatically.current = false;
    }, 200);
  }, [router, selectedQueueId, currentPanel, pathname]);

  // Enhanced setSelectedQueueId that updates URL
  const handleSetSelectedQueueId = useCallback((id: string | null) => {
    // Calculate target path based on current panel and new queue selection
    let targetPath = '/home';
    
    if (id !== null) {
      // Queue selected - determine which queue panel to show based on current panel
      if (currentPanel === 'ongoing') {
        targetPath = '/queues/ongoing';
      } else if (currentPanel === 'failed') {
        targetPath = '/queues/failed';
      } else if (currentPanel === 'completed') {
        targetPath = '/queues/completed';
      } else {
        // Default to dashboard for queue
        targetPath = '/queues/dashboard';
      }
    } else {
      // No queue selected - go to home
      targetPath = '/home';
    }
    
    // Prevent updates only if both state AND URL are already at target
    if (selectedQueueId === id && pathname === targetPath) {
      return;
    }
    
    // Clear any existing transition timeout
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
    }
    
    // Mark that we're about to navigate - prevent URL sync effect from running
    lastPathnameRef.current = targetPath;
    isUpdatingFromUrl.current = true;
    isNavigatingProgrammatically.current = true;
    
    // Show loading during queue selection navigation
    setIsTransitioning(true);
    
    // When selecting a queue, also set panel to 'welcome' (queue dashboard) if not already on a queue panel
    if (id !== null) {
      const queuePanels = ['welcome', 'ongoing', 'failed', 'completed'];
      if (!queuePanels.includes(currentPanel)) {
        setCurrentPanel('welcome');
      }
    } else {
      // Clearing queue selection - return to welcome home panel
      if (currentPanel !== 'messages' && currentPanel !== 'management') {
        setCurrentPanel('welcome');
      }
    }
    
    // Update state immediately (only if different)
    if (selectedQueueId !== id) {
      setSelectedQueueId(id);
    }
    
    // Navigate to target path if needed
    if (pathname !== targetPath) {
      router.push(targetPath);
    }
    
    // Clear any existing navigation timeout
    if (navigationTimeoutRef.current) {
      clearTimeout(navigationTimeoutRef.current);
    }
    
    // Hide loading after navigation completes
    navigationTimeoutRef.current = setTimeout(() => {
      setIsTransitioning(false);
    }, 400);
    
    // Reset flags after a longer delay to ensure URL has propagated
    transitionTimeoutRef.current = setTimeout(() => {
      isUpdatingFromUrl.current = false;
      isNavigatingProgrammatically.current = false;
    }, 200);
  }, [router, selectedQueueId, pathname, currentPanel]);

  // Cleanup transition timeout on unmount
  useEffect(() => {
    return () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
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
