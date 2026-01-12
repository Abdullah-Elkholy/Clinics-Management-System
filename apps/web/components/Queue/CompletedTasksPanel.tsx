'use client';

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useUI } from '@/contexts/UIContext';
import * as messageApiClient from '@/services/api/messageApiClient';
// Mock data removed - using API data instead
import { PanelWrapper } from '@/components/Common/PanelWrapper';
import { PanelHeader } from '@/components/Common/PanelHeader';
import { EmptyState } from '@/components/Common/EmptyState';
import { Badge } from '@/components/Common/ResponsiveUI';
import UsageGuideSection from '@/components/Common/UsageGuideSection';
import { Patient } from '@/types';
import { UserRole } from '@/types/roles';
import { formatPhoneForDisplay } from '@/utils/phoneUtils';
import logger from '@/utils/logger';
import { formatLocalDateTime, formatLocalDate } from '@/utils/dateTimeUtils';
import { useSignalR } from '@/contexts/SignalRContext';
import { debounce } from '@/utils/debounce';

interface SentMessage {
  messageId: string;
  patientId: number;
  patientName: string;
  patientPhone: string;
  countryCode: string;
  content: string;
  sentAt: string;
  createdBy?: number;
  updatedBy?: number;
}

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
  queuedCount: number;  // Number of queued/pending messages
  hasFailedMessages: boolean;
  hasOngoingMessages: boolean;  // True if session still has queued/sending messages
  isFullyCompleted: boolean;  // True if all messages are sent or failed
  sessionStatus: 'in_progress' | 'completed';
  completedAt: string;
  sentMessages: SentMessage[];
}

const COMPLETED_TASKS_GUIDE_ITEMS = [
  {
    title: '',
    description: 'هنا تجد جميع الجلسات التي تمت معالجتها بنجاح'
  },
  {
    title: '',
    description: 'يمكنك عرض تفاصيل كل جلسة والمرضى المرسل إليهم'
  },
  {
    title: '',
    description: 'يتم حفظ كل البيانات المكتملة للمراجعة والتقارير'
  },
  {
    title: '',
    description: 'نسبة النجاح توضح فعالية كل جلسة'
  },
];

export default function CompletedTasksPanel() {
  const { user, isAuthenticated } = useAuth();
  const { addToast } = useUI();
  const router = useRouter();

  // ALL hooks must be declared BEFORE any conditional returns
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  const [isMessagesExpanded, setIsMessagesExpanded] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ref for request deduplication
  const isLoadingRef = useRef(false);

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
   * Load completed sessions from backend API
   * Includes request deduplication to prevent multiple simultaneous calls
   */
  const loadCompletedSessions = useCallback(async () => {
    // Request deduplication: skip if already loading
    if (isLoadingRef.current) {
      logger.debug('CompletedTasksPanel: Skipping duplicate loadCompletedSessions call');
      return;
    }

    try {
      isLoadingRef.current = true;
      setIsLoading(true);
      setError(null);

      const response = await messageApiClient.getCompletedSessions();

      if (response.success && response.data) {
        // Transform API response to Session format
        const transformedSessions: Session[] = response.data.map((session: any) => ({
          id: String(session.sessionId),
          sessionId: String(session.sessionId),
          queueId: session.queueId,
          clinicName: session.queueName,
          doctorName: session.queueName,
          createdAt: session.startTime,
          totalPatients: session.total,
          sentCount: session.sent,
          failedCount: session.failed || 0,
          queuedCount: session.queued || 0,
          hasFailedMessages: session.hasFailedMessages || false,
          hasOngoingMessages: session.hasOngoingMessages || false,
          isFullyCompleted: session.isFullyCompleted ?? true,
          sessionStatus: session.sessionStatus || 'completed',
          completedAt: session.completedAt,
          sentMessages: (session.sentMessages || []).map((msg: any) => ({
            messageId: msg.messageId,
            patientId: msg.patientId,
            patientName: msg.patientName,
            patientPhone: msg.patientPhone,
            countryCode: msg.countryCode,
            content: msg.content,
            sentAt: msg.sentAt,
            createdBy: msg.createdBy,
            updatedBy: msg.updatedBy,
          } as SentMessage)),
        }));

        // CompletedTasksPanel shows ALL completed sessions for the moderator across all queues (no filtering by selectedQueueId)
        // These panels are global for the moderator and WhatsAppSession, not queue-specific

        setSessions(transformedSessions);
      }
    } catch (err: any) {
      // Check if error is due to PendingQR (authentication required)
      if (err?.code === 'AUTHENTICATION_REQUIRED' || err?.error === 'PendingQR' || err?.message?.includes('PendingQR')) {
        logger.warn('WhatsApp session requires authentication (PendingQR):', err);
        addToast('جلسة الواتساب تحتاج إلى المصادقة. يرجى المصادقة أولاً.', 'warning');
        setSessions([]);
        setError('جلسة الواتساب تحتاج إلى المصادقة. يرجى الذهاب إلى لوحة مصادقة الواتساب للمصادقة.');
      } else {
        const errorMessage = err instanceof Error ? err.message : 'فشل تحميل الجلسات المكتملة';
        setError(errorMessage);
        logger.error('Failed to load completed sessions:', err);
        addToast('فشل تحميل الجلسات المكتملة', 'error');
      }
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  }, [addToast]);

  /**
   * Load sessions on mount and when data updates
   */
  useEffect(() => {
    loadCompletedSessions();
  }, [loadCompletedSessions]);

  /**
   * SignalR Integration - Real-time updates for completed sessions
   * Listens for SessionUpdated and MessageUpdated events
   */
  const { connection, isConnected, on, off } = useSignalR();

  // Debounced refresh function to prevent rapid-fire API calls
  const debouncedRefresh = React.useMemo(
    () => debounce(() => {
      loadCompletedSessions();
    }, 2000), // 2 second debounce
    [loadCompletedSessions]
  );

  // Subscribe to SignalR events for real-time completed session updates
  useEffect(() => {
    if (!connection || !isConnected) return;

    // Handler for session/message updates (debounced)
    const handleUpdate = (payload: any) => {
      logger.debug('CompletedTasksPanel: Received update event', payload);
      debouncedRefresh();
    };

    // Subscribe to events using context helpers
    on('SessionUpdated', handleUpdate);
    on('MessageUpdated', handleUpdate);
    on('SessionDeleted', handleUpdate);

    // Cleanup subscriptions
    return () => {
      off('SessionUpdated', handleUpdate);
      off('MessageUpdated', handleUpdate);
      off('SessionDeleted', handleUpdate);
    };
  }, [connection, isConnected, on, off, debouncedRefresh]);

  /**
   * Listen for data updates and refetch (debounced to prevent duplicate calls)
   * Note: SignalR events are primary, window events are fallback for backwards compatibility
   */
  useEffect(() => {
    const handleDataUpdate = () => {
      // Use debounced refresh to prevent rapid-fire API calls
      debouncedRefresh();

      // Dispatch event to notify other components
      window.dispatchEvent(new CustomEvent('completedTasksDataUpdated'));
    };

    // Listen to all relevant update events
    window.addEventListener('patientDataUpdated', handleDataUpdate);
    window.addEventListener('queueDataUpdated', handleDataUpdate);
    window.addEventListener('templateDataUpdated', handleDataUpdate);
    window.addEventListener('messageDataUpdated', handleDataUpdate);
    window.addEventListener('conditionDataUpdated', handleDataUpdate);

    return () => {
      window.removeEventListener('patientDataUpdated', handleDataUpdate);
      window.removeEventListener('queueDataUpdated', handleDataUpdate);
      window.removeEventListener('templateDataUpdated', handleDataUpdate);
      window.removeEventListener('messageDataUpdated', handleDataUpdate);
      window.removeEventListener('conditionDataUpdated', handleDataUpdate);
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
   * Memoize computed stats
   */
  const stats = useMemo(() => [
    {
      label: 'إجمالي الجلسات المكتملة',
      value: sessions.length.toString(),
      icon: 'fa-check-double',
    },
    {
      label: 'الرسائل المرسلة بنجاح',
      value: sessions.reduce((sum, s) => sum + s.sentCount, 0).toString(),
      icon: 'fa-check-circle',
    },
    {
      label: 'إجمالي الرسائل المرسلة',
      value: sessions.reduce((sum, s) => sum + s.sentMessages.length, 0).toString(),
      icon: 'fa-users',
    },
  ], [sessions]);

  /**
   * Memoize table columns - no checkbox since deletion is disabled, no status column
   */
  const tableColumns = useMemo(() => [
    { key: 'name', label: 'الاسم', width: '25%' },
    { key: 'phone', label: 'رقم الجوال', width: '20%' },
    { key: 'message', label: 'الرسالة', width: '35%', hasToggle: true },
    { key: 'completedAt', label: 'وقت الإكمال', width: '20%' },
  ], []);

  /**
   * Render sent message row - displays resolved content from backend
   */
  const renderSentMessageRow = useCallback((message: SentMessage) => ({
    id: message.messageId,
    name: message.patientName,
    phone: formatPhoneForDisplay(message.patientPhone, message.countryCode),
    message: (
      <div
        className={`text-sm text-gray-700 whitespace-pre-wrap ${isMessagesExpanded ? '' : 'line-clamp-2'
          } max-w-xs`}
        title={message.content}
      >
        {message.content || 'لا توجد رسالة'}
      </div>
    ),
    completedAt: message.sentAt ? formatLocalDateTime(message.sentAt) : 'غير معروف',
  }), [isMessagesExpanded]);

  if (sessions.length === 0) {
    return (
      <PanelWrapper>
        <PanelHeader
          title="المهام المكتملة"
          icon="fa-check-double"
          description={`عرض جميع المهام المكتملة والمرسلة بنجاح - 0 جلسة`}
          stats={stats}
        />
        <EmptyState
          icon="fa-inbox"
          title="لا توجد مهام مكتملة"
          message="جميع المهام قيد المعالجة أو لم تبدأ بعد"
          actionLabel="العودة للصفحة الرئيسية"
          onAction={() => window.history.back()}
        />
      </PanelWrapper>
    );
  }

  return (
    <PanelWrapper>
      <PanelHeader
        title={`المهام المكتملة ${sessions.length > 0 ? `- ${sessions[0].doctorName}` : ''}`}
        icon="fa-check-double"
        description={`عرض جميع المهام المكتملة والمرسلة بنجاح - ${sessions.length} جلسة`}
        stats={stats}
      />
      <div className="space-y-4">
        {sessions.map((session) => {
          const isExpanded = expandedSessions.has(session.id);
          const progressPercent = Math.round((session.sentCount / session.totalPatients) * 100);

          return (
            <div
              key={session.id}
              className={`bg-white rounded-lg shadow overflow-hidden border ${session.isFullyCompleted ? 'border-green-200' : 'border-blue-200'}`}
            >
              {/* Session Header - Fully Clickable */}
              <div
                className={`px-6 py-4 border-b cursor-pointer transition-colors ${
                  session.isFullyCompleted 
                    ? 'bg-gradient-to-r from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100' 
                    : 'bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100'
                }`}
                onClick={() => toggleSessionExpand(session.id)}
              >
                <div className="flex items-center gap-4 justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    {/* Collapse Button with Improved UI */}
                    <div className="flex items-center gap-2">
                      <button className={`${session.isFullyCompleted ? 'text-green-600' : 'text-blue-600'} text-xl transition-transform duration-300`}>
                        <i className={`fas fa-chevron-${isExpanded ? 'down' : 'left'}`}></i>
                      </button>
                      <span className={`text-sm font-medium ${session.isFullyCompleted ? 'text-green-600' : 'text-blue-600'} whitespace-nowrap`}>القائمة</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-bold text-gray-900 text-lg">{session.clinicName}</h3>
                        {session.isFullyCompleted ? (
                          <Badge color="green" label="✓ مكتملة" />
                        ) : (
                          <Badge color="blue" label="⏳ متبقية" />
                        )}
                        {session.hasOngoingMessages && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                            {session.queuedCount} رسالة متبقية
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 mt-2">
                        <span>جلسة: <strong>{session.sessionId}</strong></span>
                        <span className="mx-4">تاريخ الإنشاء: <strong>{session.createdAt ? formatLocalDateTime(session.createdAt) : 'غير محدد'}</strong></span>
                        {session.isFullyCompleted && (
                          <span className="mx-4">تاريخ الإكمال: <strong>{session.completedAt ? formatLocalDateTime(session.completedAt) : 'غير محدد'}</strong></span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Completion Summary */}
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-700 mb-1">نسبة الإرسال</div>
                      <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${session.isFullyCompleted ? 'bg-green-500' : 'bg-blue-500'}`}
                          style={{ width: `${progressPercent}%` }}
                        ></div>
                      </div>
                      <div className="text-xs text-gray-600 mt-1">{progressPercent}%</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Session Content (Expandable) */}
              {isExpanded && (
                <div className="p-6 bg-gray-50">
                  {/* In Progress Notice */}
                  {session.hasOngoingMessages && (
                    <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
                      <i className="fas fa-clock text-blue-600 text-lg mt-0.5"></i>
                      <div className="flex-1">
                        <h5 className="font-semibold text-blue-800 mb-1">رسائل متبقية</h5>
                        <p className="text-sm text-blue-700">
                          هذه الجلسة لديها <strong>{session.queuedCount}</strong> رسالة متبقية. 
                          القائمة أدناه تعرض الرسائل المرسلة بنجاح حتى الآن.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Session Stats */}
                  <div className={`grid ${session.hasOngoingMessages ? 'grid-cols-5' : 'grid-cols-4'} gap-4 mb-6`}>
                    <div className="bg-white rounded-lg p-4 border border-blue-200">
                      <div className="text-sm text-gray-600 flex items-center gap-1">
                        <i className="fas fa-users text-blue-500 text-xs"></i>
                        إجمالي الرسائل
                      </div>
                      <div className="text-2xl font-bold text-blue-600">{session.totalPatients}</div>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-green-200">
                      <div className="text-sm text-gray-600 flex items-center gap-1">
                        <i className="fas fa-check-circle text-green-500 text-xs"></i>
                        تم الإرسال
                      </div>
                      <div className="text-2xl font-bold text-green-600">{session.sentCount}</div>
                    </div>
                    {session.hasOngoingMessages && (
                      <div className="bg-white rounded-lg p-4 border border-blue-200">
                        <div className="text-sm text-gray-600 flex items-center gap-1">
                          <i className="fas fa-clock text-blue-500 text-xs"></i>
                          متبقية
                        </div>
                        <div className="text-2xl font-bold text-blue-600">{session.queuedCount}</div>
                      </div>
                    )}
                    <div className="bg-white rounded-lg p-4 border border-red-200">
                      <div className="text-sm text-gray-600 flex items-center gap-1">
                        <i className="fas fa-times-circle text-red-500 text-xs"></i>
                        فشل
                      </div>
                      <div className="text-2xl font-bold text-red-600">{session.failedCount}</div>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-green-200">
                      <div className="text-sm text-gray-600 flex items-center gap-1">
                        <i className="fas fa-percentage text-green-500 text-xs"></i>
                        معدل النجاح
                      </div>
                      <div className="text-2xl font-bold text-green-600">
                        {session.totalPatients > 0 ? Math.round((session.sentCount / session.totalPatients) * 100) : 0}%
                      </div>
                    </div>
                  </div>

                  {/* Failed Messages Disclaimer */}
                  {session.hasFailedMessages && (
                    <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
                      <i className="fas fa-exclamation-triangle text-yellow-600 text-lg mt-0.5"></i>
                      <div className="flex-1">
                        <h5 className="font-semibold text-yellow-800 mb-1">تنبيه: يوجد رسائل فاشلة في هذه الجلسة</h5>
                        <p className="text-sm text-yellow-700">
                          تحتوي هذه الجلسة على <strong>{session.failedCount}</strong> رسالة فاشلة. القائمة أدناه تعرض فقط الرسائل المرسلة بنجاح.
                          لعرض الرسائل الفاشلة وأسباب الفشل، يرجى زيارة لوحة المهام الفاشلة.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Sent Messages Table */}
                  <div className="bg-white rounded-lg overflow-hidden border">
                    <div className="px-6 py-4 bg-gray-50 border-b flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <h4 className="font-bold text-gray-800">الرسائل المرسلة بنجاح</h4>
                        <span className="text-sm text-gray-600">
                          {session.sentMessages.length} رسالة
                        </span>
                      </div>
                      <div className="flex gap-2">
                        {/* Deletion and selection controls intentionally removed - completed messages cannot be deleted */}
                      </div>
                    </div>

                    {session.sentMessages.length === 0 ? (
                      <div className="p-8 text-center text-gray-600">
                        <i className="fas fa-inbox text-3xl mb-2 opacity-50"></i>
                        <p>لا توجد رسائل مرسلة في هذه الجلسة</p>
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
                            {session.sentMessages.map((message) => {
                              const row = renderSentMessageRow(message);
                              return (
                                <tr
                                  key={message.messageId}
                                  className="border-b hover:bg-gray-50 transition-colors"
                                >
                                  <td className="px-6 py-3 text-sm text-gray-900 font-medium">{row.name}</td>
                                  <td className="px-6 py-3 text-sm text-gray-600">{row.phone}</td>
                                  <td className="px-6 py-3 text-sm text-gray-700">{row.message}</td>
                                  <td className="px-6 py-3 text-sm text-gray-600">{row.completedAt}</td>
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

      {/* Info Box */}
      <UsageGuideSection
        items={COMPLETED_TASKS_GUIDE_ITEMS}
      />
    </PanelWrapper>
  );
}
