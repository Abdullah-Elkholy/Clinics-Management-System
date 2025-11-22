'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUI } from '@/contexts/UIContext';
import { useConfirmDialog } from '@/contexts/ConfirmationContext';
import { whatsappApiClient, type BrowserStatus } from '@/services/api/whatsappApiClient';
import { PanelWrapper } from '@/components/Common/PanelWrapper';
import { PanelHeader } from '@/components/Common/PanelHeader';
import { EmptyState } from '@/components/Common/EmptyState';
import { createDeleteConfirmation } from '@/utils/confirmationHelpers';

/**
 * BrowserStatusPanel - Normal View (for Moderators and Users)
 * Shows the current user's moderator browser session status
 */
export default function BrowserStatusPanel() {
  const { user } = useAuth();
  const { addToast } = useUI();
  const { confirm } = useConfirmDialog();
  const [browserStatus, setBrowserStatus] = useState<BrowserStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const moderatorId = user?.assignedModerator 
    ? parseInt(user.assignedModerator) 
    : (user?.role === 'moderator' ? user.id : null);

  const loadBrowserStatus = useCallback(async () => {
    if (!moderatorId) {
      setError('لا يوجد مشرف مخصص');
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      const status = await whatsappApiClient.getBrowserStatus(moderatorId);
      setBrowserStatus(status);
    } catch (err: any) {
      setError(err?.message || 'فشل تحميل حالة المتصفح');
      addToast(err?.message || 'فشل تحميل حالة المتصفح', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [moderatorId, addToast]);

  useEffect(() => {
    loadBrowserStatus();
  }, [loadBrowserStatus]);

  const handleRefresh = useCallback(async () => {
    if (!moderatorId) return;

    setIsRefreshing(true);
    try {
      await whatsappApiClient.refreshBrowserStatus(moderatorId);
      addToast('تم تحديث حالة المتصفح بنجاح', 'success');
      await loadBrowserStatus();
    } catch (err: any) {
      addToast(err?.message || 'فشل تحديث حالة المتصفح', 'error');
    } finally {
      setIsRefreshing(false);
    }
  }, [moderatorId, addToast, loadBrowserStatus]);

  const handleClose = useCallback(async () => {
    if (!moderatorId) return;

    const confirmed = await confirm(createDeleteConfirmation('المتصفح'));
    if (!confirmed) return;

    try {
      await whatsappApiClient.closeBrowserSession(moderatorId);
      addToast('تم إغلاق المتصفح بنجاح', 'success');
      await loadBrowserStatus();
    } catch (err: any) {
      addToast(err?.message || 'فشل إغلاق المتصفح', 'error');
    }
  }, [moderatorId, addToast, loadBrowserStatus]);

  if (isLoading) {
    return (
      <PanelWrapper>
        <PanelHeader title="حالة المتصفح" />
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
        <PanelHeader title="حالة المتصفح" />
        <EmptyState
          icon="exclamation-triangle"
          title="خطأ في تحميل البيانات"
          message={error}
          action={{
            label: 'إعادة المحاولة',
            onClick: loadBrowserStatus,
          }}
        />
      </PanelWrapper>
    );
  }

  if (!browserStatus) {
    return (
      <PanelWrapper>
        <PanelHeader title="حالة المتصفح" />
        <EmptyState
          icon="browser"
          title="لا توجد جلسة متصفح نشطة"
          message="لا يوجد متصفح نشط للمشرف المخصص"
        />
      </PanelWrapper>
    );
  }

  return (
    <PanelWrapper>
      <PanelHeader 
        title="حالة المتصفح"
        actions={
          <>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
            {browserStatus.isActive && (
              <button
                onClick={handleClose}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
              >
                <i className="fas fa-times"></i>
                <span>إغلاق المتصفح</span>
              </button>
            )}
          </>
        }
      />

      <div className="p-6 space-y-6">
        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Active Status */}
          <div className={`p-6 rounded-xl border-2 ${browserStatus.isActive ? 'bg-green-50 border-green-300' : 'bg-gray-50 border-gray-300'}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">حالة النشاط</h3>
              <div className={`w-4 h-4 rounded-full ${browserStatus.isActive ? 'bg-green-500' : 'bg-gray-400'}`}></div>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {browserStatus.isActive ? 'نشط' : 'غير نشط'}
            </p>
          </div>

          {/* Health Status */}
          <div className={`p-6 rounded-xl border-2 ${browserStatus.isHealthy ? 'bg-blue-50 border-blue-300' : 'bg-yellow-50 border-yellow-300'}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">حالة الصحة</h3>
              <div className={`w-4 h-4 rounded-full ${browserStatus.isHealthy ? 'bg-blue-500' : 'bg-yellow-500'}`}></div>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {browserStatus.isHealthy ? 'صحي' : 'غير صحي'}
            </p>
          </div>

          {/* Authentication Status */}
          <div className={`p-6 rounded-xl border-2 ${browserStatus.isAuthenticated ? 'bg-emerald-50 border-emerald-300' : 'bg-orange-50 border-orange-300'}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">حالة المصادقة</h3>
              <div className={`w-4 h-4 rounded-full ${browserStatus.isAuthenticated ? 'bg-emerald-500' : 'bg-orange-500'}`}></div>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {browserStatus.isAuthenticated ? 'مصادق' : 'غير مصادق'}
            </p>
          </div>

          {/* Session Age */}
          <div className="p-6 rounded-xl border-2 bg-gray-50 border-gray-300">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">عمر الجلسة</h3>
              <i className="fas fa-clock text-gray-400"></i>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {browserStatus.sessionAge || 'غير متاح'}
            </p>
          </div>
        </div>

        {/* Details Section */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">تفاصيل الجلسة</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-gray-600">الرابط الحالي:</span>
              <span className="text-gray-900 font-mono text-sm">
                {browserStatus.currentUrl || 'غير متاح'}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-gray-600">آخر إجراء:</span>
              <span className="text-gray-900">
                {browserStatus.lastAction || 'غير متاح'}
              </span>
            </div>
            {browserStatus.lastUpdated && (
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-600">آخر تحديث:</span>
                <span className="text-gray-900">
                  {new Date(browserStatus.lastUpdated).toLocaleString('ar-SA')}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </PanelWrapper>
  );
}

