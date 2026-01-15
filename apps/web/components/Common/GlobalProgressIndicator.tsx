'use client';

import React, { useState } from 'react';
import { useGlobalProgress } from '@/contexts/GlobalProgressContext';
import { useWhatsAppSession, DetailedSessionStatus } from '@/contexts/WhatsAppSessionContext';
import { useUI } from '@/contexts/UIContext';
import { useQueue } from '@/contexts/QueueContext';
import { useAuth } from '@/contexts/AuthContext';
import { translatePauseReason } from '@/utils/pauseReasonTranslations';
import { parseAsUtc } from '@/utils/dateTimeUtils';

/**
 * GlobalProgressIndicator
 * 
 * Floating widget that displays ongoing message sending operations.
 * Visible on ALL pages - persists across navigation.
 * 
 * Features:
 * - Collapsible UI (minimized by default)
 * - Overall progress aggregation
 * - Per-session progress breakdown when expanded
 * - Visual indicators for paused sessions
 * - Fixed position (bottom-right corner)
 * - Minimizable to a small floating button
 */
export const GlobalProgressIndicator: React.FC = () => {
  const { operations, hasOngoingOperations, isLoading } = useGlobalProgress();
  const { detailedStatus, extensionStatus, sessionStatus } = useWhatsAppSession();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  const { setCurrentPanel, currentPanel } = useUI();
  const { selectedModeratorId } = useQueue();
  const { user } = useAuth();

  // Check if current user is Admin
  const isAdmin = user?.role === 'primary_admin' || user?.role === 'secondary_admin';

  // Navigate to WhatsApp Auth tab in management panel (same pattern as Header.tsx)
  // Navigate to WhatsApp Auth tab in management panel (same pattern as Header.tsx)
  const handleWhatsAppAuthClick = () => {
    // Disable navigation for Admins (they don't have this tab in their view)
    if (isAdmin) return;

    // Persist desired tab (used when management panel mounts)
    sessionStorage.setItem('userManagementActiveTab', 'whatsappAuth');

    const dispatchTabSwitch = () => {
      // Used when management panel is already mounted (same-panel navigation)
      window.dispatchEvent(
        new CustomEvent('userManagementActiveTabChange', { detail: 'whatsappAuth' })
      );
    };

    if (currentPanel === 'management') {
      // Already on management panel: force-switch tab immediately
      dispatchTabSwitch();
      return;
    }

    // Navigate to management panel, then request tab switch (next tick)
    setCurrentPanel('management');
    setTimeout(dispatchTabSwitch, 0);
  };

  // Helper to get status display info
  const getConnectionStatusDisplay = () => {
    const statusMap: Record<DetailedSessionStatus, { color: string; icon: string; label: string; bgColor: string }> = {
      'connected_idle': { color: 'text-green-600', icon: 'fa-check-circle', label: 'متصل وجاهز للإرسال', bgColor: 'bg-green-500' },
      'connected_sending': { color: 'text-green-600', icon: 'fa-paper-plane', label: 'جاري الإرسال...', bgColor: 'bg-green-500' },
      'connected_paused': { color: 'text-amber-600', icon: 'fa-pause-circle', label: 'متوقف - اضغط استئناف', bgColor: 'bg-amber-500' },
      'extension_connected': { color: 'text-blue-600', icon: 'fa-plug', label: 'اضغط "فتح واتساب" في الإضافة', bgColor: 'bg-blue-500' },
      'extension_disconnected': { color: 'text-orange-600', icon: 'fa-exclamation-triangle', label: 'افتح المتصفح وشغّل الإضافة', bgColor: 'bg-orange-500' },
      'no_extension': { color: 'text-gray-500', icon: 'fa-plug', label: 'افتح الإضافة واضغط "بدء الجلسة"', bgColor: 'bg-gray-400' },
      'pending_qr': { color: 'text-yellow-600', icon: 'fa-qrcode', label: 'امسح QR من هاتفك', bgColor: 'bg-yellow-500' },
      'pending_net': { color: 'text-orange-600', icon: 'fa-wifi', label: 'تحقق من الإنترنت', bgColor: 'bg-orange-500' },
      'browser_closed': { color: 'text-red-600', icon: 'fa-window-close', label: 'أعد فتح المتصفح', bgColor: 'bg-red-500' },
      'disconnected': { color: 'text-gray-500', icon: 'fa-plug', label: 'افتح الإضافة واضغط "بدء الجلسة"', bgColor: 'bg-gray-400' },
      'loading': { color: 'text-gray-500', icon: 'fa-spinner fa-spin', label: 'جاري التحميل...', bgColor: 'bg-gray-400' },
    };
    return statusMap[detailedStatus] || statusMap['no_extension'];
  };

  const connectionStatus = getConnectionStatusDisplay();

  // Toggle session message list expansion
  const toggleSessionExpansion = (sessionId: string) => {
    setExpandedSessions(prev => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  };

  /**
   * Calculate advanced metrics for each operation
   */
  const calculateMetrics = (op: any) => {
    const now = Date.now();
    const startTime = parseAsUtc(op.startedAt)?.getTime() || now;
    const elapsedSeconds = (now - startTime) / 1000;

    // Messages per second
    const messagesPerSecond = elapsedSeconds > 0
      ? op.sentMessages / elapsedSeconds
      : 0;

    // Remaining messages
    const remainingMessages = op.totalMessages - op.sentMessages;

    // Estimated time remaining (in seconds)
    const estimatedSeconds = messagesPerSecond > 0
      ? remainingMessages / messagesPerSecond
      : 0;

    // Format ETA
    let etaText = 'جاري الحساب...';
    if (messagesPerSecond > 0 && remainingMessages > 0) {
      if (estimatedSeconds < 60) {
        etaText = `${Math.ceil(estimatedSeconds)} ثانية`;
      } else if (estimatedSeconds < 3600) {
        const minutes = Math.ceil(estimatedSeconds / 60);
        etaText = `${minutes} دقيقة`;
      } else {
        const hours = Math.floor(estimatedSeconds / 3600);
        const minutes = Math.ceil((estimatedSeconds % 3600) / 60);
        etaText = `${hours} ساعة و ${minutes} دقيقة`;
      }
    } else if (remainingMessages === 0) {
      etaText = 'مكتمل';
    }

    return {
      messagesPerSecond: messagesPerSecond.toFixed(2),
      etaText,
      elapsedMinutes: Math.floor(elapsedSeconds / 60),
      elapsedSeconds: Math.floor(elapsedSeconds % 60),
    };
  };

  // Don't render if no ongoing operations and not loading
  // Also don't render if no moderator is selected (Admin hasn't selected a queue yet)
  if ((!hasOngoingOperations && !isLoading) || selectedModeratorId === null) {
    return null;
  }

  // Calculate overall progress
  const totalMessages = operations.reduce((sum, op) => sum + op.totalMessages, 0);
  const sentMessages = operations.reduce((sum, op) => sum + op.sentMessages, 0);
  const failedMessages = operations.reduce((sum, op) => sum + op.failedMessages, 0);
  const progressPercent = totalMessages > 0 ? Math.round((sentMessages / totalMessages) * 100) : 0;
  const totalOperations = operations.length;

  // Check if any operations are paused
  const hasPausedOperations = operations.some(op => op.isPaused);

  // Count messages with 'sending' status
  const sendingCount = operations.reduce((sum, op) =>
    sum + (op.messages?.filter((m: any) => m.status === 'sending').length || 0), 0);

  // Minimized view - small floating button with connection status
  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
        {/* Connection status mini badge */}
        <div
          className={`px-2 py-1 rounded-full text-xs font-medium text-white flex items-center gap-1 shadow-md ${connectionStatus.bgColor}`}
          title={connectionStatus.label}
        >
          <i className={`fas ${connectionStatus.icon} text-[10px]`}></i>
          <span className="hidden sm:inline">{connectionStatus.label}</span>
        </div>

        {/* Main floating button */}
        <button
          onClick={() => setIsMinimized(false)}
          className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 ${hasPausedOperations
            ? 'bg-yellow-500 hover:bg-yellow-600'
            : 'bg-blue-500 hover:bg-blue-600'
            }`}
          title={`${totalOperations} عمليات إرسال - ${sentMessages}/${totalMessages} (${progressPercent}%)`}
          style={{ boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)' }}
        >
          <div className="relative">
            {/* Send icon or pause icon */}
            <svg
              className={`w-6 h-6 text-white ${!hasPausedOperations ? 'animate-pulse' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {hasPausedOperations ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              )}
            </svg>

            {/* Progress circle around button */}
            <svg className="absolute -inset-1 w-8 h-8 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="16" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
              <circle
                cx="18" cy="18" r="16"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeDasharray={`${progressPercent} 100`}
                strokeLinecap="round"
              />
            </svg>

            {/* Badge for sending count */}
            {sendingCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-green-500 text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
                {sendingCount}
              </span>
            )}
          </div>
        </button>
      </div>
    );
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-50 bg-white shadow-2xl rounded-lg border-2 border-gray-200 min-w-[320px] max-w-[420px] transition-all duration-300"
      style={{
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
        maxHeight: isExpanded ? '500px' : 'auto'
      }}
    >
      {/* Connection Status Bar - Clickable for navigation to WhatsApp auth */}
      <div
        className={`px-4 py-2 rounded-t-lg flex items-center justify-between transition-opacity ${detailedStatus === 'connected_idle' || detailedStatus === 'connected_sending'
          ? 'bg-green-50 border-b border-green-200'
          : detailedStatus === 'extension_connected'
            ? 'bg-blue-50 border-b border-blue-200'
            : detailedStatus === 'connected_paused'
              ? 'bg-amber-50 border-b border-amber-200'
              : detailedStatus === 'pending_qr' || detailedStatus === 'pending_net'
                ? 'bg-yellow-50 border-b border-yellow-200'
                : 'bg-red-50 border-b border-red-200'
          } ${!isAdmin ? 'cursor-pointer hover:opacity-90' : 'cursor-default'}`}
        onClick={handleWhatsAppAuthClick}
        title={!isAdmin ? "انقر للانتقال إلى صفحة مصادقة واتساب" : "حالة اتصال المشرف"}>
        <div className="flex items-center gap-2">
          <i className={`fas ${connectionStatus.icon} ${connectionStatus.color}`}></i>
          <span className={`text-xs font-medium ${connectionStatus.color}`}>
            {connectionStatus.label}
          </span>
        </div>
        {/* Show guidance for extension_connected state, otherwise show short device name */}
        {detailedStatus === 'extension_connected' ? (
          <span className="text-xs text-blue-600">
            اضغط &quot;فتح واتساب&quot;
          </span>
        ) : extensionStatus?.deviceName && (
          <span className="text-xs text-gray-500">
            {/* Show short device name (extract browser name only) */}
            {extensionStatus.deviceName.includes('Chrome') ? 'Chrome' :
              extensionStatus.deviceName.includes('Firefox') ? 'Firefox' :
                extensionStatus.deviceName.includes('Edge') ? 'Edge' :
                  extensionStatus.deviceName.includes('Safari') ? 'Safari' :
                    extensionStatus.deviceName.split(' ')[0]}
          </span>
        )}
      </div>

      {/* Header - Collapsed View */}
      <div
        className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Minimize button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsMinimized(true);
              }}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded"
              title="تصغير"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>

            {/* Animated sending icon */}
            <div className={`${hasPausedOperations ? '' : 'animate-pulse'}`}>
              <svg
                className={`w-6 h-6 ${hasPausedOperations ? 'text-yellow-500' : 'text-blue-500'}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {hasPausedOperations ? (
                  // Pause icon
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                ) : (
                  // Send/paper plane icon
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                )}
              </svg>
            </div>

            {/* Operation count and status */}
            <div>
              <div className="text-sm font-semibold text-gray-900">
                {totalOperations} {totalOperations === 1 ? 'عملية إرسال' : 'عمليات إرسال'} {hasPausedOperations ? 'موقوفة' : 'جارية'}
              </div>
              <div className="text-xs text-gray-600 mt-0.5">
                {sentMessages} / {totalMessages} رسالة ({progressPercent}%)
                {failedMessages > 0 && (
                  <span className="text-red-600 mr-1">
                    ({failedMessages} فشل)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Expand/Collapse button */}
          <button
            className="text-gray-400 hover:text-gray-600 transition-colors p-1"
            aria-label={isExpanded ? 'طي' : 'توسيع'}
          >
            <svg
              className={`w-5 h-5 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
        </div>

        {/* Overall progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
          <div
            className={`h-2 rounded-full transition-all duration-500 ${hasPausedOperations
              ? 'bg-yellow-500'
              : progressPercent === 100
                ? 'bg-green-500'
                : 'bg-blue-500'
              }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Expanded View - Per-Session Details */}
      {isExpanded && (
        <div className="border-t border-gray-200 max-h-[400px] overflow-y-auto">
          {isLoading && operations.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2" />
              <div className="text-sm">جاري التحميل...</div>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {operations.map((op, index) => {
                const opProgressPercent = op.totalMessages > 0
                  ? Math.round((op.sentMessages / op.totalMessages) * 100)
                  : 0;

                return (
                  <div
                    key={op.sessionId}
                    className={`p-3 rounded-lg border ${op.isPaused
                      ? 'bg-yellow-50 border-yellow-200'
                      : 'bg-gray-50 border-gray-200'
                      }`}
                  >
                    {/* Session header */}
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900">
                          {op.queueName}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {parseAsUtc(op.startedAt)?.toLocaleTimeString('ar-EG', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </div>

                      {/* Status badge */}
                      {op.isPaused && (
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                          موقوف
                        </span>
                      )}
                    </div>

                    {/* Progress bar */}
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                      <div
                        className={`h-2 rounded-full transition-all ${op.isPaused
                          ? 'bg-yellow-500'
                          : opProgressPercent === 100
                            ? 'bg-green-500'
                            : 'bg-blue-500'
                          }`}
                        style={{ width: `${opProgressPercent}%` }}
                      />
                    </div>

                    {/* Session stats */}
                    <div className="flex justify-between items-center text-xs">
                      <div className="text-gray-700">
                        <span className="font-medium">{op.sentMessages}</span>
                        <span className="text-gray-500"> / {op.totalMessages}</span>
                        {op.failedMessages > 0 && (
                          <span className="text-red-600 mr-1">
                            {' '}({op.failedMessages} فشل)
                          </span>
                        )}
                      </div>
                      <div className="text-gray-600">
                        {opProgressPercent}%
                      </div>
                    </div>

                    {/* Pause reason */}
                    {op.isPaused && op.pauseReason && (
                      <div className="mt-2 pt-2 border-t border-yellow-200">
                        <div className="text-xs text-yellow-800">
                          <span className="font-medium">سبب التوقف:</span> {translatePauseReason(op.pauseReason)}
                        </div>
                      </div>
                    )}

                    {/* Message details toggle */}
                    {op.messages && op.messages.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-200">
                        <button
                          onClick={() => toggleSessionExpansion(op.sessionId)}
                          className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
                        >
                          <svg
                            className={`w-4 h-4 transform transition-transform ${expandedSessions.has(op.sessionId) ? 'rotate-90' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                          {expandedSessions.has(op.sessionId) ? 'إخفاء' : 'عرض'} تفاصيل الرسائل ({op.messages.length})
                        </button>

                        {/* Expanded message list */}
                        {expandedSessions.has(op.sessionId) && (
                          <div className="mt-2 space-y-1.5 max-h-[200px] overflow-y-auto">
                            {op.messages.map((msg) => (
                              <div
                                key={msg.messageId || `${msg.patientId}-${msg.status}`}
                                className={`p-2 rounded text-xs border ${msg.isPaused
                                  ? 'bg-yellow-50 border-yellow-200'
                                  : msg.status === 'sent'
                                    ? 'bg-green-50 border-green-200'
                                    : msg.status === 'failed'
                                      ? 'bg-red-50 border-red-200'
                                      : msg.status === 'sending'
                                        ? 'bg-blue-50 border-blue-200 animate-pulse'
                                        : 'bg-gray-50 border-gray-200'
                                  }`}
                              >
                                <div className="flex justify-between items-start mb-1">
                                  <div className="font-medium text-gray-900 truncate flex-1">
                                    {msg.patientName}
                                  </div>
                                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${msg.status === 'sent'
                                    ? 'bg-green-100 text-green-800'
                                    : msg.status === 'failed'
                                      ? 'bg-red-100 text-red-800'
                                      : msg.status === 'sending'
                                        ? 'bg-blue-100 text-blue-800 animate-pulse'
                                        : 'bg-gray-100 text-gray-800'
                                    }`}>
                                    {msg.status === 'sent' && '✅ تم الإرسال'}
                                    {msg.status === 'failed' && '❌ فشل'}
                                    {msg.status === 'sending' && (
                                      <>
                                        <svg className="animate-spin h-2.5 w-2.5 text-blue-600" fill="none" viewBox="0 0 24 24">
                                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        📤 جاري الإرسال
                                      </>
                                    )}
                                    {msg.status === 'queued' && '⏳ في الانتظار'}
                                    {msg.status === 'pending' && '⏳ معلق'}
                                  </span>
                                </div>

                                <div className="text-gray-600 text-[10px]">
                                  {msg.countryCode} {msg.patientPhone}
                                </div>                                {msg.attempts > 0 && (
                                  <div className="text-orange-600 text-[10px] mt-0.5">
                                    المحاولة: {msg.attempts}
                                  </div>
                                )}

                                {msg.failedReason && (
                                  <div className="text-red-600 text-[10px] mt-1 pt-1 border-t border-red-200">
                                    {msg.failedReason}
                                  </div>
                                )}

                                {msg.isPaused && (
                                  <div className="text-yellow-700 text-[10px] mt-1 pt-1 border-t border-yellow-200">
                                    موقوف مؤقتاً
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Footer note when collapsed */}
      {!isExpanded && totalOperations > 1 && (
        <div className="px-4 pb-3 text-center">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(true);
            }}
            className="text-xs text-blue-600 hover:text-blue-700 hover:underline"
          >
            اضغط لعرض التفاصيل
          </button>
        </div>
      )}
    </div>
  );
};

export default GlobalProgressIndicator;
