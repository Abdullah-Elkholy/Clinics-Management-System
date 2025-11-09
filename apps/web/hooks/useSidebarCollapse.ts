/**
 * useSidebarCollapse Hook
 * 
 * Manages sidebar collapse/expand state with persistent localStorage
 * Provides smooth transitions and accessibility features
 * 
 * @example
 * const { isCollapsed, toggleCollapse } = useSidebarCollapse();
 */

import { useState, useEffect, useCallback } from 'react';

const SIDEBAR_STORAGE_KEY = 'clinic-sidebar-collapsed';

export function useSidebarCollapse(defaultCollapsed: boolean = false) {
  // Persisted user preference for collapse
  const [userCollapsed, setUserCollapsed] = useState(defaultCollapsed);
  const [isHydrated, setIsHydrated] = useState(false);

  // Initialize from localStorage on mount
  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(SIDEBAR_STORAGE_KEY) : null;
    if (stored !== null) {
      try {
        setUserCollapsed(JSON.parse(stored));
      } catch {
        setUserCollapsed(defaultCollapsed);
      }
    } else {
      // No stored preference: default to collapsed on small screens, else use provided default
      if (typeof window !== 'undefined' && window.innerWidth < 1024) {
        setUserCollapsed(true);
      } else {
        setUserCollapsed(defaultCollapsed);
      }
    }

    setIsHydrated(true);
  }, [defaultCollapsed]);

  // Save to localStorage when state changes
  const toggleCollapse = useCallback(() => {
    setUserCollapsed((prev) => {
      const newState = !prev;
      localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify(newState));
      return newState;
    });
  }, []);

  // For manual setting
  const setCollapsed = useCallback((collapsed: boolean) => {
    setUserCollapsed(collapsed);
    localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify(collapsed));
  }, []);

  // Effective collapse strictly follows user preference; on small screens the expanded width is smaller
  const isCollapsed = userCollapsed;

  return {
    isCollapsed,
    toggleCollapse,
    setCollapsed,
    isHydrated,
  };
}
