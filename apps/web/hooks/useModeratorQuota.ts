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

  // Fetch quota on mount or when moderatorId changes
  useEffect(() => {
    const fetchQuota = async () => {
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
          const is405Error = result.error?.includes('405') || result.error?.includes('Method Not Allowed');
          setState((prev) => ({
            ...prev,
            loading: false,
            error: is405Error ? null : (result.error || 'Failed to fetch quota'),
          }));
        }
      } catch (error) {
        // Silently handle 405 errors
        const errorMsg = error instanceof Error ? error.message : 'Failed to fetch quota';
        const is405Error = errorMsg.includes('405') || errorMsg.includes('Method Not Allowed');
        setState((prev) => ({
          ...prev,
          loading: false,
          error: is405Error ? null : errorMsg,
        }));
      }
    };

    if (moderatorId) {
      fetchQuota();
    }
  }, [moderatorId]);

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
          error: result.error || 'Failed to fetch quota',
        }));
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error:
          error instanceof Error ? error.message : 'Failed to fetch quota',
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
