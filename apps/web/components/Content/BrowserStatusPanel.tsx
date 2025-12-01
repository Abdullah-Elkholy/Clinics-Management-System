'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUI } from '@/contexts/UIContext';
import { useConfirmDialog } from '@/contexts/ConfirmationContext';
import { useWhatsAppSession } from '@/contexts/WhatsAppSessionContext';
import { whatsappApiClient, type BrowserStatus } from '@/services/api/whatsappApiClient';
import { PanelWrapper } from '@/components/Common/PanelWrapper';
import { PanelHeader } from '@/components/Common/PanelHeader';
import { EmptyState } from '@/components/Common/EmptyState';
import { createDeleteConfirmation } from '@/utils/confirmationHelpers';
import { formatLocalDateTime } from '@/utils/dateTimeUtils';
import logger from '@/utils/logger';

/**
 * BrowserStatusPanel - Normal View (for Moderators and Users)
 * Shows the current user's moderator browser session status
 */
export default function BrowserStatusPanel() {
  const { user } = useAuth();
  const { addToast } = useUI();
  const { confirm } = useConfirmDialog();
  const { sessionStatus, sessionData, sessionHealth, globalPauseState, refreshSessionStatus, refreshSessionHealth, refreshGlobalPauseState, checkAuthentication } = useWhatsAppSession();
  const [browserStatus, setBrowserStatus] = useState<BrowserStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get moderator ID - ensure it's always a number or null
  // For moderators: use their own ID
  // For users: use their assignedModerator
  // For admins: undefined (they should use BrowserStatusOverview instead)
  let moderatorId: number | null = null;
  
  if (user?.role === 'moderator') {
    const parsedId = parseInt(user.id, 10);
    moderatorId = !isNaN(parsedId) ? parsedId : null;
  } else if (user?.role === 'user' && user.assignedModerator) {
    const parsedId = parseInt(user.assignedModerator, 10);
    moderatorId = !isNaN(parsedId) ? parsedId : null;
  }
  
  // Ensure moderatorId is a valid number
  const validModeratorId = moderatorId && !isNaN(moderatorId) ? moderatorId : null;

  const loadBrowserStatus = useCallback(async () => {
    logger.debug('[BrowserStatusPanel] Loading browser status...', {
      user: user,
      moderatorId: moderatorId,
      validModeratorId: validModeratorId,
      userRole: user?.role,
      userId: user?.id,
      assignedModerator: user?.assignedModerator
    });

    if (!validModeratorId) {
      logger.error('[BrowserStatusPanel] No valid moderator ID found');
      setError('لا يوجد مشرف مخصص');
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      logger.debug('[BrowserStatusPanel] Calling API with moderatorId:', validModeratorId);
      const status = await whatsappApiClient.getBrowserStatus(validModeratorId);
      logger.debug('[BrowserStatusPanel] Received status:', status);
      setBrowserStatus(status);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'فشل تحميل حالة المتصفح';
      logger.error('[BrowserStatusPanel] Error loading status:', err);
      setError(errorMsg);
      addToast(errorMsg, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [validModeratorId, addToast, user, moderatorId]);

  useEffect(() => {
    loadBrowserStatus();
  }, [loadBrowserStatus]);

  const handleRefresh = useCallback(async () => {
    if (!validModeratorId) return;

    setIsRefreshing(true);
    try {
      // Use checkAuthentication endpoint which handles pause/resume automatically
      logger.debug('[BrowserStatusPanel] Calling checkAuthentication for moderator:', validModeratorId);
      const result = await whatsappApiClient.checkAuthentication(validModeratorId, user?.id ? parseInt(user.id) : undefined);
      
      logger.debug('[BrowserStatusPanel] checkAuthentication result:', result);
      
      // Handle different states from OperationResult
      if (result.isSuccess && result.state === 'Success') {
        addToast('تم تحديث حالة المتصفح بنجاح - واتساب مصادق عليه', 'success');
        // Ensure states are refreshed one more time after success to clear any PendingQR state
        await Promise.all([
          refreshSessionStatus(),
          refreshGlobalPauseState()
        ]);
      } else if (result.state === 'PendingQR') {
        addToast('تحديث الحالة: يتطلب مسح رمز QR للمصادقة', 'warning');
      } else if (result.state === 'PendingNET') {
        addToast('تحديث الحالة: فشل الاتصال بالشبكة', 'warning');
      } else {
        const errorMsg = result.resultMessage || 'فشل تحديث حالة المتصفح';
        addToast(errorMsg, 'error');
      }
      
      // Refresh all session data
      await Promise.all([
        loadBrowserStatus(),
        refreshSessionStatus(),
        refreshSessionHealth(),
        refreshGlobalPauseState()
      ]);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'فشل تحديث حالة المتصفح';
      logger.error('[BrowserStatusPanel] Error refreshing browser status:', err);
      addToast(errorMsg, 'error');
    } finally {
      setIsRefreshing(false);
    }
  }, [validModeratorId, loadBrowserStatus, addToast, refreshSessionStatus, refreshSessionHealth, refreshGlobalPauseState, user]);

  const handleClose = useCallback(async () => {
    if (!validModeratorId) return;

    const confirmed = await confirm(createDeleteConfirmation('المتصفح'));
    if (!confirmed) return;

    try {
      await whatsappApiClient.closeBrowserSession(validModeratorId);
      addToast('تم إغلاق المتصفح بنجاح', 'success');
      await loadBrowserStatus();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'فشل إغلاق المتصفح';
      addToast(errorMsg, 'error');
    }
  }, [validModeratorId, addToast, loadBrowserStatus, confirm]);

  if (isLoading) {
    return (
      <PanelWrapper>
        <PanelHeader 
          title="حالة المتصفح" 
          icon="fa-browser"
          description="مراقبة حالة جلسة المتصفح للمشرف"
        />
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600">جاري تحميل حالة المتصفح...</p>
          </div>
        </div>
      </PanelWrapper>
    );
  }

  if (error && !browserStatus) {
    return (
      <PanelWrapper>
        <PanelHeader 
          title="حالة المتصفح" 
          icon="fa-browser"
          description="مراقبة حالة جلسة المتصفح للمشرف"
        />
        <EmptyState
          icon="exclamation-triangle"
          title="خطأ في تحميل البيانات"
          message={error}
          actionLabel="إعادة المحاولة"
          onAction={loadBrowserStatus}
        />
      </PanelWrapper>
    );
  }

  // Always show the panel, even if browserStatus is null (it means no active session)
  // The backend returns data with isActive: false when there's no session
  const displayStatus = browserStatus || {
    isActive: false,
    isHealthy: false,
    currentUrl: null,
    lastAction: null,
    sessionAge: null,
    isAuthenticated: false,
    lastUpdated: null
  };

  return (
    <PanelWrapper>
      <PanelHeader
        title="حالة المتصفح"
        icon="fa-browser"
        description="مراقبة حالة جلسة المتصفح للمشرف"
        stats={[
          {
            label: 'حالة النشاط',
            value: displayStatus.isActive ? 'نشط' : 'غير نشط',
            icon: displayStatus.isActive ? 'fa-check-circle' : 'fa-times-circle',
            color: displayStatus.isActive ? 'green' : 'red',
          },
          {
            label: 'حالة الصحة',
            value: displayStatus.isHealthy ? 'صحي' : 'غير صحي',
            icon: displayStatus.isHealthy ? 'fa-heart' : 'fa-exclamation-triangle',
            color: displayStatus.isHealthy ? 'blue' : 'yellow',
          },
          {
            label: 'المصادقة',
            value: displayStatus.isAuthenticated ? 'مصادق' : 'غير مصادق',
            icon: displayStatus.isAuthenticated ? 'fa-shield-alt' : 'fa-shield',
            color: displayStatus.isAuthenticated ? 'green' : 'yellow',
          },
          {
            label: 'عمر الجلسة',
            value: displayStatus.sessionAge || 'غير متاح',
            icon: 'fa-clock',
            color: 'blue',
          },
        ]}
      />

      {/* Global Pause Warning - PendingQR/PendingNET/BrowserClosure */}
      {globalPauseState?.isPaused && (
        <div className={`mx-6 mt-6 rounded-lg p-4 flex items-start gap-3 ${
          globalPauseState.pauseReason?.includes('PendingQR')
            ? 'bg-yellow-50 border border-yellow-200'
            : globalPauseState.pauseReason?.includes('PendingNET')
            ? 'bg-orange-50 border border-orange-200'
            : globalPauseState.pauseReason?.includes('BrowserClosure')
            ? 'bg-red-50 border border-red-200'
            : 'bg-gray-50 border border-gray-200'
        }`}>
          <i className={`fas ${
            globalPauseState.pauseReason?.includes('PendingQR')
              ? 'fa-exclamation-triangle text-yellow-600'
              : globalPauseState.pauseReason?.includes('PendingNET')
              ? 'fa-wifi text-orange-600'
              : globalPauseState.pauseReason?.includes('BrowserClosure')
              ? 'fa-times-circle text-red-600'
              : 'fa-pause-circle text-gray-600'
          } text-lg mt-0.5`}></i>
          <div className="flex-1">
            <h5 className={`font-semibold mb-1 ${
              globalPauseState.pauseReason?.includes('PendingQR')
                ? 'text-yellow-800'
                : globalPauseState.pauseReason?.includes('PendingNET')
                ? 'text-orange-800'
                : globalPauseState.pauseReason?.includes('BrowserClosure')
                ? 'text-red-800'
                : 'text-gray-800'
            }`}>
              {globalPauseState.pauseReason?.includes('PendingQR')
                ? '⚠️ تم إيقاف جميع المهام - يتطلب المصادقة (PendingQR)'
                : globalPauseState.pauseReason?.includes('PendingNET')
                ? '⚠️ تم إيقاف جميع المهام - فشل الاتصال بالإنترنت (PendingNET)'
                : globalPauseState.pauseReason?.includes('BrowserClosure')
                ? '⚠️ تم إيقاف جميع المهام - تم إغلاق المتصفح'
                : '⚠️ تم إيقاف جميع المهام'}
            </h5>
            <p className={`text-sm ${
              globalPauseState.pauseReason?.includes('PendingQR')
                ? 'text-yellow-700'
                : globalPauseState.pauseReason?.includes('PendingNET')
                ? 'text-orange-700'
                : globalPauseState.pauseReason?.includes('BrowserClosure')
                ? 'text-red-700'
                : 'text-gray-700'
            }`}>
              {globalPauseState.pauseReason || 'تم إيقاف جميع المهام مؤقتًا'}
              {globalPauseState.pausedAt && (
                <span className="block mt-1 text-xs opacity-75">
                  تم الإيقاف في: {new Date(globalPauseState.pausedAt).toLocaleString('ar-SA')}
                </span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Info Box - Authentication Check Notice */}
      {!isRefreshing && !globalPauseState?.isPaused && (
        <div className="mx-6 mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
          <i className="fas fa-info-circle text-blue-600 text-lg mt-0.5"></i>
          <div className="flex-1">
            <h5 className="font-semibold text-blue-800 mb-1">ملاحظة هامة</h5>
            <p className="text-sm text-blue-700">
              عند الضغط على زر التحديث، سيتم إيقاف جميع عمليات إرسال الرسائل مؤقتًا للتحقق من حالة المصادقة. 
              بعد الانتهاء، ستستأنف العمليات تلقائيًا.
            </p>
          </div>
        </div>
      )}

      {/* Loading Notice - During Authentication Check */}
      {isRefreshing && (
        <div className="mx-6 mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
          <i className="fas fa-spinner fa-spin text-yellow-600 text-lg mt-0.5"></i>
          <div className="flex-1">
            <h5 className="font-semibold text-yellow-800 mb-1">جاري التحقق من حالة المصادقة...</h5>
            <p className="text-sm text-yellow-700">
              تم إيقاف جميع عمليات إرسال الرسائل مؤقتًا. يرجى الانتظار...
            </p>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 px-6 pt-6">
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="px-6 py-3 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isRefreshing ? (
            <>
              <i className="fas fa-spinner fa-spin"></i>
              <span>جاري التحديث...</span>
            </>
          ) : (
            <>
              <i className="fas fa-sync-alt"></i>
              <span>تحديث</span>
            </>
          )}
        </button>
        {displayStatus.isActive && (
          <button
            onClick={handleClose}
            className="px-6 py-3 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
          >
            <i className="fas fa-times"></i>
            <span>إغلاق المتصفح</span>
          </button>
        )}
      </div>

      <div className="p-6 space-y-6">
        {/* Details Section */}
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-base font-semibold text-gray-800 mb-4">تفاصيل الجلسة</h3>
          <div className="space-y-2">
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">الرابط الحالي:</span>
              <span className="text-sm text-gray-900 font-mono">
                {displayStatus.currentUrl || 'غير متاح'}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">آخر إجراء:</span>
              <span className="text-sm text-gray-900">
                {displayStatus.lastAction || 'غير متاح'}
              </span>
            </div>
            {displayStatus.lastUpdated && (
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-gray-600">آخر تحديث:</span>
                <span className="text-sm text-gray-900">
                  {new Date(displayStatus.lastUpdated).toLocaleString('ar-SA')}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Database Session Information */}
        {sessionData && (
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <i className="fas fa-database text-blue-600"></i>
              معلومات جلسة قاعدة البيانات
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600">اسم الجلسة:</span>
                <span className="text-sm text-gray-900 font-medium">
                  {sessionData.sessionName || 'غير محدد'}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600">حالة الجلسة:</span>
                <span className={`text-sm font-medium ${
                  sessionStatus === 'connected' ? 'text-green-600' :
                  sessionStatus === 'pending' ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {sessionStatus === 'connected' ? 'متصل' :
                   sessionStatus === 'pending' ? 'في الانتظار' :
                   'غير متصل'}
                </span>
              </div>
              {sessionData.lastSyncAt && (
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">آخر مزامنة:</span>
                  <span className="text-sm text-gray-900">
                    {formatLocalDateTime(sessionData.lastSyncAt)}
                  </span>
                </div>
              )}
              {sessionData.providerSessionId && (
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">معرف الجلسة:</span>
                  <span className="text-sm text-gray-900 font-mono">
                    {sessionData.providerSessionId}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-gray-600">تاريخ الإنشاء:</span>
                <span className="text-sm text-gray-900">
                  {formatLocalDateTime(sessionData.createdAt)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Session Health Information */}
        {sessionHealth && (
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <i className="fas fa-heartbeat text-red-600"></i>
              صحة الجلسة
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600">حجم الجلسة الحالي:</span>
                <span className="text-sm text-gray-900 font-medium">
                  {sessionHealth.currentSizeMB.toFixed(2)} MB
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600">حالة المصادقة:</span>
                <span className={`text-sm font-medium ${sessionHealth.isAuthenticated ? 'text-green-600' : 'text-red-600'}`}>
                  {sessionHealth.isAuthenticated ? 'مصادق' : 'غير مصادق'}
                </span>
              </div>
              {sessionHealth.backupExists && (
                <>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">حجم النسخة الاحتياطية:</span>
                    <span className="text-sm text-gray-900">
                      {sessionHealth.backupSizeMB.toFixed(2)} MB
                    </span>
                  </div>
                  {sessionHealth.lastBackup && (
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="text-sm text-gray-600">آخر نسخة احتياطية:</span>
                      <span className="text-sm text-gray-900">
                        {formatLocalDateTime(sessionHealth.lastBackup)}
                      </span>
                    </div>
                  )}
                </>
              )}
              {sessionHealth.lastCleanup && (
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">آخر تنظيف:</span>
                  <span className="text-sm text-gray-900">
                    {formatLocalDateTime(sessionHealth.lastCleanup)}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-gray-600">تجاوز الحد:</span>
                <span className={`text-sm font-medium ${sessionHealth.exceedsThreshold ? 'text-red-600' : 'text-green-600'}`}>
                  {sessionHealth.exceedsThreshold ? 'نعم' : 'لا'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </PanelWrapper>
  );
}

