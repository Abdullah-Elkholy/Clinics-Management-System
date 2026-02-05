'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useModal } from '@/contexts/ModalContext';
import { useUI } from '@/contexts/UIContext';
import { useQueue } from '@/contexts/QueueContext';
import { useConfirmDialog } from '@/contexts/ConfirmationContext';
import { createBulkDeleteConfirmation, createDeleteConfirmation } from '@/utils/confirmationHelpers';
import { UserRole } from '@/types/roles';
// Mock data removed - using API data instead
import { PanelWrapper } from '@/components/Common/PanelWrapper';
import { PanelHeader } from '@/components/Common/PanelHeader';
import { ResponsiveTable } from '@/components/Common/ResponsiveTable';
import { EmptyState } from '@/components/state';
import { Badge } from '@/components/Common/ResponsiveUI';
import UsageGuideSection from '@/components/Common/UsageGuideSection';
import { Patient } from '@/types';
import { messageApiClient } from '@/services/api/messageApiClient';
import { formatPhoneForDisplay } from '@/utils/phoneUtils';
import { formatLocalDateTime } from '@/utils/dateTimeUtils';
import { debounce } from '@/utils/debounce';
import { useSignalR } from '@/contexts/SignalRContext';
import logger from '@/utils/logger';
import { RetryPreviewModalWithProps as RetryPreviewModal } from '@/components/Modals/RetryPreviewModal';

interface Session {
  id: string;
  sessionId: string;
  queueId: number;
  clinicName: string;
  doctorName: string;
  createdAt: string;
  totalPatients: number;
  failedCount: number;
  patients: Patient[];
}

const FAILED_TASKS_GUIDE_ITEMS = [
  {
    title: '',
    description: 'كل محاولة إعادة تزيد عداد المحاولات'
  },
  {
    title: '',
    description: 'يمكنك تحديد عدد من المرضى برسائلهم وإعادة محاولة جميعها'
  },
  {
    title: '',
    description: 'حذف المريض يزيل الفشل النهائي من السجل'
  },
  {
    title: '',
    description: 'الرسائل الفاشلة قد تكون بسبب رقم جوال خاطئ أو مشكلة اتصال'
  },
];

export default function FailedTasksPanel() {
  const { user, isAuthenticated } = useAuth();
  const { openModal } = useModal();
  const { addToast } = useUI();
  const { confirm } = useConfirmDialog();
  const router = useRouter();
  const { selectedModeratorId } = useQueue();

  // ALL hooks must be declared BEFORE any conditional returns
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set(['SES-15-JAN-001']));
  const [selectedPatients, setSelectedPatients] = useState<Map<string, Set<string>>>(new Map());
  const [isMessagesExpanded, setIsMessagesExpanded] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);

  // Retry preview modal state
  const [showRetryPreview, setShowRetryPreview] = useState(false);
  const [retrySessionId, setRetrySessionId] = useState<string | null>(null);

  // Request deduplication: track in-flight requests
  const isLoadingRef = React.useRef(false);

  // Authentication guard - ensure user has token and valid role
  useEffect(() => {
    // Check for token
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

    // If no token or not authenticated, redirect to login
    if (!token || !isAuthenticated || !user) {
      router.replace('/');
      return;
    }

    // Ensure user has a valid role
    if (!user.role || !Object.values(UserRole).includes(user.role)) {
      router.replace('/');
      return;
    }
  }, [isAuthenticated, user, router]);

  /**
   * Load failed sessions from backend API
   * Includes request deduplication to prevent multiple simultaneous calls
   */
  const loadFailedSessions = useCallback(async () => {
    // Request deduplication: skip if already loading
    if (isLoadingRef.current) {
      logger.debug('[FailedTasksPanel] Skipping duplicate loadFailedSessions call');
      return;
    }

    logger.debug('[FailedTasksPanel] Starting loadFailedSessions', { page, pageSize, userId: user?.id });
    try {
      isLoadingRef.current = true;
      setIsLoading(true);
      setError(null);
      logger.debug('[FailedTasksPanel] Set loading to true, cleared error');

      logger.debug('[FailedTasksPanel] Calling messageApiClient.getFailedSessions()...');
      // Pass selectedModeratorId for Admin filtering (null for Moderators = their own data)
      const response = await messageApiClient.getFailedSessions(selectedModeratorId ?? undefined);
      logger.debug('[FailedTasksPanel] Received response:', {
        success: response.success,
        hasData: !!response.data,
        dataLength: response.data?.length || 0
      });

      if (response.success && response.data) {
        logger.debug('[FailedTasksPanel] Transforming sessions data...', {
          sessionsCount: response.data.length
        });

        // Transform API response to Session format
        const transformedSessions: Session[] = response.data.map((session: any) => {
          logger.debug('[FailedTasksPanel] Transforming session:', {
            sessionId: session.sessionId,
            queueName: session.queueName,
            patientsCount: session.patients?.length || 0
          });

          return {
            id: String(session.sessionId),
            sessionId: String(session.sessionId),
            queueId: session.queueId,
            clinicName: session.queueName,
            doctorName: session.queueName,
            createdAt: session.startTime,
            totalPatients: session.total,
            failedCount: session.failed,
            patients: session.patients.map((p: any) => ({
              id: String(p.patientId),
              messageId: p.messageId, // Message ID as string (Guid)
              name: p.name,
              phone: p.phone,
              queueId: String(session.queueId),
              countryCode: p.countryCode,
              position: 0,
              status: p.status,
              isValidWhatsAppNumber: false,
              messagePreview: p.messageContent || '', // Use resolved message content from backend
              failedReason: p.failedReason || 'فشل الإرسال', // Ensure ErrorMessage is displayed
              attempts: p.attempts || 0,
            } as Patient)),
          };
        });

        // FailedTasksPanel shows ALL failed sessions for the moderator across all queues (no filtering by selectedQueueId)
        // These panels are global for the moderator and WhatsAppSession, not queue-specific

        logger.debug('[FailedTasksPanel] Setting transformed sessions:', {
          count: transformedSessions.length
        });
        setSessions(transformedSessions);
        logger.debug('[FailedTasksPanel] Sessions set successfully');
      } else {
        logger.warn('[FailedTasksPanel] Response not successful or no data:', {
          success: response.success,
          hasData: !!response.data
        });
        setSessions([]);
      }
    } catch (err: any) {
      logger.error('[FailedTasksPanel] Error in loadFailedSessions:', {
        error: err,
        message: err?.message,
        code: err?.code,
        statusCode: err?.statusCode,
        stack: err?.stack
      });

      // Check if error is due to PendingQR (authentication required)
      if (err?.code === 'AUTHENTICATION_REQUIRED' || err?.error === 'PendingQR' || err?.message?.includes('PendingQR')) {
        logger.warn('[FailedTasksPanel] WhatsApp session requires authentication (PendingQR):', err);
        addToast('جلسة الواتساب تحتاج إلى المصادقة. يرجى المصادقة أولاً.', 'warning');
        setSessions([]);
        setError('جلسة الواتساب تحتاج إلى المصادقة. يرجى الذهاب إلى لوحة مصادقة الواتساب للمصادقة.');
      } else {
        const errorMessage = err instanceof Error ? err.message : 'فشل تحميل الجلسات الفاشلة';
        setError(errorMessage);
        logger.error('[FailedTasksPanel] Failed to load failed sessions:', err);
        addToast('فشل تحميل الجلسات الفاشلة', 'error');
        setSessions([]);
      }
    } finally {
      logger.debug('[FailedTasksPanel] Setting loading to false');
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  }, [page, pageSize, user, addToast, selectedModeratorId]);

  /**
   * Load sessions on mount and when dependencies change
   */
  useEffect(() => {
    loadFailedSessions();
  }, [loadFailedSessions]);

  // Debounced refresh function to prevent rapid-fire API calls
  const debouncedRefresh = React.useMemo(
    () => debounce(() => {
      loadFailedSessions();
    }, 2000), // 2 second debounce
    [loadFailedSessions]
  );

  /**
   * Listen for data updates and refetch (debounced to prevent duplicate calls)
   * Note: SignalR events are primary, window events are fallback for backwards compatibility
   */
  useEffect(() => {
    const handleDataUpdate = () => {
      // Use debounced refresh to prevent rapid-fire API calls
      debouncedRefresh();
    };

    window.addEventListener('patientDataUpdated', handleDataUpdate);
    window.addEventListener('queueDataUpdated', handleDataUpdate);
    window.addEventListener('templateDataUpdated', handleDataUpdate);
    window.addEventListener('messageSent', handleDataUpdate);
    window.addEventListener('messageFailed', handleDataUpdate);

    return () => {
      window.removeEventListener('patientDataUpdated', handleDataUpdate);
      window.removeEventListener('queueDataUpdated', handleDataUpdate);
      window.removeEventListener('templateDataUpdated', handleDataUpdate);
      window.removeEventListener('messageSent', handleDataUpdate);
      window.removeEventListener('messageFailed', handleDataUpdate);
    };
  }, [debouncedRefresh]);

  /**
   * SignalR Integration: Listen for real-time message updates
   * Replaces polling with push-based updates for failed messages
   */
  const { connection, isConnected, on, off } = useSignalR();

  useEffect(() => {
    if (!connection || !isConnected) return;

    // Handler for message updates (debounced)
    const handleMessageUpdate = () => {
      logger.debug('FailedTasksPanel: Received MessageUpdated event via SignalR');
      debouncedRefresh();
    };

    const handleMessageDelete = () => {
      logger.debug('FailedTasksPanel: Received MessageDeleted event via SignalR');
      debouncedRefresh();
    };

    // Subscribe to SignalR events using context helpers
    on('MessageUpdated', handleMessageUpdate);
    on('MessageDeleted', handleMessageDelete);
    on('SessionUpdated', handleMessageUpdate);
    on('SessionDeleted', handleMessageUpdate);

    return () => {
      // Cleanup: unsubscribe from events
      off('MessageUpdated', handleMessageUpdate);
      off('MessageDeleted', handleMessageDelete);
      off('SessionUpdated', handleMessageUpdate);
      off('SessionDeleted', handleMessageUpdate);
    };
  }, [connection, isConnected, on, off, debouncedRefresh]);

  /**
   * Toggle session expand - memoized
   */
  const toggleSessionExpand = useCallback((sessionId: string) => {
    setExpandedSessions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sessionId)) {
        newSet.delete(sessionId);
      } else {
        newSet.add(sessionId);
      }
      return newSet;
    });
  }, []);

  /**
   * Toggle patient selection - memoized
   */
  const togglePatientSelection = useCallback((sessionId: string, patientId: string) => {
    setSelectedPatients((prev) => {
      const newMap = new Map(prev);
      if (!newMap.has(sessionId)) {
        newMap.set(sessionId, new Set());
      }
      const sessionSet = newMap.get(sessionId)!;
      if (sessionSet.has(patientId)) {
        sessionSet.delete(patientId);
      } else {
        sessionSet.add(patientId);
      }
      return newMap;
    });
  }, []);

  /**
   * Toggle all patients in session - memoized
   */
  const toggleAllPatients = useCallback((sessionId: string) => {
    setSelectedPatients((prev) => {
      const newMap = new Map(prev);
      const session = sessions.find((s) => s.id === sessionId);
      if (!session) return newMap;

      const sessionSet = newMap.get(sessionId) || new Set();
      const allPatientIds = session.patients.map((p) => p.id);

      // If all are selected, deselect all. Otherwise, select all.
      if (sessionSet.size === allPatientIds.length) {
        newMap.delete(sessionId);
      } else {
        newMap.set(sessionId, new Set(allPatientIds));
      }
      return newMap;
    });
  }, [sessions]);

  /**
   * Delete selected patients - memoized
   */
  const deleteSelectedPatients = useCallback((sessionId: string) => {
    const selected = selectedPatients.get(sessionId) || new Set();
    if (selected.size === 0) return;

    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId
          ? {
            ...s,
            patients: s.patients.filter((p) => !selected.has(p.id)),
            totalPatients: s.totalPatients - selected.size,
            failedCount: s.failedCount - selected.size,
          }
          : s
      )
    );

    setSelectedPatients((prev) => {
      const newMap = new Map(prev);
      newMap.delete(sessionId);
      return newMap;
    });

    addToast(`تم حذف ${selected.size} مريض`, 'success');
  }, [selectedPatients, addToast]);

  /**
   * Retry selected patients - memoized
   */
  const retrySelectedPatients = useCallback(async (sessionId: string) => {
    const selected = selectedPatients.get(sessionId) || new Set();
    if (selected.size === 0) return;

    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return;

    // Get message IDs for selected patients
    const patientsToRetry = session.patients.filter((p) => selected.has(p.id));
    const messageIds = patientsToRetry
      .map((p) => p.messageId)
      .filter((id): id is string => id !== undefined && id !== null);

    if (messageIds.length === 0) {
      addToast('لا توجد رسائل محددة لإعادة المحاولة', 'warning');
      return;
    }

    try {
      setIsLoading(true);

      // Retry each message individually
      const retryPromises = messageIds.map(async (messageId) => {
        try {
          const result = await messageApiClient.retryFailedTask(messageId);
          return { success: true, messageId, result };
        } catch (err: any) {
          logger.error(`[FailedTasksPanel] Failed to retry message ${messageId}:`, err);
          return { success: false, messageId, error: err };
        }
      });

      const results = await Promise.allSettled(retryPromises);
      const successCount = results.filter((r) =>
        r.status === 'fulfilled' && r.value && r.value.success === true
      ).length;
      const failedCount = results.length - successCount;

      if (failedCount > 0) {
        addToast(
          `تم إعادة محاولة ${successCount} رسالة بنجاح. فشل ${failedCount} رسالة.`,
          failedCount === messageIds.length ? 'error' : 'warning'
        );
      } else {
        addToast(`تم إعادة محاولة ${successCount} رسالة بنجاح`, 'success');
      }

      // Reload sessions to get updated status
      const response = await messageApiClient.getFailedSessions();
      if (response.success && response.data) {
        const transformedSessions: Session[] = response.data.map((session: any) => ({
          id: String(session.sessionId),
          sessionId: String(session.sessionId),
          queueId: session.queueId,
          clinicName: session.queueName,
          doctorName: session.queueName,
          createdAt: session.startTime,
          totalPatients: session.total,
          failedCount: session.failed,
          patients: session.patients.map((p: any) => ({
            id: String(p.patientId),
            messageId: p.messageId,
            name: p.name,
            phone: p.phone,
            queueId: String(session.queueId),
            countryCode: p.countryCode,
            position: 0,
            status: p.status,
            isValidWhatsAppNumber: false,
            messagePreview: p.messageContent || '', // Use resolved message content from backend
            failedReason: p.failedReason || 'فشل الإرسال',
            attempts: p.attempts || 0,
          } as Patient)),
        }));

        // FailedTasksPanel shows ALL failed sessions for the moderator across all queues (no filtering by selectedQueueId)
        setSessions(transformedSessions);
      }

      setSelectedPatients((prev) => {
        const newMap = new Map(prev);
        newMap.delete(sessionId);
        return newMap;
      });
    } catch (error: any) {
      logger.error('[FailedTasksPanel] Error retrying selected patients:', error);
      addToast('حدث خطأ أثناء إعادة المحاولة', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [selectedPatients, sessions, addToast]);

  /**
   * Retry single patient (message-level retry)
   * Uses the 3-tier hierarchy: message-level retry endpoint
   */
  const retrySinglePatient = useCallback(async (sessionId: string, patientId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) {
      addToast('الجلسة غير موجودة', 'error');
      return;
    }

    const patient = session.patients.find((p) => p.id === patientId);
    if (!patient || !patient.messageId) {
      addToast('لا توجد رسالة محددة لإعادة المحاولة', 'warning');
      return;
    }

    try {
      setIsLoading(true);
      const result = await messageApiClient.retryFailedTask(patient.messageId);

      // retryFailedTask returns FailedTaskDto directly on success
      if (result && result.id) {
        addToast('تم إعادة محاولة المريض بنجاح', 'success');

        // Reload sessions to get updated status
        await loadFailedSessions();
      }
    } catch (error: any) {
      logger.error('[FailedTasksPanel] Error retrying patient:', error);

      // Handle specific error types with Arabic messages
      if (error?.error === 'WhatsAppValidationRequired' ||
        (error?.statusCode === 400 && error?.message?.includes('واتساب'))) {
        addToast(
          error?.message || 'يجب التحقق من رقم الواتساب أولاً باستخدام زر "التحقق من الرقم" قبل إعادة المحاولة',
          'warning'
        );
      } else if (error?.statusCode === 403) {
        addToast('ليس لديك صلاحية لإعادة محاولة هذه الرسالة', 'error');
      } else if (error?.statusCode === 404) {
        addToast('الرسالة غير موجودة', 'error');
      } else {
        const errorMessage = error?.message || error?.error || 'حدث خطأ أثناء إعادة المحاولة';
        addToast(errorMessage, 'error');
      }
    } finally {
      setIsLoading(false);
    }
  }, [sessions, addToast, loadFailedSessions]);

  /**
   * Retry all failed messages in a specific session (session-level retry)
   * Uses the 3-tier hierarchy: session-level retry endpoint
   */
  const retrySessionPatients = useCallback(async (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) {
      addToast('الجلسة غير موجودة', 'error');
      return;
    }

    if (session.patients.length === 0) {
      addToast('لا توجد رسائل فاشلة في هذه الجلسة', 'warning');
      return;
    }

    try {
      setIsLoading(true);

      // Use session-level retry endpoint (validates WhatsApp numbers automatically)
      const result = await messageApiClient.retrySession(sessionId);

      if (result.success) {
        if (result.skipped && result.skipped > 0) {
          // Some messages were skipped due to unvalidated WhatsApp numbers
          const skippedMessage = result.message || `تم إعادة إضافة ${result.requeued} رسالة. تم تخطي ${result.skipped} رسالة بسبب أرقام واتساب غير محققة.`;
          addToast(skippedMessage, 'warning');

          // Show details about invalid patients if available
          if (result.invalidPatients && result.invalidPatients.length > 0) {
            const patientNames = result.invalidPatients.slice(0, 3).join('، ');
            const moreCount = result.invalidPatients.length > 3 ? ` و${result.invalidPatients.length - 3} آخرين` : '';
            logger.warn(`[FailedTasksPanel] Skipped retry for patients: ${patientNames}${moreCount}`);
          }
        } else if (result.requeued > 0) {
          addToast(
            result.message || `تم إعادة إضافة ${result.requeued} رسالة إلى قائمة الانتظار بنجاح`,
            'success'
          );
        } else {
          addToast('لا توجد رسائل فاشلة في هذه الجلسة', 'info');
        }
      } else {
        throw new Error(result.message || 'فشل إعادة محاولة الجلسة');
      }

      // Reload sessions to get updated status
      await loadFailedSessions();
    } catch (error: any) {
      logger.error('[FailedTasksPanel] Error retrying session patients:', error);

      // Handle specific error types with Arabic messages
      if (error?.error === 'WhatsAppValidationRequired' ||
        (error?.statusCode === 400 && error?.message?.includes('واتساب'))) {
        addToast(
          error?.message || 'يجب التحقق من رقم الواتساب أولاً قبل إعادة المحاولة',
          'warning'
        );
      } else if (error?.statusCode === 403) {
        addToast('ليس لديك صلاحية لإعادة محاولة هذه الجلسة', 'error');
      } else if (error?.statusCode === 404) {
        addToast('الجلسة غير موجودة', 'error');
      } else {
        const errorMessage = error?.message || error?.error || 'حدث خطأ أثناء إعادة المحاولة';
        addToast(errorMessage, 'error');
      }
    } finally {
      setIsLoading(false);
    }
  }, [sessions, addToast, loadFailedSessions]);

  /**
   * Show retry preview modal for all sessions
   * Opens preview modal to show retryable vs non-retryable messages
   */
  const showRetryAllPreview = useCallback(() => {
    // Get first session ID (for moderator-level retry, all sessions belong to same moderator)
    const firstSession = sessions[0];
    if (!firstSession) {
      addToast('لا توجد جلسات فاشلة', 'warning');
      return;
    }

    setRetrySessionId(firstSession.sessionId);
    setShowRetryPreview(true);
  }, [sessions, addToast]);

  /**
   * Retry all patients from all sessions (moderator-level retry)
   * Uses message-level retry for each message individually
   * Called after user confirms in preview modal
   */
  const retryAllPatients = useCallback(async () => {
    // Collect all message IDs from all sessions
    const allMessageIds: string[] = [];
    sessions.forEach((session) => {
      session.patients.forEach((patient) => {
        if (patient.messageId) {
          allMessageIds.push(patient.messageId);
        }
      });
    });

    if (allMessageIds.length === 0) {
      addToast('لا توجد رسائل محددة لإعادة المحاولة', 'warning');
      return;
    }

    try {
      setIsLoading(true);

      // Retry each message individually (message-level retry)
      const retryPromises = allMessageIds.map(async (messageId) => {
        try {
          const result = await messageApiClient.retryFailedTask(messageId);
          return { success: true, messageId, result };
        } catch (err: any) {
          logger.error(`[FailedTasksPanel] Failed to retry message ${messageId}:`, err);
          return { success: false, messageId, error: err };
        }
      });

      const results = await Promise.allSettled(retryPromises);
      const successCount = results.filter((r) =>
        r.status === 'fulfilled' && r.value && r.value.success === true
      ).length;
      const failedCount = results.length - successCount;

      // Handle validation errors
      const validationErrors: string[] = [];
      results.forEach((r) => {
        if (r.status === 'fulfilled' && r.value && !r.value.success) {
          const err = r.value.error;
          if (err?.error === 'WhatsAppValidationRequired' ||
            (err?.statusCode === 400 && err?.message?.includes('واتساب'))) {
            validationErrors.push(err?.message || 'رقم واتساب غير محقق');
          }
        }
      });

      if (validationErrors.length > 0) {
        const uniqueErrors = [...new Set(validationErrors)];
        addToast(
          `تم إعادة محاولة ${successCount} رسالة. ${failedCount} رسالة فشلت: ${uniqueErrors[0]}`,
          failedCount === allMessageIds.length ? 'error' : 'warning'
        );
      } else if (failedCount > 0) {
        addToast(
          `تم إعادة محاولة ${successCount} رسالة بنجاح. فشل ${failedCount} رسالة.`,
          failedCount === allMessageIds.length ? 'error' : 'warning'
        );
      } else {
        addToast(`تم إعادة محاولة ${successCount} رسالة بنجاح`, 'success');
      }

      // Reload sessions to get updated status
      await loadFailedSessions();

      setSelectedPatients(new Map());
    } catch (error: any) {
      logger.error('[FailedTasksPanel] Error retrying all patients:', error);

      // Handle specific error types with Arabic messages
      if (error?.error === 'WhatsAppValidationRequired' ||
        (error?.statusCode === 400 && error?.message?.includes('واتساب'))) {
        addToast(
          error?.message || 'يجب التحقق من رقم الواتساب أولاً قبل إعادة المحاولة',
          'warning'
        );
      } else {
        const errorMessage = error?.message || error?.error || 'حدث خطأ أثناء إعادة المحاولة';
        addToast(errorMessage, 'error');
      }
    } finally {
      setIsLoading(false);
    }
  }, [sessions, addToast, loadFailedSessions]);

  /**
   * Delete all patients - memoized
   */
  const deleteAllPatients = useCallback(async () => {
    const confirmed = await confirm(createBulkDeleteConfirmation(sessions.length, 'جلسة فاشلة'));
    if (confirmed) {
      setSessions([]);
      setSelectedPatients(new Map());
      addToast('تم حذف جميع المهام الفاشلة', 'success');
    }
  }, [addToast, confirm, sessions.length]);

  /**
   * Delete single session - memoized
   */
  const deleteSession = useCallback(async (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    const confirmed = await confirm(createDeleteConfirmation(`جلسة ${session?.clinicName}`));
    if (confirmed) {
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      setSelectedPatients((prev) => {
        const newMap = new Map(prev);
        newMap.delete(sessionId);
        return newMap;
      });
      addToast(`تم حذف جلسة ${session?.clinicName}`, 'success');
    }
  }, [sessions, addToast, confirm]);

  /**
   * Edit patient - memoized
   */
  const handleEditPatient = useCallback((patient: Patient) => {
    openModal('editPatient', { patient, onSave: handleSaveEditedPatient });
  }, [openModal]);

  /**
   * Save edited patient - memoized
   */
  const handleSaveEditedPatient = useCallback((updatedPatient: Patient) => {
    setSessions((prev) =>
      prev.map((s) => ({
        ...s,
        patients: s.patients.map((p) =>
          p.id === updatedPatient.id ? updatedPatient : p
        ),
      }))
    );
    addToast('تم تحديث بيانات المريض بنجاح', 'success');
  }, [addToast]);

  /**
   * Delete patient - memoized
   */
  const handleDeletePatient = useCallback(async (sessionId: string, patientId: string) => {
    const confirmed = await confirm(createDeleteConfirmation('هذا المريض'));
    if (confirmed) {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? {
              ...s,
              patients: s.patients.filter((p) => p.id !== patientId),
              failedCount: s.failedCount - 1,
            }
            : s
        )
      );
      addToast('تم حذف المريض بنجاح', 'success');
    }
  }, [addToast]);

  /**
   * Memoize computed stats
   */
  const stats = useMemo(() => [
    {
      label: 'الجلسات بها فشل',
      value: sessions.length.toString(),
      icon: 'fa-exclamation-circle',
    },
    {
      label: 'الرسائل الفاشلة',
      value: sessions.reduce((sum, s) => sum + s.failedCount, 0).toString(),
      icon: 'fa-times-circle',
    },
    {
      label: 'إجمالي المرضى',
      value: sessions.reduce((sum, s) => sum + s.patients.length, 0).toString(),
      icon: 'fa-users',
    },
  ], [sessions]);

  /**
   * Memoize table columns
   */
  const tableColumns = useMemo(() => [
    { key: 'checkbox', label: '', width: '4%' },
    { key: 'name', label: 'الاسم', width: '15%' },
    { key: 'phone', label: 'رقم الجوال', width: '15%' },
    { key: 'message', label: 'الرسالة', width: '25%', hasToggle: true },
    { key: 'reason', label: 'سبب الفشل', width: '18%' },
    { key: 'attempts', label: 'عدد المحاولات', width: '12%' },
    { key: 'actions', label: 'الإجراءات', width: '11%' },
  ], []);

  /**
   * Render patient row
   */
  const renderPatientRow = useCallback((patient: Patient, sessionId: string) => ({
    id: patient.id,
    checkbox: (
      <input
        type="checkbox"
        checked={selectedPatients.get(sessionId)?.has(patient.id) || false}
        onChange={() => togglePatientSelection(sessionId, patient.id)}
        className="w-4 h-4 rounded cursor-pointer"
      />
    ),
    name: patient.name,
    phone: formatPhoneForDisplay(patient.phone, patient.countryCode || '+20'),
    message: (
      <div
        className={`text-sm text-gray-700 whitespace-pre-wrap ${isMessagesExpanded ? '' : 'line-clamp-2'
          } max-w-xs`}
        title={patient.messagePreview}
      >
        {patient.messagePreview || 'لا توجد رسالة'}
      </div>
    ),
    reason: (
      <span className="text-red-700 font-medium text-sm" title={patient.failedReason}>
        {patient.failedReason || 'فشل الإرسال'}
      </span>
    ),
    attempts: (
      <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm font-medium">
        {patient.failureMetrics?.attempts || 0}
      </span>
    ),
    actions: (
      <div className="flex gap-2 justify-start">
        <button
          onClick={() => retrySinglePatient(sessionId, patient.id)}
          className="bg-orange-50 text-orange-600 hover:bg-orange-100 px-2 py-1 rounded text-sm"
          title="إعادة محاولة"
        >
          <i className="fas fa-redo"></i>
        </button>
        <button
          onClick={() => handleDeletePatient(sessionId, patient.id)}
          className="bg-red-50 text-red-600 hover:bg-red-100 px-2 py-1 rounded text-sm"
          title="حذف"
        >
          <i className="fas fa-trash"></i>
        </button>
      </div>
    ),
  }), [selectedPatients, togglePatientSelection, retrySinglePatient, handleEditPatient, handleDeletePatient, isMessagesExpanded]);

  if (sessions.length === 0) {
    return (
      <PanelWrapper>
        <PanelHeader
          title="المهام الفاشلة"
          icon="fa-exclamation-circle"
          description="عرض وإدارة المهام التي فشلت وتحتاج إلى إعادة محاولة"
          stats={stats}
        />
        <EmptyState
          icon={error ? "fa-exclamation-triangle" : "fa-check-circle"}
          title={error ? "تحذير" : "لا توجد مهام فاشلة"}
          message={error || "جميع المهام تمت معالجتها بنجاح"}
          actionLabel="العودة للصفحة الرئيسية"
          onAction={() => window.history.back()}
        />
      </PanelWrapper>
    );
  }

  return (
    <PanelWrapper>
      <PanelHeader
        title={`المهام الفاشلة`}
        icon="fa-exclamation-circle"
        description={`عرض وإدارة المهام التي فشلت وتحتاج إلى إعادة محاولة - ${sessions.length} جلسة`}
        stats={stats}
      />



      {/* Sessions List */}
      <div className="space-y-4">
        {sessions.map((session) => {
          const isExpanded = expandedSessions.has(session.id);
          const selectedCount = selectedPatients.get(session.id)?.size || 0;

          return (
            <div
              key={session.id}
              className="bg-white rounded-lg shadow overflow-x-auto border border-red-200"
            >
              <div className="min-w-[800px]">
                {/* Session Header - Fully Clickable */}
                <div
                  className="px-6 py-4 border-b bg-gradient-to-r from-red-50 to-orange-50 cursor-pointer hover:from-red-100 hover:to-orange-100 transition-colors"
                  onClick={() => toggleSessionExpand(session.id)}
                >
                  <div className="flex items-center gap-4 justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      {/* Collapse Button with Improved UI */}
                      <div className="flex items-center gap-2">
                        <button className="text-red-600 text-xl transition-transform duration-300">
                          <i className={`fas fa-chevron-${isExpanded ? 'down' : 'left'}`}></i>
                        </button>
                        <span className="text-sm font-medium text-red-600 whitespace-nowrap">القائمة</span>
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-bold text-gray-900 text-lg">{session.clinicName}</h3>
                        </div>
                        <div className="text-sm text-gray-600 mt-2">
                          <span>جلسة: <strong>{session.sessionId}</strong></span>
                          <span className="mx-4">وقت الإنشاء: <strong>{session.createdAt ? formatLocalDateTime(session.createdAt) : 'غير محدد'}</strong></span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Failed Count Badge */}
                      <div className="bg-red-100 text-red-700 px-4 py-2 rounded-lg text-center">
                        <div className="text-sm font-medium">مرضى فاشلة</div>
                        <div className="text-2xl font-bold">{session.failedCount}</div>
                      </div>

                      {/* Session Actions */}
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            retrySessionPatients(session.id);
                          }}
                          className="bg-orange-500 text-white hover:bg-orange-600 px-3 py-2 rounded text-sm flex items-center gap-2 transition-colors"
                          title="إعادة محاولة جميع رسائل هذه الجلسة"
                        >
                          <i className="fas fa-redo-alt"></i>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSession(session.id);
                          }}
                          className="bg-red-500 text-white hover:bg-red-600 px-3 py-2 rounded text-sm flex items-center gap-2 transition-colors"
                          title="حذف جلسة"
                        >
                          <i className="fas fa-trash"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Session Content (Expandable) */}
                {isExpanded && (
                  <div className="p-6 bg-gray-50">
                    {/* Session Summary */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="bg-white rounded-lg p-4 border border-blue-200">
                        <div className="text-sm text-gray-600 flex items-center gap-1">
                          <i className="fas fa-users text-blue-500 text-xs"></i>
                          إجمالي الرسائل
                        </div>
                        <div className="text-2xl font-bold text-blue-600">{session.totalPatients}</div>
                      </div>
                      <div className="bg-white rounded-lg p-4 border border-red-200">
                        <div className="text-sm text-gray-600 flex items-center gap-1">
                          <i className="fas fa-times-circle text-red-500 text-xs"></i>
                          الرسائل الفاشلة
                        </div>
                        <div className="text-2xl font-bold text-red-600">{session.failedCount}</div>
                      </div>
                      <div className="bg-white rounded-lg p-4 border border-orange-200">
                        <div className="text-sm text-gray-600 flex items-center gap-1">
                          <i className="fas fa-redo text-orange-500 text-xs"></i>
                          متوسط المحاولات
                        </div>
                        <div className="text-2xl font-bold text-orange-600">
                          {session.patients.length > 0
                            ? Math.round(session.patients.reduce((sum, p) => sum + ((p as any).attempts || 0), 0) / session.patients.length)
                            : 0}
                        </div>
                      </div>
                    </div>

                    {/* Patients Table */}
                    <div className="bg-white rounded-lg overflow-hidden border">
                      <div className="px-6 py-4 bg-gray-50 border-b flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div
                            onClick={() => toggleAllPatients(session.id)}
                            className="relative w-5 h-5 border-2 rounded cursor-pointer transition-all"
                            style={{
                              borderColor: selectedCount === 0 ? '#d1d5db' : selectedCount === session.totalPatients ? '#3b82f6' : '#f59e0b',
                              backgroundColor: selectedCount === 0 ? 'white' : selectedCount === session.totalPatients ? '#3b82f6' : '#fef3c7',
                            }}
                            title={selectedCount === 0 ? 'تحديد الكل' : selectedCount === session.totalPatients ? 'إلغاء التحديد' : 'تحديد الكل'}
                          >
                            {selectedCount > 0 && (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <i
                                  className={`fas text-white text-xs ${selectedCount === session.totalPatients ? 'fa-check' : 'fa-minus'
                                    }`}
                                ></i>
                              </div>
                            )}
                          </div>
                          <h4 className="font-bold text-gray-800">قائمة المرضى الفاشلة</h4>
                          <span className="text-sm text-gray-600">
                            {selectedCount} من {session.totalPatients} محدد
                          </span>
                        </div>
                        <div className="flex gap-2">
                          {selectedCount > 0 && (
                            <>
                              <button
                                onClick={() => setSelectedPatients(new Map(selectedPatients).set(session.id, new Set()))}
                                className="text-sm text-red-600 hover:text-red-800"
                              >
                                إلغاء التحديد
                              </button>
                              <button
                                onClick={() => retrySelectedPatients(session.id)}
                                className="text-sm bg-orange-600 text-white px-3 py-1 rounded hover:bg-orange-700"
                              >
                                إعادة محاولة ({selectedCount})
                              </button>
                              <button
                                onClick={() => deleteSelectedPatients(session.id)}
                                className="text-sm bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
                              >
                                حذف ({selectedCount})
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {session.patients.length === 0 ? (
                        <div className="p-8 text-center text-gray-600">
                          <i className="fas fa-check-circle text-3xl mb-2 text-green-600"></i>
                          <p>لا يوجد مرضى فاشلة في هذه الجلسة</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-gray-50 border-b">
                              <tr>
                                {tableColumns.map((col: any) => (
                                  <th
                                    key={col.key}
                                    style={{ width: col.width }}
                                    className="px-6 py-3 text-right text-sm font-semibold text-gray-700"
                                  >
                                    {col.hasToggle ? (
                                      <div className="flex items-center justify-between gap-2">
                                        <span>{col.label}</span>
                                        <button
                                          onClick={() => setIsMessagesExpanded(!isMessagesExpanded)}
                                          className="flex items-center gap-1 px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-800 transition-colors text-xs font-medium"
                                          title={isMessagesExpanded ? 'طي الرسائل' : 'فرد الرسائل'}
                                        >
                                          <i className={`fas fa-${isMessagesExpanded ? 'compress' : 'expand'}`}></i>
                                          <span>{isMessagesExpanded ? 'طي' : 'فرد'}</span>
                                        </button>
                                      </div>
                                    ) : (
                                      col.label
                                    )}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {session.patients.map((patient) => {
                                const row = renderPatientRow(patient, session.id);
                                return (
                                  <tr
                                    key={patient.id}
                                    className="border-b hover:bg-gray-50 transition-colors"
                                  >
                                    <td className="px-6 py-3 text-sm">{row.checkbox}</td>
                                    <td className="px-6 py-3 text-sm text-gray-900 font-medium">{row.name}</td>
                                    <td className="px-6 py-3 text-sm text-gray-600">{row.phone}</td>
                                    <td className="px-6 py-3 text-sm text-gray-700">{row.message}</td>
                                    <td className="px-6 py-3 text-sm">{row.reason}</td>
                                    <td className="px-6 py-3 text-sm">{row.attempts}</td>
                                    <td className="px-6 py-3 text-sm">{row.actions}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <UsageGuideSection
        items={FAILED_TASKS_GUIDE_ITEMS}
      />

      {/* Retry Preview Modal */}
      {retrySessionId && (
        <RetryPreviewModal
          isOpen={showRetryPreview}
          onClose={() => {
            setShowRetryPreview(false);
            setRetrySessionId(null);
          }}
          onConfirm={retryAllPatients}
          sessionId={retrySessionId}
        />
      )}
    </PanelWrapper>
  );
}

