'use client';

import React, { useState } from 'react';
import { useGlobalProgress } from '@/contexts/GlobalProgressContext';

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
 */
export const GlobalProgressIndicator: React.FC = () => {
  const { operations, hasOngoingOperations, isLoading } = useGlobalProgress();
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());

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
    const startTime = new Date(op.startedAt).getTime();
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
  if (!hasOngoingOperations && !isLoading) {
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

  return (
    <div 
      className="fixed bottom-4 right-4 z-50 bg-white shadow-2xl rounded-lg border-2 border-gray-200 min-w-[320px] max-w-[420px] transition-all duration-300"
      style={{ 
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
        maxHeight: isExpanded ? '500px' : 'auto'
      }}
    >
      {/* Header - Collapsed View */}
      <div 
        className="p-4 cursor-pointer hover:bg-gray-50 transition-colors rounded-t-lg"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
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
            className={`h-2 rounded-full transition-all duration-500 ${
              hasPausedOperations 
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
                    className={`p-3 rounded-lg border ${
                      op.isPaused 
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
                          {new Date(op.startedAt).toLocaleTimeString('ar-EG', {
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
                        className={`h-2 rounded-full transition-all ${
                          op.isPaused 
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
                          <span className="font-medium">سبب التوقف:</span> {op.pauseReason}
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
                                className={`p-2 rounded text-xs border ${
                                  msg.isPaused
                                    ? 'bg-yellow-50 border-yellow-200'
                                    : msg.status === 'sent'
                                      ? 'bg-green-50 border-green-200'
                                      : msg.status === 'failed'
                                        ? 'bg-red-50 border-red-200'
                                        : msg.status === 'sending'
                                          ? 'bg-blue-50 border-blue-200'
                                          : 'bg-gray-50 border-gray-200'
                                }`}
                              >
                                <div className="flex justify-between items-start mb-1">
                                  <div className="font-medium text-gray-900 truncate flex-1">
                                    {msg.patientName}
                                  </div>
                                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                    msg.status === 'sent'
                                      ? 'bg-green-100 text-green-800'
                                      : msg.status === 'failed'
                                        ? 'bg-red-100 text-red-800'
                                        : msg.status === 'sending'
                                          ? 'bg-blue-100 text-blue-800'
                                          : 'bg-gray-100 text-gray-800'
                                  }`}>
                                    {msg.status === 'sent' && 'تم الإرسال'}
                                    {msg.status === 'failed' && 'فشل'}
                                    {msg.status === 'sending' && 'جاري الإرسال'}
                                    {msg.status === 'queued' && 'في الانتظار'}
                                    {msg.status === 'pending' && 'معلق'}
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
