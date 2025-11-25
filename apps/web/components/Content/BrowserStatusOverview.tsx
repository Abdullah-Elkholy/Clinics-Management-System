'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useUI } from '@/contexts/UIContext';
import { whatsappApiClient, type ModeratorBrowserStatus } from '@/services/api/whatsappApiClient';
import { PanelWrapper } from '@/components/Common/PanelWrapper';
import { PanelHeader } from '@/components/Common/PanelHeader';
import { EmptyState } from '@/components/Common/EmptyState';
import { useConfirmDialog } from '@/contexts/ConfirmationContext';
import { createDeleteConfirmation } from '@/utils/confirmationHelpers';

/**
 * BrowserStatusOverview - Admin View
 * Shows all moderators with their browser session status in tiles
 */
export default function BrowserStatusOverview() {
  const { addToast } = useUI();
  const { confirm } = useConfirmDialog();
  const [statusList, setStatusList] = useState<ModeratorBrowserStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshingModeratorId, setRefreshingModeratorId] = useState<number | null>(null);

  const loadBrowserStatuses = useCallback(async () => {
    try {
      setError(null);
      const statuses = await whatsappApiClient.getAllModeratorsBrowserStatus();
      setStatusList(statuses);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'فشل تحميل حالة المتصفحات';
      setError(errorMsg);
      addToast(errorMsg, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadBrowserStatuses();
  }, [loadBrowserStatuses]);

  const handleRefresh = useCallback(async (moderatorId: number) => {
    setRefreshingModeratorId(moderatorId);
    try {
      await whatsappApiClient.refreshBrowserStatus(moderatorId);
      addToast('تم تحديث حالة المتصفح بنجاح', 'success');
      await loadBrowserStatuses();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'فشل تحديث حالة المتصفح';
      addToast(errorMsg, 'error');
    } finally {
      setRefreshingModeratorId(null);
    }
  }, [addToast, loadBrowserStatuses]);

  const handleClose = useCallback(async (moderatorId: number, moderatorName: string) => {
    const confirmed = await confirm(createDeleteConfirmation(`متصفح ${moderatorName}`));
    if (!confirmed) return;

    try {
      await whatsappApiClient.closeBrowserSession(moderatorId);
      addToast('تم إغلاق المتصفح بنجاح', 'success');
      await loadBrowserStatuses();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'فشل إغلاق المتصفح';
      addToast(errorMsg, 'error');
    }
  }, [addToast, confirm, loadBrowserStatuses]);

  const handleRefreshAll = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // Refresh all active sessions
      const activeSessions = statusList.filter(s => s.isActive);
      await Promise.all(activeSessions.map(s => whatsappApiClient.refreshBrowserStatus(s.moderatorId)));
      addToast(`تم تحديث ${activeSessions.length} متصفح بنجاح`, 'success');
      await loadBrowserStatuses();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'فشل تحديث بعض المتصفحات';
      addToast(errorMsg, 'error');
    } finally {
      setIsRefreshing(false);
    }
  }, [statusList, addToast, loadBrowserStatuses]);

  // Filter moderators based on search term
  const filteredStatuses = statusList.filter(status =>
    status.moderatorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    status.moderatorUsername.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate stats
  const activeCount = statusList.filter(s => s.isActive).length;
  const healthyCount = statusList.filter(s => s.isActive && s.isHealthy).length;
  const authenticatedCount = statusList.filter(s => s.isAuthenticated).length;

  if (isLoading) {
    return (
      <PanelWrapper>
        <PanelHeader 
          title="حالة المتصفحات" 
          icon="fa-browser"
          description="مراقبة حالة جلسات المتصفح لجميع المشرفين"
        />
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <i className="fas fa-spinner animate-spin text-4xl text-blue-500 mb-4"></i>
            <p className="text-base text-gray-600">جاري تحميل حالة المتصفحات...</p>
          </div>
        </div>
      </PanelWrapper>
    );
  }

  if (error && statusList.length === 0) {
    return (
      <PanelWrapper>
        <PanelHeader 
          title="حالة المتصفحات" 
          icon="fa-browser"
          description="مراقبة حالة جلسات المتصفح لجميع المشرفين"
        />
        <EmptyState
          icon="exclamation-triangle"
          title="خطأ في تحميل البيانات"
          message={error}
          actionLabel="إعادة المحاولة"
          onAction={loadBrowserStatuses}
        />
      </PanelWrapper>
    );
  }

  return (
    <PanelWrapper>
      <PanelHeader
        title="حالة المتصفحات"
        icon="fa-browser"
        description="مراقبة حالة جلسات المتصفح لجميع المشرفين"
        stats={[
          {
            label: 'إجمالي المشرفين',
            value: statusList.length.toString(),
            icon: 'fa-users',
            color: 'blue',
          },
          {
            label: 'نشط',
            value: activeCount.toString(),
            icon: 'fa-check-circle',
            color: 'green',
          },
          {
            label: 'صحي',
            value: healthyCount.toString(),
            icon: 'fa-heart',
            color: 'blue',
          },
          {
            label: 'مصادق',
            value: authenticatedCount.toString(),
            icon: 'fa-shield-alt',
            color: 'green',
          },
        ]}
      />

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 mb-6 px-6 pt-6">
        <button
          onClick={handleRefreshAll}
          disabled={isRefreshing || statusList.filter(s => s.isActive).length === 0}
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
              <span>تحديث الكل</span>
            </>
          )}
        </button>
        <button
          onClick={loadBrowserStatuses}
          disabled={isRefreshing}
          className="px-6 py-3 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <i className="fas fa-redo"></i>
          <span>إعادة التحميل</span>
        </button>
      </div>

      <div className="p-6">
        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <input
              type="text"
              placeholder="ابحث عن مشرف..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              dir="rtl"
            />
            <i className="fas fa-search absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
          </div>
        </div>

        {/* Status Grid */}
        {filteredStatuses.length === 0 ? (
          <EmptyState
            icon="browser"
            title="لا توجد نتائج"
            message={searchTerm ? 'لا توجد متصفحات تطابق البحث' : 'لا توجد متصفحات نشطة'}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredStatuses.map((status) => (
              <div
                key={status.moderatorId}
                className={`p-5 rounded-lg border ${
                  status.isActive && status.isHealthy
                    ? 'bg-white border-green-200'
                    : status.isActive
                    ? 'bg-white border-yellow-200'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">{status.moderatorName}</h3>
                    <p className="text-sm text-gray-500">@{status.moderatorUsername}</p>
                  </div>
                  <div className={`w-3 h-3 rounded-full ${
                    status.isActive && status.isHealthy
                      ? 'bg-green-500'
                      : status.isActive
                      ? 'bg-yellow-500'
                      : 'bg-gray-400'
                  }`}></div>
                </div>

                {/* Status Badges */}
                <div className="flex flex-wrap gap-2 mb-4">
                  <span className={`px-2 py-1 rounded text-sm font-medium ${
                    status.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {status.isActive ? 'نشط' : 'غير نشط'}
                  </span>
                  <span className={`px-2 py-1 rounded text-sm font-medium ${
                    status.isHealthy ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {status.isHealthy ? 'صحي' : 'غير صحي'}
                  </span>
                  <span className={`px-2 py-1 rounded text-sm font-medium ${
                    status.isAuthenticated ? 'bg-emerald-100 text-emerald-800' : 'bg-orange-100 text-orange-800'
                  }`}>
                    {status.isAuthenticated ? 'مصادق' : 'غير مصادق'}
                  </span>
                </div>

                {/* Details */}
                <div className="space-y-2 mb-4 text-sm">
                  {status.currentUrl && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">الرابط:</span>
                      <span className="text-gray-900 font-mono text-xs truncate max-w-[200px]" title={status.currentUrl}>
                        {status.currentUrl.length > 30 ? `${status.currentUrl.substring(0, 30)}...` : status.currentUrl}
                      </span>
                    </div>
                  )}
                  {status.sessionAge && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">عمر الجلسة:</span>
                      <span className="text-gray-900">{status.sessionAge}</span>
                    </div>
                  )}
                  {status.error && (
                    <div className="text-red-600 text-xs">{status.error}</div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => handleRefresh(status.moderatorId)}
                    disabled={refreshingModeratorId === status.moderatorId || !status.isActive}
                    className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-1"
                  >
                    {refreshingModeratorId === status.moderatorId ? (
                      <i className="fas fa-spinner fa-spin"></i>
                    ) : (
                      <>
                        <i className="fas fa-sync-alt"></i>
                        <span>تحديث</span>
                      </>
                    )}
                  </button>
                  {status.isActive && (
                    <button
                      onClick={() => handleClose(status.moderatorId, status.moderatorName)}
                      className="flex-1 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm flex items-center justify-center gap-1"
                    >
                      <i className="fas fa-times"></i>
                      <span>إغلاق</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PanelWrapper>
  );
}

