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
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [isHydrated, setIsHydrated] = useState(false);

  // Initialize from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (stored !== null) {
      setIsCollapsed(JSON.parse(stored));
    }
    setIsHydrated(true);
  }, []);

  // Save to localStorage when state changes
  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => {
      const newState = !prev;
      localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify(newState));
      return newState;
    });
  }, []);

  // For manual setting
  const setCollapsed = useCallback((collapsed: boolean) => {
    setIsCollapsed(collapsed);
    localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify(collapsed));
  }, []);

  return {
    isCollapsed,
    toggleCollapse,
    setCollapsed,
    isHydrated,
  };
}
