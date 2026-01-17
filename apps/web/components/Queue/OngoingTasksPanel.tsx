'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useSignalR } from '@/contexts/SignalRContext';
import { useModal } from '@/contexts/ModalContext';
import { useUI } from '@/contexts/UIContext';
import { useQueue } from '@/contexts/QueueContext';
import { useConfirmDialog } from '@/contexts/ConfirmationContext';
import { createDeleteConfirmation, createActionConfirmation } from '@/utils/confirmationHelpers';
import { UserRole } from '@/types/roles';
// Mock data removed - using API data instead
import { PanelWrapper } from '@/components/Common/PanelWrapper';
import { PanelHeader } from '@/components/Common/PanelHeader';
import { ResponsiveTable } from '@/components/Common/ResponsiveTable';
import { EmptyState } from '@/components/state';
import UsageGuideSection from '@/components/Common/UsageGuideSection';
import { Badge } from '@/components/Common/ResponsiveUI';
import { Patient } from '@/types';
import { formatPhoneForDisplay } from '@/utils/phoneUtils';
import logger from '@/utils/logger';
import messageApiClient, { OngoingSessionDto, SessionPatientDto } from '@/services/api/messageApiClient';
import { patientsApiClient } from '@/services/api/patientsApiClient';
import { settingsApiClient, RateLimitSettings, formatTimeArabic, calculateEstimatedTime } from '@/services/api/settingsApiClient';
import { formatLocalDateTime } from '@/utils/dateTimeUtils';
import { parseAsUtc } from '@/utils/dateTimeUtils';
import { whatsappApiClient, GlobalPauseState } from '@/services/api/whatsappApiClient';
import { debounce } from '@/utils/debounce';
import { translatePauseReason } from '@/utils/pauseReasonTranslations';

interface Session {
  id: string;
  sessionId: string;
  queueId: number;
  clinicName: string;
  doctorName: string;
  createdAt: string;
  totalPatients: number;
  sentCount: number;
  failedCount: number;
  patients: (Patient & { isPaused?: boolean; messageId?: string })[];
  isPaused?: boolean;
  isProcessing?: boolean; // Backend flag indicating if session is currently being processed
}

const ONGOING_TASKS_GUIDE_ITEMS = [
  {
    title: '',
    description: 'يمكنك إيقاف أو استئناف جلسة واحدة أو جميع الجلسات من الأزرار العلوية'
  },
  {
    title: '',
    description: 'لاحظ شريط التقدم الذي يوضح نسبة الرسائل المرسلة من إجمالي الرسائل'
  },
  {
    title: '',
    description: 'حدد عدة مرضى وامسح بياناتهم او عدل/امسح كل مريض على حدة'
  },
  {
    title: '',
    description: 'الجلسات الموقوفة تظهر بخلفية صفراء للدلالة على الحالة الموقوفة'
  },
  {
    title: 'حماية من الحظر',
    description: 'يتم تطبيق تأخير عشوائي بين كل رسالة والأخرى لتجنب اكتشاف النمط المتكرر. هذا التأخير ضروري لحماية حسابك من الحظر.'
  },
];

export default function OngoingTasksPanel() {
  const { user, isAuthenticated } = useAuth();
  const { openModal } = useModal();
  const { addToast } = useUI();
  const { confirm } = useConfirmDialog();
  const router = useRouter();
  const { selectedModeratorId } = useQueue();

  // ALL hooks must be declared BEFORE any conditional returns
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set(['SES-15-JAN-001']));
  const [selectedPatients, setSelectedPatients] = useState<Map<string, Set<string>>>(new Map());
  const [pausedSessions, setPausedSessions] = useState<Set<string>>(new Set(['SES-15-JAN-002']));
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());

  // Request deduplication: track in-flight requests
  const isLoadingRef = React.useRef(false);
  const [isMessagesExpanded, setIsMessagesExpanded] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [globalPauseState, setGlobalPauseState] = useState<GlobalPauseState | null>(null);
  const [rateLimitSettings, setRateLimitSettings] = useState<RateLimitSettings | null>(null);
  const [quotaUsed, setQuotaUsed] = useState<number>(0);

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
   * Load ongoing sessions from backend API
   * Includes request deduplication to prevent multiple simultaneous calls
   */
  const loadOngoingSessions = useCallback(async () => {
    // Request deduplication: skip if already loading
    if (isLoadingRef.current) {
      logger.debug('OngoingTasksPanel: Skipping duplicate loadOngoingSessions call');
      return;
    }

    try {
      isLoadingRef.current = true;
      setIsLoading(true);
      setError(null);

      // Pass selectedModeratorId for Admin filtering (null for Moderators = their own data)
      const response = await messageApiClient.getOngoingSessions(selectedModeratorId ?? undefined);

      if (response.success && response.data) {
        // Transform API response to Session format
        const transformedSessions: Session[] = response.data.map((session: OngoingSessionDto) => ({
          id: String(session.sessionId), // Ensure sessionId is string (Guid serialized as string)
          sessionId: String(session.sessionId),
          queueId: session.queueId,
          clinicName: session.queueName,
          doctorName: session.queueName,
          createdAt: session.startTime,
          totalPatients: session.total,
          sentCount: session.sent,
          failedCount: session.patients.filter((p: SessionPatientDto) => p.status === 'failed').length,
          isPaused: session.status === 'paused',
          isProcessing: session.isProcessing ?? false, // Backend-calculated processing state
          patients: session.patients.map((p: SessionPatientDto) => ({
            id: String(p.patientId),
            name: p.name,
            phone: p.phone,
            queueId: String(session.queueId),
            countryCode: p.countryCode,
            position: 0,
            status: p.status,
            isValidWhatsAppNumber: p.status === 'sent' ? true : null,
            isPaused: p.isPaused,
            messageId: p.messageId,
            messagePreview: p.messageContent || '', // Include resolved message content from backend
          } as Patient & { isPaused?: boolean; messageId?: string })),
        }));

        // OngoingTasksPanel shows ALL sessions across all queues (no filtering by selectedQueueId)
        // The floating section and this panel should show the same sessions

        setSessions(transformedSessions);

        // Update pausedSessions state
        setPausedSessions(new Set(
          transformedSessions
            .filter(s => s.isPaused)
            .map(s => s.id)
        ));
      }
    } catch (err: any) {
      // Check if error is due to PendingQR (authentication required)
      if (err?.code === 'AUTHENTICATION_REQUIRED' || err?.error === 'PendingQR' || err?.message?.includes('PendingQR')) {
        logger.warn('WhatsApp session requires authentication (PendingQR):', err);
        addToast('جلسة الواتساب تحتاج إلى المصادقة. يرجى المصادقة أولاً.', 'warning');
        setSessions([]); // Clear sessions to show empty state
        setError('جلسة الواتساب تحتاج إلى المصادقة. يرجى الذهاب إلى لوحة مصادقة الواتساب للمصادقة.');
      } else {
        const errorMessage = err instanceof Error ? err.message : 'فشل تحميل الجلسات الجارية';
        setError(errorMessage);
        logger.error('Failed to load ongoing sessions:', err);
        addToast('فشل تحميل الجلسات الجارية', 'error');
      }
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  }, [addToast, selectedModeratorId]);

  /**
   * Load quota data for moderator to get lifetime sent messages count
   */
  const loadQuotaData = useCallback(async () => {
    const moderatorId = user?.role === 'moderator'
      ? Number(user.id)
      : (user?.role === 'user' ? Number(user.assignedModerator) : selectedModeratorId);

    if (!moderatorId) {
      setQuotaUsed(0);
      return;
    }

    try {
      // For moderators, use getMyQuota; for admins viewing a moderator, use getQuota
      const quotaData = user?.role === 'moderator'
        ? await messageApiClient.getMyQuota()
        : await messageApiClient.getQuota(moderatorId);
      
      setQuotaUsed(quotaData.used);
    } catch (err) {
      logger.error('Failed to load quota data:', err);
      setQuotaUsed(0);
    }
  }, [user, selectedModeratorId]);

  /**
   * Load global pause state for moderator
   */
  const loadGlobalPauseState = useCallback(async () => {
    const moderatorId = user?.role === 'moderator'
      ? Number(user.id)
      : (user?.role === 'user' ? Number(user.assignedModerator) : selectedModeratorId);

    if (!moderatorId) {
      // Set default state if no moderator ID
      setGlobalPauseState({ isPaused: false, pauseReason: null, pausedAt: null, pausedBy: null, isResumable: false, isExtensionConnected: false, status: null });
      return;
    }

    try {
      const state = await whatsappApiClient.getGlobalPauseState(moderatorId);
      // Ensure we always have a valid state object
      setGlobalPauseState(state || { isPaused: false, pauseReason: null, pausedAt: null, pausedBy: null, isResumable: false, isExtensionConnected: false, status: null });
    } catch (err) {
      logger.error('Failed to load global pause state:', err);
      // Set default state on error
      setGlobalPauseState({ isPaused: false, pauseReason: null, pausedAt: null, pausedBy: null, isResumable: false, isExtensionConnected: false, status: null });
    }
  }, [user, selectedModeratorId]);

  /**
   * Handle global pause (pause all moderator tasks)
   */
  const handleGlobalPause = useCallback(async () => {
    const moderatorId = user?.role === 'moderator'
      ? Number(user.id)
      : (user?.role === 'user' ? Number(user.assignedModerator) : selectedModeratorId);

    if (!moderatorId) return;

    try {
      await whatsappApiClient.pauseAllModeratorTasks(moderatorId, 'User paused');
      addToast('تم إيقاف جميع المهام للمشرف', 'success');
      await loadGlobalPauseState();
      await loadOngoingSessions();
    } catch (err) {
      logger.error('Failed to pause moderator tasks:', err);
      addToast('فشل إيقاف المهام', 'error');
    }
  }, [user, addToast, loadGlobalPauseState, loadOngoingSessions]);

  /**
   * Determine if resume button should be disabled
   * Now uses backend-computed isResumable property for consistency
   * isResumable = true means session can be resumed (so button is enabled)
   */
  const isResumeDisabled = useMemo(() => {
    if (!globalPauseState?.isPaused) return false;

    // Use backend-computed isResumable (negated: isResumable=true means NOT disabled)
    return !globalPauseState.isResumable;
  }, [globalPauseState]);

  /**
   * Handle global resume (resume all moderator tasks)
   * Uses backend-computed isResumable for consistency
   * BrowserClosure and PendingNET pauses are RESUMABLE manually
   */
  const handleGlobalResume = useCallback(async () => {
    const moderatorId = user?.role === 'moderator'
      ? Number(user.id)
      : (user?.role === 'user' ? Number(user.assignedModerator) : selectedModeratorId);

    if (!moderatorId) return;

    // Check if session is NOT resumable (using backend-computed property)
    if (globalPauseState?.isPaused && !globalPauseState.isResumable) {
      addToast('لا يمكن استئناف المهام حتى تتم المصادقة على جلسة الواتساب. يرجى الذهاب إلى لوحة مصادقة الواتساب.', 'warning');
      return;
    }

    try {
      await whatsappApiClient.resumeAllModeratorTasks(moderatorId);
      addToast('تم استئناف جميع المهام للمشرف', 'success');
      await loadGlobalPauseState();
      await loadOngoingSessions();
    } catch (err: any) {
      logger.error('Failed to resume moderator tasks:', err);

      // Check if error is due to PendingQR (unresumable)
      if (err?.error === 'PendingQR' || err?.message?.includes('PendingQR')) {
        addToast('لا يمكن استئناف المهام حتى تتم المصادقة على جلسة الواتساب.', 'warning');
      } else {
        addToast('فشل استئناف المهام', 'error');
      }
    }
  }, [user, addToast, loadGlobalPauseState, loadOngoingSessions, globalPauseState]);

  // Load quota data on mount and when selectedModeratorId changes
  useEffect(() => {
    if (isAuthenticated) {
      loadQuotaData();
    }
  }, [isAuthenticated, loadQuotaData]);

  // Load rate limit settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await settingsApiClient.getRateLimitSettings();
        setRateLimitSettings(settings);
      } catch (err) {
        // Use default settings as fallback (matches backend defaults)
        logger.warn('Failed to load rate limit settings, using defaults');
        setRateLimitSettings({
          minSeconds: 3,
          maxSeconds: 7,
          enabled: true,
          estimatedSecondsPerMessage: 9  // (3+7)/2 + 4s processing
        });
      }
    };
    if (isAuthenticated) {
      loadSettings();
    }
  }, [isAuthenticated]);

  /**
   * Load sessions on mount and when data updates
   */
  useEffect(() => {
    loadOngoingSessions();
    loadGlobalPauseState();
  }, [loadOngoingSessions, loadGlobalPauseState]);

  /**
   * SignalR Integration - Real-time updates (replaces polling)
   * Listens for SessionUpdated, MessageUpdated, and PatientUpdated events
   */
  const { connection, isConnected, on, off } = useSignalR();

  // Debounced refresh function to prevent rapid-fire API calls
  const debouncedRefresh = React.useMemo(
    () => debounce(() => {
      loadOngoingSessions();
    }, 2000), // 2 second debounce
    [loadOngoingSessions]
  );

  // Subscribe to SignalR events for real-time updates
  useEffect(() => {
    if (!connection || !isConnected) return;

    // Handler for session updates (debounced)
    const handleSessionUpdate = (payload: any) => {
      logger.debug('OngoingTasksPanel: Received SessionUpdated event', payload);
      debouncedRefresh();
      loadGlobalPauseState(); // Global pause state doesn't need debouncing
    };

    // Handler for message updates (affects session sent/failed counts) - debounced
    const handleMessageUpdate = (payload: any) => {
      logger.debug('OngoingTasksPanel: Received MessageUpdated event', payload);
      debouncedRefresh();
    };

    // Handler for patient updates (affects session patient list) - debounced
    const handlePatientUpdate = (payload: any) => {
      logger.debug('OngoingTasksPanel: Received PatientUpdated event', payload);
      debouncedRefresh();
    };

    // Handler for WhatsApp session updates (affects pause state and resume button)
    const handleWhatsAppSessionUpdate = (payload: any) => {
      logger.debug('OngoingTasksPanel: Received WhatsAppSessionUpdated event', payload);
      // Immediately refresh pause state - don't debounce as this affects button state
      loadGlobalPauseState();
    };

    // Subscribe to events using context helpers
    on('SessionUpdated', handleSessionUpdate);
    on('SessionDeleted', handleSessionUpdate);
    on('MessageUpdated', handleMessageUpdate);
    on('MessageDeleted', handleMessageUpdate);
    on('PatientUpdated', handlePatientUpdate);
    on('PatientDeleted', handlePatientUpdate);
    on('WhatsAppSessionUpdated', handleWhatsAppSessionUpdate); // NEW: Listen for session status changes

    // Cleanup subscriptions
    return () => {
      off('SessionUpdated', handleSessionUpdate);
      off('SessionDeleted', handleSessionUpdate);
      off('MessageUpdated', handleMessageUpdate);
      off('MessageDeleted', handleMessageUpdate);
      off('PatientUpdated', handlePatientUpdate);
      off('PatientDeleted', handlePatientUpdate);
      off('WhatsAppSessionUpdated', handleWhatsAppSessionUpdate);
    };
  }, [connection, isConnected, on, off, debouncedRefresh, loadGlobalPauseState]);

  /**
   * Listen for data updates and refetch (debounced to prevent duplicate calls)
   * Note: SignalR events are primary, window events are fallback for backwards compatibility
   */
  useEffect(() => {
    const handleDataUpdate = () => {
      // Use debounced refresh to prevent rapid-fire API calls
      debouncedRefresh();

      // Dispatch event to notify other components
      window.dispatchEvent(new CustomEvent('ongoingTasksDataUpdated'));
    };

    // Listen to all relevant update events (debounced)
    window.addEventListener('patientDataUpdated', handleDataUpdate);
    window.addEventListener('queueDataUpdated', handleDataUpdate);
    window.addEventListener('templateDataUpdated', handleDataUpdate);
    window.addEventListener('messageDataUpdated', handleDataUpdate);
    window.addEventListener('conditionDataUpdated', handleDataUpdate);
    window.addEventListener('messageSent', handleDataUpdate);

    return () => {
      window.removeEventListener('patientDataUpdated', handleDataUpdate);
      window.removeEventListener('queueDataUpdated', handleDataUpdate);
      window.removeEventListener('templateDataUpdated', handleDataUpdate);
      window.removeEventListener('messageDataUpdated', handleDataUpdate);
      window.removeEventListener('conditionDataUpdated', handleDataUpdate);
      window.removeEventListener('messageSent', handleDataUpdate);
    };
  }, [debouncedRefresh]);

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
   * Delete selected patients from session - memoized (uses backend API)
   */
  const deleteSelectedPatients = useCallback(async (sessionId: string) => {
    const selected = selectedPatients.get(sessionId) || new Set();
    if (selected.size === 0) return;

    const confirmed = await confirm(createDeleteConfirmation(`${selected.size} مريض`));
    if (!confirmed) return;

    try {
      // Delete all selected patients
      const deletePromises = Array.from(selected).map(patientId =>
        patientsApiClient.deletePatient(Number(patientId))
      );

      await Promise.all(deletePromises);
      addToast(`تم حذف ${selected.size} مريض`, 'success');

      // Clear selection
      setSelectedPatients((prev) => {
        const newMap = new Map(prev);
        newMap.delete(sessionId);
        return newMap;
      });

      // Reload sessions to get updated state
      await loadOngoingSessions();

      // Dispatch event to notify other components
      window.dispatchEvent(new CustomEvent('patientDataUpdated'));
      window.dispatchEvent(new CustomEvent('messageDataUpdated'));
    } catch (err) {
      logger.error('Failed to delete selected patients:', err);
      addToast('فشل حذف المرضى', 'error');
    }
  }, [selectedPatients, confirm, addToast, loadOngoingSessions]);

  /**
   * Get progress percentage - memoized
   * Only counts messages with 'sent' status (not 'sending')
   */
  const getProgressPercentage = useCallback((session: Session) => {
    // Count only actually sent messages (status === 'sent'), not 'sending'
    const actuallySent = session.patients.filter(p => p.status === 'sent').length;
    return session.totalPatients > 0
      ? Math.round((actuallySent / session.totalPatients) * 100)
      : 0;
  }, []);

  /**
   * Toggle session pause - memoized (uses backend API)
   */
  const toggleSessionPause = useCallback(async (sessionId: string) => {
    try {
      const session = sessions.find(s => s.id === sessionId);
      if (!session) return;

      if (session.isPaused) {
        // Resume session
        await messageApiClient.resumeSession(sessionId);
        addToast('تم استئناف الجلسة', 'success');
      } else {
        // Pause session
        await messageApiClient.pauseSession(sessionId);
        addToast('تم إيقاف الجلسة', 'success');
      }

      // Reload sessions to get updated state from backend
      await loadOngoingSessions();

      // Dispatch event to notify other components
      window.dispatchEvent(new CustomEvent('messageDataUpdated'));
    } catch (err) {
      logger.error('Failed to toggle session pause:', err);
      addToast('فشل تحديث حالة الجلسة', 'error');
    }
  }, [sessions, addToast, loadOngoingSessions]);


  /**
   * Toggle patient pause - memoized (uses backend API)
   */
  const togglePatientPause = useCallback(async (sessionId: string, patientId: string) => {
    try {
      // Find the message ID for this patient in this session
      const session = sessions.find(s => s.id === sessionId);
      const patient = session?.patients.find(p => p.id === patientId);

      if (!patient || !patient.messageId) {
        addToast('لم يتم العثور على معرف الرسالة', 'error');
        return;
      }

      // If patient is paused, resume the message; otherwise pause it
      if (patient.isPaused) {
        // Resume individual message
        await messageApiClient.resumeMessage(patient.messageId);
        addToast('تم استئناف الرسالة بنجاح', 'success');
      } else {
        // Pause individual message
        await messageApiClient.pauseMessage(patient.messageId);
        addToast('تم إيقاف الرسالة بنجاح', 'success');
      }

      // Reload sessions to get updated state
      await loadOngoingSessions();

      // Dispatch event to notify other components
      window.dispatchEvent(new CustomEvent('messageDataUpdated'));
    } catch (err) {
      logger.error('Failed to toggle patient pause:', err);
      addToast('فشل تحديث حالة الرسالة', 'error');
    }
  }, [sessions, loadOngoingSessions, addToast]);

  /**
   * Delete session - memoized (uses backend API)
   */
  const deleteSession = useCallback(async (sessionId: string) => {
    const confirmed = await confirm(createDeleteConfirmation('هذه الجلسة'));
    if (confirmed) {
      try {
        await messageApiClient.deleteSession(sessionId);
        addToast('تم حذف الجلسة بنجاح', 'success');

        // Reload sessions to get updated state
        await loadOngoingSessions();

        // Clear selection for this session
        setSelectedPatients((prev) => {
          const newMap = new Map(prev);
          newMap.delete(sessionId);
          return newMap;
        });

        // Dispatch event to notify other components
        window.dispatchEvent(new CustomEvent('messageDataUpdated'));
      } catch (err) {
        logger.error('Failed to delete session:', err);
        addToast('فشل حذف الجلسة', 'error');
      }
    }
  }, [confirm, addToast, loadOngoingSessions]);

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
   * Delete patient - memoized (uses backend API)
   */
  const handleDeletePatient = useCallback(async (sessionId: string, patientId: string) => {
    // Find patient to get messageId
    const session = sessions.find(s => s.id === sessionId);
    const patient = session?.patients.find(p => p.id === patientId);

    if (!patient || !patient.messageId) {
      addToast('لم يتم العثور على معرف الرسالة', 'error');
      return;
    }

    const confirmed = await confirm(createDeleteConfirmation('هذه الرسالة'));
    if (confirmed) {
      try {
        await messageApiClient.deleteMessage(patient.messageId);
        addToast('تم حذف الرسالة بنجاح', 'success');

        // Reload sessions to get updated state
        await loadOngoingSessions();

        // Dispatch event to notify other components
        window.dispatchEvent(new CustomEvent('messageDataUpdated'));
      } catch (err) {
        logger.error('Failed to delete message:', err);
        addToast('فشل حذف الرسالة', 'error');
      }
    }
  }, [sessions, confirm, addToast, loadOngoingSessions]);

  /**
   * Sort sessions by processing priority:
   * 1. Sessions with 'sending' messages (currently active) - highest priority
   * 2. Non-paused sessions with queued messages (ready to process)
   * 3. Paused sessions (waiting)
   * Within each group, sort by StartTime (oldest first = FIFO)
   */
  const sortedSessions = useMemo(() => {
    return [...sessions].sort((a, b) => {
      // Use backend-calculated isProcessing flag for consistency
      const aIsProcessing = a.isProcessing ?? false;
      const bIsProcessing = b.isProcessing ?? false;

      // Priority 1: Processing sessions (actively sending) go first
      if (aIsProcessing && !bIsProcessing) return -1;
      if (!aIsProcessing && bIsProcessing) return 1;

      // Priority 2: Non-paused before paused
      if (!a.isPaused && b.isPaused) return -1;
      if (a.isPaused && !b.isPaused) return 1;

      // Priority 3: Within same pause state, oldest (earliest StartTime) first (FIFO)
      const dateA = parseAsUtc(a.createdAt)?.getTime() || 0;
      const dateB = parseAsUtc(b.createdAt)?.getTime() || 0;
      return dateA - dateB;
    });
  }, [sessions]);

  /**
   * Memoize computed stats
   */
  const stats = useMemo(() => [
    {
      label: 'إجمالي الجلسات الجارية',
      value: sessions.length.toString(),
      icon: 'fa-tasks',
    },
    {
      label: 'إجمالي الرسائل المتبقية',
      value: sessions.reduce((sum, s) => sum + (s.totalPatients - s.sentCount), 0).toString(),
      icon: 'fa-users',
    },
    {
      label: 'إجمالي الرسائل المرسلة',
      value: quotaUsed.toString(),
      icon: 'fa-check-circle',
    },
  ], [sessions, quotaUsed]);

  /**
   * Memoize computed flags
   */

  /**
   * Memoize table columns for each session
   */
  const tableColumns = useMemo(() => [
    { key: 'checkbox', label: '', width: '4%' },
    { key: 'name', label: 'الاسم', width: '15%' },
    { key: 'phone', label: 'رقم الجوال', width: '15%' },
    { key: 'message', label: 'الرسالة', width: '25%', hasToggle: true },
    { key: 'status', label: 'الحالة', width: '15%' },
    { key: 'failedAttempts', label: 'المحاولات الفاشلة', width: '12%' },
    { key: 'actions', label: 'الإجراءات', width: '14%' },
  ], []);

  /**
   * Render patient row
   */
  const renderPatientRow = useCallback((patient: Patient, sessionId: string, sessionIsPaused: boolean) => ({
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
    status: (
      <div className="flex gap-2">
        {/* Enhanced status indicator with distinct states */}
        {patient.isPaused ? (
          <Badge color="yellow" label="⏸️ موقوف" />
        ) : patient.status === 'sending' ? (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 animate-pulse">
            <svg className="animate-spin -mr-1 ml-2 h-3 w-3 text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            📤 جاري الإرسال
          </span>
        ) : patient.status === 'sent' ? (
          <Badge color="green" label="✅ تم الإرسال" />
        ) : patient.status === 'failed' ? (
          <Badge color="red" label="❌ فشل" />
        ) : (
          <Badge color="gray" label="⏳ في الانتظار" />
        )}
      </div>
    ),
    failedAttempts: (
      <span
        className={`px-3 py-1 rounded-full text-sm font-medium ${(patient.failureMetrics?.attempts ?? 0) > 0
          ? 'bg-red-100 text-red-700'
          : 'bg-green-100 text-green-700'
          }`}
      >
        {patient.failureMetrics?.attempts ?? 0}
      </span>
    ),
    actions: (
      <div className="flex gap-2 justify-start">
        <button
          onClick={() =>
            togglePatientPause(sessionId, patient.id)
          }
          disabled={sessionIsPaused}
          className={`px-2 py-1 rounded text-sm ${sessionIsPaused
            ? 'bg-gray-200 text-gray-400 cursor-not-allowed opacity-50'
            : patient.isPaused
              ? 'bg-green-50 text-green-600 hover:bg-green-100'
              : 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100'
            }`}
          title={
            sessionIsPaused
              ? 'تم إيقاف الجلسة'
              : patient.isPaused
                ? 'استئناف'
                : 'إيقاف'
          }
        >
          <i className={`fas fa-${patient.isPaused ? 'play' : 'pause'}`}></i>
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
  }), [selectedPatients, togglePatientSelection, togglePatientPause, handleEditPatient, handleDeletePatient, isMessagesExpanded, globalPauseState]);

  // Show loading state
  if (isLoading && sessions.length === 0) {
    return (
      <PanelWrapper>
        <PanelHeader
          title="المهام الجارية"
          icon="fa-tasks"
          description="مراقبة وإدارة جميع المهام الجارية حالياً"
          stats={stats}
        />
        <div className="flex items-center justify-center py-12">
          <i className="fas fa-spinner animate-spin text-4xl text-blue-500"></i>
          <span className="ml-3 text-lg text-gray-600">جاري التحميل...</span>
        </div>
      </PanelWrapper>
    );
  }

  // Show error state
  if (error && sessions.length === 0) {
    return (
      <PanelWrapper>
        <PanelHeader
          title="المهام الجارية"
          icon="fa-tasks"
          description="مراقبة وإدارة جميع المهام الجارية حالياً"
          stats={stats}
        />
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <i className="fas fa-exclamation-triangle text-red-500 text-3xl mb-3"></i>
          <p className="text-red-700 font-medium mb-2">حدث خطأ أثناء تحميل الجلسات</p>
          <p className="text-red-600 text-sm mb-4">{error}</p>
          <button
            onClick={loadOngoingSessions}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            إعادة المحاولة
          </button>
        </div>
      </PanelWrapper>
    );
  }

  // Show empty state
  if (sessions.length === 0) {
    return (
      <PanelWrapper>
        <PanelHeader
          title="المهام الجارية"
          icon="fa-tasks"
          description="مراقبة وإدارة جميع المهام الجارية حالياً"
          stats={stats}
        />
        <EmptyState
          icon="fa-inbox"
          title="لا توجد مهام جارية"
          message="جميع المهام إما مكتملة أو لم تبدأ بعد"
          actionLabel="العودة للصفحة الرئيسية"
          onAction={() => window.history.back()}
        />
      </PanelWrapper>
    );
  }

  return (
    <PanelWrapper>
      <PanelHeader
        title={`المهام الجارية`}
        icon="fa-tasks"
        description={`مراقبة وإدارة جميع المهام الجارية حالياً - ${sessions.length} جلسة`}
        stats={stats}
      />

      {/* Global Pause/Resume Button */}
      {globalPauseState && (
        <div className="mb-4 px-6 pt-2">
          <div className="flex items-center justify-between gap-4">
            {globalPauseState.isPaused ? (
              <>
                <button
                  onClick={handleGlobalResume}
                  disabled={isResumeDisabled}
                  className={`px-6 py-3 rounded-lg flex items-center gap-2 font-medium shadow-md transition-all ${isResumeDisabled
                    ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700 hover:shadow-lg'
                    }`}
                  title={isResumeDisabled ? 'لا يمكن الاستئناف - يتطلب المصادقة أولاً' : 'استئناف جميع مهام المشرف'}
                >
                  <i className="fas fa-play"></i>
                  <span>
                    {isResumeDisabled
                      ? 'الاستئناف غير متاح - يتطلب المصادقة'
                      : globalPauseState.pauseReason?.includes('PendingQR') && globalPauseState.isResumable
                        ? 'استئناف المهام (تم المصادقة ✓)'
                        : 'استئناف جميع مهام المشرف'}
                  </span>
                </button>
                {globalPauseState.pauseReason && (
                  <div className={`text-sm flex items-center gap-2 ${globalPauseState.pauseReason?.includes('PendingQR') && !globalPauseState.isResumable
                    ? 'text-yellow-700 font-semibold'
                    : globalPauseState.pauseReason?.includes('PendingQR') && globalPauseState.isResumable
                      ? 'text-green-600 font-semibold'
                      : globalPauseState.pauseReason?.includes('BrowserClosure')
                        ? 'text-red-600'
                        : 'text-orange-600'
                    }`}>
                    <i className={`fas ${globalPauseState.pauseReason?.includes('PendingQR') && !globalPauseState.isResumable
                      ? 'fa-exclamation-triangle'
                      : globalPauseState.pauseReason?.includes('PendingQR') && globalPauseState.isResumable
                        ? 'fa-check-circle'
                        : globalPauseState.pauseReason?.includes('BrowserClosure')
                          ? 'fa-times-circle'
                          : 'fa-wifi'
                      }`}></i>
                    <span>{translatePauseReason(globalPauseState.pauseReason)}</span>
                    {globalPauseState.pauseReason?.includes('PendingQR') && !globalPauseState.isResumable && (
                      <span className="text-xs">(يجب المصادقة أولاً)</span>
                    )}
                    {globalPauseState.pauseReason?.includes('PendingQR') && globalPauseState.isResumable && (
                      <span className="text-xs text-green-600">(تم المصادقة - اضغط استئناف)</span>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                <button
                  onClick={handleGlobalPause}
                  disabled={!globalPauseState?.isExtensionConnected || globalPauseState?.status !== 'connected'}
                  className={`px-6 py-3 rounded-lg flex items-center gap-2 font-medium shadow-md transition-all ${globalPauseState?.isExtensionConnected && globalPauseState?.status === 'connected'
                    ? 'bg-yellow-600 text-white hover:bg-yellow-700 hover:shadow-lg'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  title={
                    !globalPauseState?.isExtensionConnected 
                      ? 'الإضافة غير متصلة - لا يوجد شيء للإيقاف'
                      : globalPauseState?.status !== 'connected'
                        ? 'الجلسة غير مصادق عليها - يجب المصادقة أولاً'
                        : 'إيقاف جميع مهام المشرف'
                  }
                >
                  <i className="fas fa-pause"></i>
                  <span>إيقاف جميع مهام المشرف</span>
                </button>
                {!globalPauseState?.isExtensionConnected && (
                  <div className="text-sm text-orange-600 flex items-center gap-2 mt-2">
                    <i className="fas fa-plug"></i>
                    <span>الإضافة غير متصلة - افتح الإضافة واضغط &quot;بدء الجلسة&quot;</span>
                  </div>
                )}
                {globalPauseState?.isExtensionConnected && globalPauseState?.status !== 'connected' && (
                  <div className="text-sm text-yellow-600 flex items-center gap-2 mt-2">
                    <i className="fas fa-exclamation-triangle"></i>
                    <span>الجلسة غير مصادق عليها - يجب مسح رمز QR أولاً قبل إمكانية الإيقاف</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}


      {/* Rate Limit Info Banner */}
      {rateLimitSettings && rateLimitSettings.enabled && sessions.length > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 mb-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 bg-blue-100 rounded-full p-2">
              <i className="fas fa-shield-alt text-blue-600 text-lg"></i>
            </div>
            <div className="flex-1">
              <h4 className="text-blue-800 font-semibold text-sm mb-1 flex items-center gap-2">
                <span>حماية من الحظر</span>
                <span className="bg-blue-200 text-blue-700 px-2 py-0.5 rounded-full text-xs font-bold">
                  {rateLimitSettings.minSeconds}-{rateLimitSettings.maxSeconds} ثانية
                </span>
              </h4>
              <p className="text-blue-700 text-xs leading-relaxed">
                يتم تطبيق تأخير عشوائي بين <strong>{rateLimitSettings.minSeconds}</strong> و <strong>{rateLimitSettings.maxSeconds}</strong> ثانية
                بين كل رسالة والأخرى. هذا التأخير المتغير يمنع اكتشاف النمط المتكرر ويحمي حسابك من الحظر.
                <span className="text-blue-600 font-medium"> يرجى الصبر - الإرسال البطيء أفضل من حظر الحساب!</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Sessions List */}
      <div className="space-y-4">
        {sortedSessions.map((session, index) => {
          const isExpanded = expandedSessions.has(session.id);
          const progressPercent = getProgressPercentage(session);
          const selectedCount = selectedPatients.get(session.id)?.size || 0;
          // Use backend-calculated isProcessing flag for faster tag updates
          const isCurrentlyActive = (session.isProcessing ?? false) && !session.isPaused;
          const isNextInQueue = index === 1 && (sortedSessions[0].isProcessing ?? false) && !sortedSessions[0].isPaused;

          return (
            <div
              key={session.id}
              className={`bg-white rounded-lg shadow overflow-hidden border-2 transition-all duration-500 ease-in-out transform hover:scale-[1.01] ${isCurrentlyActive
                ? 'animate-glow-sending border-blue-500 shadow-xl shadow-blue-200/50 order-0'
                : isNextInQueue
                  ? 'border-green-400 shadow-lg shadow-green-100/50 order-1'
                  : session.isPaused
                    ? 'border-yellow-300 order-2'
                    : 'border-gray-200 order-3'
                }`}
              style={{
                animation: isCurrentlyActive ? 'slideToTop 0.5s ease-out' : 'none'
              }}
            >
              {/* Active Session Badge */}
              {isCurrentlyActive && (
                <div className="absolute top-2 right-2 z-10 bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg flex items-center gap-1 animate-pulse">
                  <i className="fas fa-bolt"></i>
                  <span>جارٍ المعالجة الآن</span>
                </div>
              )}
              {/* Next in Queue Badge */}
              {isNextInQueue && (
                <div className="absolute top-2 right-2 z-10 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg flex items-center gap-1">
                  <i className="fas fa-clock"></i>
                  <span>التالي في الدور</span>
                </div>
              )}
              {/* Session Header - Fully Clickable */}
              <div
                className={`px-6 py-4 border-b cursor-pointer transition-colors relative ${isCurrentlyActive
                  ? 'bg-gradient-to-r from-blue-50 via-blue-100 to-purple-100'
                  : session.isPaused
                    ? 'bg-gradient-to-r from-yellow-100 to-orange-50'
                    : 'bg-gradient-to-r from-blue-50 to-purple-50 hover:from-blue-100 hover:to-purple-100'
                  }`}
                onClick={() => toggleSessionExpand(session.id)}
                style={{ paddingTop: (isCurrentlyActive || isNextInQueue) ? '3rem' : '1rem' }}
              >
                <div className="flex items-center gap-4 justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    {/* Collapse Button with Improved UI */}
                    <div className="flex items-center gap-2">
                      <button className={`text-xl transition-transform duration-300 ${session.isPaused ? 'text-yellow-600' : 'text-blue-600'}`}>
                        <i className={`fas fa-chevron-${isExpanded ? 'down' : 'left'}`}></i>
                      </button>
                      <span className={`text-sm font-medium whitespace-nowrap ${session.isPaused ? 'text-yellow-600' : 'text-blue-600'}`}>القائمة</span>
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-bold text-gray-900 text-lg">{session.clinicName}</h3>
                        {session.isPaused && (
                          <Badge color="yellow" label="⏸️ موقوف مؤقتاً" />
                        )}
                      </div>
                      <div className="text-sm text-gray-600 mt-2">
                        <span>جلسة: <strong>{session.sessionId}</strong></span>
                        <span className="mx-4">وقت الإنشاء: <strong>{session.createdAt ? formatLocalDateTime(session.createdAt) : 'غير محدد'}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Progress Bar */}
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-700 mb-1">تقدم الإرسال</div>
                      <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${session.isPaused
                            ? 'bg-yellow-500'
                            : progressPercent === 100
                              ? 'bg-green-500'
                              : 'bg-blue-500'
                            }`}
                          style={{ width: `${progressPercent}%` }}
                        ></div>
                      </div>
                      <div className="text-xs text-gray-600 mt-1">{progressPercent}%</div>
                    </div>

                    {/* Session Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSessionPause(session.id);
                        }}
                        disabled={false}
                        className={`px-3 py-2 rounded text-sm font-medium flex items-center gap-2 whitespace-nowrap transition-all ${session.isPaused
                          ? 'bg-green-500 text-white hover:bg-green-600'
                          : 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100'
                          }`}
                        title={session.isPaused ? 'استئناف الجلسة' : 'إيقاف الجلسة'}
                      >
                        <i className={`fas fa-${session.isPaused ? 'play' : 'pause'}`}></i>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSession(session.id);
                        }}
                        className="bg-red-50 text-red-600 hover:bg-red-100 px-3 py-2 rounded text-sm"
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
                  {(() => {
                    const remainingCount = session.patients.filter(p => p.status === 'queued' || p.status === 'pending').length;

                    // Calculate estimated remaining time
                    const estimatedTime = rateLimitSettings
                      ? calculateEstimatedTime(remainingCount, rateLimitSettings.estimatedSecondsPerMessage)
                      : remainingCount * 9; // Fallback estimate (9s per message)

                    return (
                      <>
                        {/* Session Stats - 4 columns with actionable info */}
                        <div className="grid grid-cols-4 gap-4 mb-6">
                          <div className="bg-white rounded-lg p-4 border border-blue-200">
                            <div className="text-sm text-gray-600 flex items-center gap-1">
                              <i className="fas fa-spinner fa-spin text-blue-500 text-xs"></i>
                              قيد الإرسال
                            </div>
                            <div className="text-2xl font-bold text-blue-600">
                              {session.patients.filter(p => p.status === 'sending').length}
                            </div>
                          </div>
                          <div className="bg-white rounded-lg p-4 border border-green-200">
                            <div className="text-sm text-gray-600 flex items-center gap-1">
                              <i className="fas fa-check-circle text-green-500 text-xs"></i>
                              تم الإرسال
                            </div>
                            <div className="text-2xl font-bold text-green-600">
                              {session.patients.filter(p => p.status === 'sent').length}
                            </div>
                          </div>
                          <div className="bg-white rounded-lg p-4 border border-red-200">
                            <div className="text-sm text-gray-600 flex items-center gap-1">
                              <i className="fas fa-times-circle text-red-500 text-xs"></i>
                              فشل
                            </div>
                            <div className="text-2xl font-bold text-red-600">{session.failedCount}</div>
                          </div>
                          <div className="bg-white rounded-lg p-4 border border-gray-200">
                            <div className="text-sm text-gray-600 flex items-center gap-1">
                              <i className="fas fa-clock text-gray-500 text-xs"></i>
                              المتبقية
                            </div>
                            <div className="flex items-end gap-2">
                              <div className="text-2xl font-bold text-gray-600">
                                {remainingCount}
                              </div>
                              {remainingCount > 0 && (
                                <div className="text-xs text-blue-600 mb-1 font-medium dir-ltr" title="الوقت المتبقي المتوقع">
                                  ~{formatTimeArabic(estimatedTime)}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </>
                    );
                  })()}

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
                        <h4 className="font-bold text-gray-800">قائمة المرضى</h4>
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
                        <i className="fas fa-inbox text-3xl mb-2 opacity-50"></i>
                        <p>لا يوجد مرضى في هذه الجلسة</p>
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
                              const row = renderPatientRow(patient, session.id, session.isPaused || false);
                              return (
                                <tr
                                  key={patient.id}
                                  className={`border-b hover:bg-gray-50 transition-colors ${patient.isPaused ? 'bg-yellow-50' : ''
                                    }`}
                                >
                                  <td className="px-6 py-3 text-sm">{row.checkbox}</td>
                                  <td className="px-6 py-3 text-sm text-gray-900 font-medium">{row.name}</td>
                                  <td className="px-6 py-3 text-sm text-gray-600">{row.phone}</td>
                                  <td className="px-6 py-3 text-sm text-gray-700">{row.message}</td>
                                  <td className="px-6 py-3 text-sm">{row.status}</td>
                                  <td className="px-6 py-3 text-sm">{row.failedAttempts}</td>
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
          );
        })}
      </div>
      <UsageGuideSection
        items={ONGOING_TASKS_GUIDE_ITEMS}
      />
    </PanelWrapper>
  );
}
