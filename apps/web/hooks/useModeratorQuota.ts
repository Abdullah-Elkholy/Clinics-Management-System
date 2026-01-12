'use client';

import { useState, useCallback, useEffect } from 'react';
import { ModeratorQuota } from '@/types/user';
import moderatorQuotaService from '@/services/moderatorQuotaService';

interface UseModeratorQuotaState {
  quota: ModeratorQuota | null;
  loading: boolean;
  error: string | null;
}

/**
 * useModeratorQuota - Hook for managing moderator quota
 * Provides quota fetching, updating, and usage tracking
 */
export function useModeratorQuota(moderatorId: string) {
  const [state, setState] = useState<UseModeratorQuotaState>({
    quota: null,
    loading: true,
    error: null,
  });

  // Fetch quota function
  const fetchQuota = useCallback(async () => {
    // Skip if moderatorId is invalid (e.g., '0' placeholder)
    if (!moderatorId || moderatorId === '0') {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: null,
        quota: null,
      }));
      return;
    }
    
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const result = await moderatorQuotaService.getQuota(moderatorId);
      if (result.success && result.data) {
        setState((prev) => ({
          ...prev,
          quota: result.data,
          loading: false,
        }));
      } else {
        // Silently handle 405 errors (Method Not Allowed) - might be a routing issue
        // Also handle 401/403 gracefully for non-admin users
        const is405Error = result.error?.includes('405') || result.error?.includes('Method Not Allowed');
        const is403Error = result.error?.includes('403') || result.error?.includes('Forbidden');
        const is401Error = result.error?.includes('401') || result.error?.includes('Unauthorized');
        setState((prev) => ({
          ...prev,
          loading: false,
          error: (is405Error || is403Error || is401Error) ? null : (result.error || 'فشل تحميل الحصة'),
        }));
      }
    } catch (error) {
      // Silently handle 405, 401, 403 errors
      const errorMsg = error instanceof Error ? error.message : 'فشل تحميل الحصة';
      const is405Error = errorMsg.includes('405') || errorMsg.includes('Method Not Allowed');
      const is403Error = errorMsg.includes('403') || errorMsg.includes('Forbidden');
      const is401Error = errorMsg.includes('401') || errorMsg.includes('Unauthorized');
      setState((prev) => ({
        ...prev,
        loading: false,
        error: (is405Error || is403Error || is401Error) ? null : errorMsg,
      }));
    }
  }, [moderatorId]);

  // Fetch quota on mount or when moderatorId changes
  useEffect(() => {
    if (moderatorId) {
      fetchQuota();
    }
  }, [moderatorId, fetchQuota]);

  // Listen for quota data updates
  useEffect(() => {
    const handleQuotaUpdate = () => {
      if (moderatorId) {
        fetchQuota();
      }
    };
    
    window.addEventListener('quotaDataUpdated', handleQuotaUpdate);
    return () => {
      window.removeEventListener('quotaDataUpdated', handleQuotaUpdate);
    };
  }, [moderatorId, fetchQuota]);

  // Update quota
  const updateQuota = useCallback(
    async (updates: Partial<ModeratorQuota>): Promise<boolean> => {
      setState((prev) => ({ ...prev, error: null }));
      try {
        const result = await moderatorQuotaService.updateQuota(
          moderatorId,
          updates
        );
        if (result.success && result.data) {
          setState((prev) => ({
            ...prev,
            quota: result.data,
          }));
          return true;
        } else {
          setState((prev) => ({
            ...prev,
            error: result.error || 'Failed to update quota',
          }));
          return false;
        }
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : 'Failed to update quota';
        setState((prev) => ({
          ...prev,
          error: errorMsg,
        }));
        return false;
      }
    },
    [moderatorId]
  );

  // Add usage (messages or queues)
  const addUsage = useCallback(
    async (type: 'messages' | 'queues', amount: number): Promise<boolean> => {
      setState((prev) => ({ ...prev, error: null }));
      try {
        const result = await moderatorQuotaService.addUsage(
          moderatorId,
          type,
          amount
        );
        if (result.success && result.data) {
          setState((prev) => ({
            ...prev,
            quota: result.data,
          }));
          return true;
        } else {
          setState((prev) => ({
            ...prev,
            error: result.error || 'Failed to add usage',
          }));
          return false;
        }
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : 'Failed to add usage';
        setState((prev) => ({
          ...prev,
          error: errorMsg,
        }));
        return false;
      }
    },
    [moderatorId]
  );

  // Check if moderator can perform action
  const canPerformAction = useCallback(
    async (type: 'messages' | 'queues'): Promise<boolean> => {
      return moderatorQuotaService.canPerformAction(moderatorId, type);
    },
    [moderatorId]
  );

  // Refresh quota
  const refresh = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const result = await moderatorQuotaService.getQuota(moderatorId);
      if (result.success && result.data) {
        setState((prev) => ({
          ...prev,
          quota: result.data,
          loading: false,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: result.error || 'فشل تحميل الحصة',
        }));
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error:
          error instanceof Error ? error.message : 'فشل تحميل الحصة',
      }));
    }
  }, [moderatorId]);

  return {
    ...state,
    updateQuota,
    addUsage,
    canPerformAction,
    refresh,
  };
}
