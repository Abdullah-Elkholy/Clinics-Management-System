'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { Toast } from '../types';

interface UIContextType {
  toasts: Toast[];
  addToast: (message: string, type: 'success' | 'error' | 'info' | 'warning', debugData?: Record<string, any>) => void;
  removeToast: (id: string) => void;
  currentPanel: 'messages' | 'management' | 'welcome' | 'ongoing' | 'failed' | 'completed' | 'browserStatus';
  setCurrentPanel: (panel: 'messages' | 'management' | 'welcome' | 'ongoing' | 'failed' | 'completed' | 'browserStatus') => void;
  selectedQueueId: string | null;
  setSelectedQueueId: (id: string | null) => void;
  isTransitioning: boolean;
}

const UIContext = createContext<UIContextType | null>(null);

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const router = useRouter();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [currentPanel, setCurrentPanel] = useState<'messages' | 'management' | 'welcome' | 'ongoing' | 'failed' | 'completed' | 'browserStatus'>('welcome');
  const [selectedQueueId, setSelectedQueueId] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const toastCounterRef = React.useRef(0);
  const transitionTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const navigationTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const pendingPanelRef = React.useRef<'messages' | 'management' | 'welcome' | 'ongoing' | 'failed' | 'completed' | 'browserStatus' | null>(null);

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
  
  // Helper function to get path for a panel (defined before useEffect that uses it)
  const getPathForPanel = React.useCallback((panel: 'messages' | 'management' | 'welcome' | 'ongoing' | 'failed' | 'completed' | 'browserStatus'): string => {
    switch (panel) {
      case 'messages':
        return '/messages';
      case 'management':
        return '/management';
      case 'welcome':
        return '/queues/dashboard';
      case 'ongoing':
        return '/queues/ongoing';
      case 'failed':
        return '/queues/failed';
      case 'completed':
        return '/queues/completed';
      case 'browserStatus':
        return '/browser/status';
      default:
        return '/home';
    }
  }, []);
  
  useEffect(() => {
    // Skip if already updating or pathname hasn't changed
    // Also skip if we're in the middle of programmatic navigation
    if (!pathname || lastPathnameRef.current === pathname) {
      // If we have a pending panel and URL matches, activate it
      if (pendingPanelRef.current && !isUpdatingFromUrl.current && !isNavigatingProgrammatically.current) {
        const targetPath = getPathForPanel(pendingPanelRef.current);
        if (pathname === targetPath) {
          setCurrentPanel(pendingPanelRef.current);
          pendingPanelRef.current = null;
          setIsTransitioning(false);
        }
      }
      return;
    }
    
    // If we're navigating programmatically, let the navigation handler manage state
    if (isNavigatingProgrammatically.current) {
      lastPathnameRef.current = pathname;
      // Check if URL matches pending panel
      if (pendingPanelRef.current) {
        const targetPath = getPathForPanel(pendingPanelRef.current);
        if (pathname === targetPath) {
          // URL matches pending panel - activate it
          setCurrentPanel(pendingPanelRef.current);
          pendingPanelRef.current = null;
          setIsTransitioning(false);
          // Reset flags
          isNavigatingProgrammatically.current = false;
          isUpdatingFromUrl.current = false;
        } else {
          // URL doesn't match pending panel - this might be browser navigation
          // Clear pending panel and let normal URL sync handle it
          pendingPanelRef.current = null;
          isNavigatingProgrammatically.current = false;
        }
      } else {
        // No pending panel but navigating programmatically - might be browser navigation
        // Reset flag and let normal URL sync handle it
        isNavigatingProgrammatically.current = false;
      }
      // If we still have the flag set, return early
      if (isNavigatingProgrammatically.current) {
        return;
      }
    }
    
    // Browser navigation (back/forward) or direct URL access
    // Clear any pending panel since this is not programmatic navigation
    if (pendingPanelRef.current) {
      pendingPanelRef.current = null;
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
    } else if (pathname === '/browser/status') {
      setCurrentPanel(prev => {
        if (prev !== 'browserStatus') return 'browserStatus';
        return prev;
      });
      // Clear queue selection when on browser status
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
  }, [pathname, selectedQueueId, getPathForPanel]); // Only depend on pathname to prevent loops

  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning', debugData?: Record<string, any>) => {
    setToasts((prev) => {
      const now = Date.now();
      // Prevent duplicate toasts with the same message and type within 1 second
      const recentDuplicate = prev.find(
        (t) => t.message === message && t.type === type && 
        (now - parseInt(t.id.split('-')[0])) < 1000
      );
      
      if (recentDuplicate) {
        // Toast already exists, don't add duplicate
        return prev;
      }
      
      const id = `${now}-${++toastCounterRef.current}`;
      const toast: Toast = { id, message, type, debugData };
      
      // Auto-remove toast after 3 seconds
      setTimeout(() => {
        removeToast(id);
      }, 3000);
      
      return [...prev, toast];
    });
  }, [removeToast]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Enhanced setCurrentPanel that updates URL
  const handleSetCurrentPanel = useCallback((panel: 'messages' | 'management' | 'welcome' | 'ongoing' | 'failed' | 'completed' | 'browserStatus') => {
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
    const panelsWithoutQueue = ['messages', 'management', 'browserStatus'];
    const shouldClearQueue = panelsWithoutQueue.includes(panel) && selectedQueueId !== null;
    
    // Calculate target path
    const targetPath = getPathForPanel(panel);
    
    // Prevent updates only if both panel state AND URL are already at target AND queue state is correct
    // This ensures URL always stays in sync with panel state
    if (currentPanel === panel && pathname === targetPath && !shouldClearQueue) {
      return;
    }
    
    // Clear any existing transition timeout
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
    }
    if (navigationTimeoutRef.current) {
      clearTimeout(navigationTimeoutRef.current);
    }
    
    // Mark that we're about to navigate - prevent URL sync effect from running
    lastPathnameRef.current = pathname; // Keep current pathname to prevent immediate sync
    isUpdatingFromUrl.current = true;
    isNavigatingProgrammatically.current = true;
    
    // Show loading during navigation - this prevents panel from rendering before URL is ready
    setIsTransitioning(true);
    
    // Store pending panel - will be activated when URL matches
    pendingPanelRef.current = panel;
    
    // Clear queue selection if needed (for panels that don't use queues)
    if (shouldClearQueue) {
      setSelectedQueueId(prev => {
        if (prev !== null) return null;
        return prev;
      });
    }
    
    // Navigate to target path FIRST - don't update panel state yet
    if (pathname !== targetPath) {
      router.push(targetPath);
    } else {
      // URL already matches - activate panel immediately
      setCurrentPanel(panel);
      pendingPanelRef.current = null;
      setIsTransitioning(false);
      isNavigatingProgrammatically.current = false;
      isUpdatingFromUrl.current = false;
    }
    
    // Fallback timeout - if URL doesn't update within 1 second, activate panel anyway
    navigationTimeoutRef.current = setTimeout(() => {
      if (pendingPanelRef.current === panel) {
        setCurrentPanel(panel);
        pendingPanelRef.current = null;
        setIsTransitioning(false);
        isNavigatingProgrammatically.current = false;
        isUpdatingFromUrl.current = false;
      }
    }, 1000);
    
    // Reset flags after URL sync completes (handled by URL sync effect)
  }, [router, selectedQueueId, currentPanel, pathname, getPathForPanel]);

  // Enhanced setSelectedQueueId that updates URL
  const handleSetSelectedQueueId = useCallback((id: string | null) => {
    // Calculate target path based on current panel and new queue selection
    let targetPath = '/home';
    let targetPanel: 'messages' | 'management' | 'welcome' | 'ongoing' | 'failed' | 'completed' | 'browserStatus' = currentPanel;
    
    if (id !== null) {
      // Queue selected - determine which queue panel to show based on current panel
      if (currentPanel === 'ongoing') {
        targetPath = '/queues/ongoing';
        targetPanel = 'ongoing';
      } else if (currentPanel === 'failed') {
        targetPath = '/queues/failed';
        targetPanel = 'failed';
      } else if (currentPanel === 'completed') {
        targetPath = '/queues/completed';
        targetPanel = 'completed';
      } else {
        // Default to dashboard for queue
        targetPath = '/queues/dashboard';
        targetPanel = 'welcome';
      }
    } else {
      // No queue selected - go to home
      targetPath = '/home';
      targetPanel = 'welcome';
    }
    
    // Prevent updates only if both state AND URL are already at target
    if (selectedQueueId === id && pathname === targetPath) {
      return;
    }
    
    // Clear any existing transition timeout
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
    }
    if (navigationTimeoutRef.current) {
      clearTimeout(navigationTimeoutRef.current);
    }
    
    // Mark that we're about to navigate - prevent URL sync effect from running
    lastPathnameRef.current = pathname; // Keep current pathname to prevent immediate sync
    isUpdatingFromUrl.current = true;
    isNavigatingProgrammatically.current = true;
    
    // Show loading during queue selection navigation
    setIsTransitioning(true);
    
    // Store pending panel - will be activated when URL matches
    pendingPanelRef.current = targetPanel;
    
    // Update queue selection state immediately
    if (selectedQueueId !== id) {
      setSelectedQueueId(id);
    }
    
    // Navigate to target path FIRST - don't update panel state yet
    if (pathname !== targetPath) {
      router.push(targetPath);
    } else {
      // URL already matches - activate panel immediately
      setCurrentPanel(targetPanel);
      pendingPanelRef.current = null;
      setIsTransitioning(false);
      isNavigatingProgrammatically.current = false;
      isUpdatingFromUrl.current = false;
    }
    
    // Fallback timeout - if URL doesn't update within 1 second, activate panel anyway
    navigationTimeoutRef.current = setTimeout(() => {
      if (pendingPanelRef.current === targetPanel) {
        setCurrentPanel(targetPanel);
        pendingPanelRef.current = null;
        setIsTransitioning(false);
        isNavigatingProgrammatically.current = false;
        isUpdatingFromUrl.current = false;
      }
    }, 1000);
  }, [router, selectedQueueId, pathname, currentPanel, getPathForPanel]);

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
