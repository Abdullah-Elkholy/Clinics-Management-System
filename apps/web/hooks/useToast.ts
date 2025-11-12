/**
 * Toast Hook - Provides global notifications
 * 
 * Currently a minimal implementation that can be consumed by contexts.
 * The actual toast rendering is handled by a UIProvider or similar component.
 */

'use client';

import { useCallback } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface UseToastReturn {
  /**
   * Show a toast notification
   * @param message - Toast message to display
   * @param type - Type of notification (success, error, info, warning)
   */
  toast?: (message: string, type?: ToastType) => void;
}

/**
 * Hook to show toast notifications
 * 
 * @example
 * const { toast } = useToast();
 * toast?.('Operation successful', 'success');
 * 
 * @returns Object with optional toast function (gracefully handles if not available)
 */
export function useToast(): UseToastReturn {
  const toast = useCallback((message: string, type: ToastType = 'info') => {
    // Try to dispatch custom event for toast system
    if (typeof window !== 'undefined') {
      try {
        const event = new CustomEvent('showToast', {
          detail: { message, type },
        });
        window.dispatchEvent(event);
      } catch (error) {
        // Fallback: log to console if toast system not available
        console.log(`[Toast - ${type.toUpperCase()}]:`, message);
      }
    }
  }, []);

  return { toast };
}

export default useToast;
