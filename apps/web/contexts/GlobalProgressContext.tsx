'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useSignalR } from './SignalRContext';
import { useAuth } from './AuthContext';
import { useUI } from './UIContext';
import { useQueue } from './QueueContext';
import messageApiClient from '@/services/api/messageApiClient';
import logger from '@/utils/logger';

/**
 * Represents a single message in an ongoing operation
 */
interface OngoingMessage {
  messageId?: string;
  patientId: number;
  patientName: string;
  countryCode: string; // Country code prefix (e.g., "+20", "+966")
  patientPhone: string;
  status: 'queued' | 'sending' | 'sent' | 'pending' | 'failed';
  isPaused: boolean;
  attempts: number;
  failedReason?: string;
}

/**
 * Represents an ongoing message sending operation
 */
interface OngoingOperation {
  sessionId: string;
  queueId: number;
  queueName: string;
  totalMessages: number;
  sentMessages: number;
  failedMessages: number;
  ongoingMessages: number;
  isPaused: boolean;
  isProcessing: boolean; // Backend-calculated: has messages with 'sending' status
  pauseReason?: string;
  startedAt: Date;
  status: string;
  messages: OngoingMessage[]; // NEW: Per-message details
}

interface GlobalProgressContextType {
  operations: OngoingOperation[];
  hasOngoingOperations: boolean;
  isLoading: boolean;
  refreshOperations: () => Promise<void>;
}

const GlobalProgressContext = createContext<GlobalProgressContextType | undefined>(undefined);

/**
 * GlobalProgressProvider
 * 
 * Maintains SignalR subscriptions across all page navigations to ensure
 * users can see progress of ongoing message sending operations from any page.
 * 
 * Key Features:
 * - Persistent SignalR listeners (don't unmount with components)
 * - Initial data load on mount
 * - Real-time updates via SessionUpdated events
 * - Auto-removal of completed sessions
 * - Deduplication to prevent duplicate API calls
 */
export const GlobalProgressProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [operations, setOperations] = useState<OngoingOperation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { connection, isConnected, on, off, onReconnected, offReconnected } = useSignalR();
  const { user, isAuthenticated } = useAuth();
  const { addToast } = useUI();
  // Get selectedModeratorId for Admin filtering (only show sessions for selected moderator)
  const { selectedModeratorId } = useQueue();
  const isLoadingRef = useRef(false);
  const isMountedRef = useRef(true);

  /**
   * Fetch current ongoing sessions from API
   * Uses deduplication to prevent concurrent requests
   */
  const refreshOperations = useCallback(async () => {
    // Prevent duplicate requests
    if (isLoadingRef.current) {
      logger.debug('GlobalProgressContext: Skipping duplicate refreshOperations call');
      return;
    }

    // Only fetch if authenticated
    if (!isAuthenticated || !user) {
      setOperations([]);
      setIsLoading(false);
      return;
    }

    try {
      isLoadingRef.current = true;
      setIsLoading(true);

      // Pass selectedModeratorId for Admin filtering (null for Moderators = their own data)
      const response = await messageApiClient.getOngoingSessions(selectedModeratorId ?? undefined);

      if (!isMountedRef.current) return;

      // API returns { success: boolean, data: OngoingSessionDto[] }
      const sessions = response.data || [];

      // Transform API response to OngoingOperation format
      const ops: OngoingOperation[] = sessions.map(session => {
        // Calculate failed count from patients with status 'failed'
        const failedCount = session.patients?.filter(p => p.status === 'failed').length || 0;
        const ongoingCount = session.total - session.sent - failedCount;

        return {
          sessionId: session.sessionId,
          queueId: session.queueId,
          queueName: session.queueName || 'غير محدد',
          totalMessages: session.total || 0,
          sentMessages: session.sent || 0,
          failedMessages: failedCount,
          ongoingMessages: ongoingCount,
          isPaused: session.status === 'paused',
          isProcessing: session.isProcessing ?? false, // Backend-calculated: has 'sending' messages
          pauseReason: undefined, // Will be populated from backend if needed
          startedAt: new Date(session.startTime),
          status: session.status || 'active',
          messages: (session.patients || []).map(patient => ({
            messageId: patient.messageId,
            patientId: patient.patientId,
            patientName: patient.name,
            countryCode: patient.countryCode,
            patientPhone: patient.phone,
            status: patient.status as 'queued' | 'sending' | 'sent' | 'pending' | 'failed',
            isPaused: patient.isPaused,
            attempts: patient.attempts || 0,
            failedReason: patient.failedReason,
          })),
        };
      });

      setOperations(ops);
      logger.debug('GlobalProgressContext: Loaded ongoing operations', { count: ops.length });
    } catch (err) {
      logger.error('GlobalProgressContext: Failed to load ongoing operations', err);
      if (isMountedRef.current) {
        setOperations([]);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
        isLoadingRef.current = false;
      }
    }
  }, [isAuthenticated, user, selectedModeratorId]);

  /**
   * Initial data load on mount
   */
  useEffect(() => {
    isMountedRef.current = true;
    refreshOperations();

    return () => {
      isMountedRef.current = false;
    };
  }, [refreshOperations]);

  /**
   * GLOBAL SignalR Listener - Persists across page navigation
   * This is the key difference from component-scoped listeners
   */
  useEffect(() => {
    if (!connection || !isConnected) return;

    /**
     * Handle SessionUpdated events from SignalR
     * Updates or adds/removes operations based on session state
     */
    const handleSessionUpdate = (payload: any) => {
      logger.debug('GlobalProgressContext: Received SessionUpdated event', payload);

      setOperations(prev => {
        const index = prev.findIndex(op => op.sessionId === payload.id);

        // Session completed - remove from list
        if (payload.status === 'completed') {
          if (index !== -1) {
            const completedSession = prev[index];
            logger.info('GlobalProgressContext: Session completed, removing from list', {
              sessionId: payload.id,
              queueName: completedSession.queueName
            });

            // Show completion notification
            addToast(
              `اكتملت عملية الإرسال لقائمة "${completedSession.queueName}" (${completedSession.sentMessages}/${completedSession.totalMessages} رسالة)`,
              'success'
            );

            const updated = [...prev];
            updated.splice(index, 1);
            return updated;
          }
          return prev; // Already removed
        }

        // New session started
        if (index === -1) {
          logger.info('GlobalProgressContext: New session detected', {
            sessionId: payload.id,
            totalMessages: payload.totalMessages
          });

          return [...prev, {
            sessionId: payload.id,
            queueId: payload.queueId || 0,
            queueName: payload.queueName || 'غير محدد',
            totalMessages: payload.totalMessages || 0,
            sentMessages: payload.sentMessages || 0,
            failedMessages: payload.failedMessages || 0,
            ongoingMessages: payload.ongoingMessages || 0,
            isPaused: payload.isPaused || false,
            isProcessing: payload.isProcessing ?? false, // Backend-calculated
            pauseReason: payload.pauseReason,
            startedAt: new Date(),
            status: payload.status || 'active',
            messages: [] // Will be populated by refresh
          }];
        }

        // Update existing session
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          sentMessages: payload.sentMessages ?? updated[index].sentMessages,
          failedMessages: payload.failedMessages ?? updated[index].failedMessages,
          ongoingMessages: payload.ongoingMessages ?? updated[index].ongoingMessages,
          isPaused: payload.isPaused ?? updated[index].isPaused,
          isProcessing: payload.isProcessing ?? updated[index].isProcessing, // Backend-calculated
          pauseReason: payload.pauseReason ?? updated[index].pauseReason,
          status: payload.status ?? updated[index].status,
          messages: updated[index].messages // Preserve existing messages array
        };

        return updated;
      });
    };

    /**
     * Handle MessageUpdated events
     * Triggers refresh to get latest counts (debounced by component)
     */
    const handleMessageUpdate = (payload: any) => {
      logger.debug('GlobalProgressContext: Received MessageUpdated event', payload);
      // Message updates affect session counters, but SessionUpdated should fire
      // We don't need to do anything here - SessionUpdated will handle it
    };

    // Subscribe to SignalR events
    on('SessionUpdated', handleSessionUpdate);
    on('MessageUpdated', handleMessageUpdate);

    logger.debug('GlobalProgressContext: SignalR listeners registered');

    // Cleanup subscriptions on unmount or connection change
    return () => {
      off('SessionUpdated', handleSessionUpdate);
      off('MessageUpdated', handleMessageUpdate);
      logger.debug('GlobalProgressContext: SignalR listeners unregistered');
    };
  }, [connection, isConnected, on, off]);

  /**
   * State Refresh After Reconnection
   * When SignalR reconnects after network drop, refresh all operations
   * to ensure UI shows latest state (missed events during disconnection)
   */
  useEffect(() => {
    if (!connection || !isConnected) return;

    const handleReconnected = () => {
      logger.info('GlobalProgressContext: SignalR reconnected - refreshing state');
      refreshOperations();
    };

    // Register reconnection callback
    onReconnected(handleReconnected);

    logger.debug('GlobalProgressContext: Reconnection handler registered');

    // Cleanup on unmount
    return () => {
      offReconnected(handleReconnected);
      logger.debug('GlobalProgressContext: Reconnection handler unregistered');
    };
  }, [connection, isConnected, onReconnected, offReconnected, refreshOperations]);

  const hasOngoingOperations = operations.length > 0;

  const value: GlobalProgressContextType = {
    operations,
    hasOngoingOperations,
    isLoading,
    refreshOperations
  };

  return (
    <GlobalProgressContext.Provider value={value}>
      {children}
    </GlobalProgressContext.Provider>
  );
};

/**
 * Hook to access global progress context
 * @throws Error if used outside GlobalProgressProvider
 */
export const useGlobalProgress = (): GlobalProgressContextType => {
  const context = useContext(GlobalProgressContext);
  if (!context) {
    throw new Error('useGlobalProgress must be used within GlobalProgressProvider');
  }
  return context;
};
