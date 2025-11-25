'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useModal } from '@/contexts/ModalContext';
import { useUI } from '@/contexts/UIContext';
import { useConfirmDialog } from '@/contexts/ConfirmationContext';
import { createDeleteConfirmation, createActionConfirmation } from '@/utils/confirmationHelpers';
import { UserRole } from '@/types/roles';
// Mock data removed - using API data instead
import { PanelWrapper } from '@/components/Common/PanelWrapper';
import { PanelHeader } from '@/components/Common/PanelHeader';
import { ResponsiveTable } from '@/components/Common/ResponsiveTable';
import { EmptyState } from '@/components/Common/EmptyState';
import UsageGuideSection from '@/components/Common/UsageGuideSection';
import { Badge } from '@/components/Common/ResponsiveUI';
import { Patient } from '@/types';
import { formatPhoneForDisplay } from '@/utils/phoneUtils';
import logger from '@/utils/logger';
import messageApiClient, { OngoingSessionDto, SessionPatientDto } from '@/services/api/messageApiClient';
import { patientsApiClient } from '@/services/api/patientsApiClient';
import { formatLocalDateTime } from '@/utils/dateTimeUtils';

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
  patients: (Patient & { isPaused?: boolean })[];
  isPaused?: boolean;
}

const ONGOING_TASKS_GUIDE_ITEMS = [
  {
    title: '',
    description: 'يمكنك إيقاف أو استئناف جلسة واحدة أو جميع الجلسات من الأزرار العلوية'
  },
  {
    title: '',
    description: 'لاحظ شريط التقدم الذي يوضح نسبة الرسائل المرسلة من إجمالي المرضى'
  },
  {
    title: '',
    description: 'حدد عدة مرضى وامسح بياناتهم او عدل/امسح كل مريض على حدة'
  },
  {
    title: '',
    description: 'الجلسات الموقوفة تظهر بخلفية صفراء للدلالة على الحالة الموقوفة'
  },
];

export default function OngoingTasksPanel() {
  const { user, isAuthenticated } = useAuth();
  const { openModal } = useModal();
  const { addToast } = useUI();
  const { confirm } = useConfirmDialog();
  const router = useRouter();
  
  // ALL hooks must be declared BEFORE any conditional returns
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set(['SES-15-JAN-001']));
  const [selectedPatients, setSelectedPatients] = useState<Map<string, Set<string>>>(new Map());
  const [pausedSessions, setPausedSessions] = useState<Set<string>>(new Set(['SES-15-JAN-002']));
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [isMessagesExpanded, setIsMessagesExpanded] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
   */
  const loadOngoingSessions = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await messageApiClient.getOngoingSessions();
      
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
          } as Patient & { isPaused?: boolean })),
        }));
        
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
        const errorMessage = err instanceof Error ? err.message : 'Failed to load ongoing sessions';
        setError(errorMessage);
        logger.error('Failed to load ongoing sessions:', err);
        addToast('فشل تحميل الجلسات الجارية', 'error');
      }
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  /**
   * Load sessions on mount and when data updates
   */
  useEffect(() => {
    loadOngoingSessions();
  }, [loadOngoingSessions]);

  /**
   * Polling mechanism for real-time updates (every 10 seconds)
   * Ensures all users see the same updated state
   * Reduced frequency to reduce server load and CPU usage
   */
  useEffect(() => {
    // Only poll if tab is visible (reduce CPU when tab is inactive)
    if (document.hidden) return;
    
    const pollInterval = setInterval(() => {
      // Check if tab is still visible before polling
      if (!document.hidden) {
        loadOngoingSessions();
      }
    }, 10000); // Increased from 5 seconds to 10 seconds

    // Pause polling when tab becomes hidden, resume when visible
    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearInterval(pollInterval);
      } else {
        // Resume polling when tab becomes visible
        const newInterval = setInterval(() => {
          if (!document.hidden) {
            loadOngoingSessions();
          }
        }, 10000);
        return () => clearInterval(newInterval);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(pollInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadOngoingSessions]);

  /**
   * Listen for data updates and refetch
   */
  useEffect(() => {
    const handleDataUpdate = async () => {
      // Refetch ongoing tasks when data is updated
      await loadOngoingSessions();
      
      // Dispatch event to notify other components
      window.dispatchEvent(new CustomEvent('ongoingTasksDataUpdated'));
    };

    // Listen to all relevant update events
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
  }, [loadOngoingSessions]);

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
   */
  const getProgressPercentage = useCallback((session: Session) => {
    return Math.round((session.sentCount / session.totalPatients) * 100);
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
   * Pause all sessions - memoized (uses backend API)
   */
  const pauseAllSessions = useCallback(async () => {
    try {
      // Get moderator ID from user
      const moderatorId = user?.role === 'moderator' ? Number(user.id) : (user?.assignedModerator ? Number(user.assignedModerator) : undefined);
      
      if (!moderatorId) {
        addToast('لا يمكن تحديد معرف المشرف', 'error');
        return;
      }

      // Pause all sessions for this moderator
      await messageApiClient.pauseAllModeratorMessages(moderatorId);
      addToast('تم إيقاف جميع الجلسات', 'success');

      // Reload sessions to get updated state
      await loadOngoingSessions();
      
      // Dispatch event to notify other components
      window.dispatchEvent(new CustomEvent('messageDataUpdated'));
    } catch (err) {
      logger.error('Failed to pause all sessions:', err);
      addToast('فشل إيقاف جميع الجلسات', 'error');
    }
  }, [user, addToast, loadOngoingSessions]);

  /**
   * Resume all sessions - memoized (uses backend API)
   */
  const resumeAllSessions = useCallback(async () => {
    try {
      // Get moderator ID from user
      const moderatorId = user?.role === 'moderator' ? Number(user.id) : (user?.assignedModerator ? Number(user.assignedModerator) : undefined);
      
      if (!moderatorId) {
        addToast('لا يمكن تحديد معرف المشرف', 'error');
        return;
      }

      // Resume all sessions for this moderator
      await messageApiClient.resumeAllModeratorMessages(moderatorId);
      addToast('تم استئناف جميع الجلسات', 'success');

      // Reload sessions to get updated state
      await loadOngoingSessions();
      
      // Dispatch event to notify other components
      window.dispatchEvent(new CustomEvent('messageDataUpdated'));
    } catch (err) {
      logger.error('Failed to resume all sessions:', err);
      addToast('فشل استئناف جميع الجلسات', 'error');
    }
  }, [user, addToast, loadOngoingSessions]);

  /**
   * Toggle patient pause - memoized (uses backend API)
   */
  const togglePatientPause = useCallback(async (sessionId: string, patientId: string) => {
    try {
      // Find the message ID for this patient in this session
      // Note: We need to get message ID from backend or store it in patient data
      // For now, we'll use the session pause/resume which affects all messages
      const session = sessions.find(s => s.id === sessionId);
      const patient = session?.patients.find(p => p.id === patientId);
      
      if (!patient) return;

      // If patient is paused, resume the message; otherwise pause it
      // Since we don't have message ID directly, we'll pause/resume the session
      // In a full implementation, we'd need to fetch message ID from backend
      if (patient.isPaused) {
        // Resume - for now, resume entire session (can be optimized later)
        await messageApiClient.resumeSession(sessionId);
      } else {
        // Pause - for now, pause entire session (can be optimized later)
        await messageApiClient.pauseSession(sessionId);
      }

      // Reload sessions to get updated state
      await loadOngoingSessions();
      
      // Dispatch event to notify other components
      window.dispatchEvent(new CustomEvent('messageDataUpdated'));
    } catch (err) {
      logger.error('Failed to toggle patient pause:', err);
      addToast('فشل تحديث حالة المريض', 'error');
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
    const confirmed = await confirm(createDeleteConfirmation('هذا المريض'));
    if (confirmed) {
      try {
        await patientsApiClient.deletePatient(Number(patientId));
        addToast('تم حذف المريض بنجاح', 'success');
        
        // Reload sessions to get updated state
        await loadOngoingSessions();
        
        // Dispatch event to notify other components
        window.dispatchEvent(new CustomEvent('patientDataUpdated'));
        window.dispatchEvent(new CustomEvent('messageDataUpdated'));
      } catch (err) {
        logger.error('Failed to delete patient:', err);
        addToast('فشل حذف المريض', 'error');
      }
    }
  }, [confirm, addToast, loadOngoingSessions]);

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
      label: 'الرسائل المرسلة',
      value: sessions.reduce((sum, s) => sum + s.sentCount, 0).toString(),
      icon: 'fa-check-circle',
    },
    {
      label: 'المرضى المتبقيين',
      value: sessions.reduce((sum, s) => sum + (s.totalPatients - s.sentCount), 0).toString(),
      icon: 'fa-users',
    },
  ], [sessions]);

  /**
   * Memoize computed flags
   */
  const { hasAnyPausedPatient, areAllSessionsPaused } = useMemo(() => {
    const hasAnyPaused = sessions.some((session) =>
      session.patients.some((patient) => patient.isPaused)
    );
    const allPaused = sessions.length > 0 && sessions.every((session) =>
      session.patients.every((patient) => patient.isPaused)
    );
    return { hasAnyPausedPatient: hasAnyPaused, areAllSessionsPaused: allPaused };
  }, [sessions]);

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
        className={`text-sm text-gray-700 ${
          isMessagesExpanded ? '' : 'line-clamp-2'
        } max-w-xs`}
        title={patient.messagePreview}
      >
        {patient.messagePreview || 'لا توجد رسالة'}
      </div>
    ),
    status: (
      <div className="flex gap-2">
        <Badge
          color={patient.isPaused ? 'yellow' : 'green'}
          label={patient.isPaused ? '⏸️ موقوف' : '🔄 جاري'}
        />
      </div>
    ),
    failedAttempts: (
      <span
        className={`px-3 py-1 rounded-full text-sm font-medium ${
          (patient.failureMetrics?.attempts ?? 0) > 0
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
          className={`px-2 py-1 rounded text-sm ${
            patient.isPaused
              ? 'bg-green-50 text-green-600 hover:bg-green-100'
              : 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100'
          }`}
          title={patient.isPaused ? 'استئناف' : 'إيقاف'}
        >
          <i className={`fas fa-${patient.isPaused ? 'play' : 'pause'}`}></i>
        </button>
        <button
          onClick={() => handleEditPatient(patient)}
          className="bg-blue-50 text-blue-600 hover:bg-blue-100 px-2 py-1 rounded text-sm"
          title="تعديل"
        >
          <i className="fas fa-edit"></i>
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
  }), [selectedPatients, togglePatientSelection, togglePatientPause, handleEditPatient, handleDeletePatient, isMessagesExpanded]);

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
        title={`المهام الجارية ${sessions.length > 0 ? `- ${sessions[0].doctorName}` : ''}`}
        icon="fa-tasks"
        description={`مراقبة وإدارة جميع المهام الجارية حالياً - ${sessions.length} جلسة`}
        stats={stats}
      />

      {/* Action Buttons */}
      <div className="flex gap-3 mb-6 justify-end flex-wrap">
        <button
          onClick={pauseAllSessions}
          disabled={areAllSessionsPaused}
          className={`px-6 py-3 rounded-lg transition-all flex items-center gap-2 font-medium ${
            areAllSessionsPaused
              ? 'bg-gray-400 text-white cursor-not-allowed'
              : 'bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 shadow-md hover:shadow-lg'
          }`}
        >
          <i className="fas fa-pause-circle"></i>
          <span>إيقاف الكل</span>
        </button>
        <button
          onClick={resumeAllSessions}
          disabled={!hasAnyPausedPatient}
          className={`px-6 py-3 rounded-lg transition-all flex items-center gap-2 font-medium ${
            !hasAnyPausedPatient
              ? 'bg-gray-400 text-white cursor-not-allowed'
              : 'bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700 shadow-md hover:shadow-lg'
          }`}
        >
          <i className="fas fa-play-circle"></i>
          <span>استئناف الكل</span>
        </button>
      </div>

      {/* Sessions List */}
      <div className="space-y-4">
        {sessions.map((session) => {
          const isExpanded = expandedSessions.has(session.id);
          const progressPercent = getProgressPercentage(session);
          const selectedCount = selectedPatients.get(session.id)?.size || 0;

          return (
            <div
              key={session.id}
              className="bg-white rounded-lg shadow overflow-hidden border"
            >
              {/* Session Header - Fully Clickable */}
              <div
                className={`px-6 py-4 border-b cursor-pointer transition-colors ${
                  session.isPaused
                    ? 'bg-gradient-to-r from-yellow-100 to-orange-50'
                    : 'bg-gradient-to-r from-blue-50 to-purple-50 hover:from-blue-100 hover:to-purple-100'
                }`}
                onClick={() => toggleSessionExpand(session.id)}
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
                          className={`h-full ${
                            session.isPaused
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
                        className={`px-3 py-2 rounded text-sm font-medium flex items-center gap-2 whitespace-nowrap transition-all ${
                          session.isPaused
                            ? 'bg-green-500 text-white hover:bg-green-600'
                            : 'bg-yellow-500 text-white hover:bg-yellow-600'
                        }`}
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
                  {/* Session Stats */}
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-white rounded-lg p-4 border border-blue-200">
                      <div className="text-sm text-gray-600">إجمالي المرضى</div>
                      <div className="text-2xl font-bold text-blue-600">{session.totalPatients}</div>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-green-200">
                      <div className="text-sm text-gray-600">الرسائل المرسلة</div>
                      <div className="text-2xl font-bold text-green-600">{session.sentCount}</div>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-red-200">
                      <div className="text-sm text-gray-600">الفاشلة</div>
                      <div className="text-2xl font-bold text-red-600">{session.failedCount}</div>
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
                                className={`fas text-white text-xs ${
                                  selectedCount === session.totalPatients ? 'fa-check' : 'fa-minus'
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
                              const row = renderPatientRow(patient, session.id);
                              return (
                                <tr
                                  key={patient.id}
                                  className={`border-b hover:bg-gray-50 transition-colors ${
                                    patient.isPaused ? 'bg-yellow-50' : ''
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
