'use client';

import React, { useState } from 'react';
import { useWhatsAppSession } from '@/contexts/WhatsAppSessionContext';
import { useUI } from '@/contexts/UIContext';
import { useModal } from '@/contexts/ModalContext';
import { formatLocalDateTime } from '@/utils/dateTimeUtils';
import ExtensionPairingSection from './ExtensionPairingSection';

export default function WhatsAppAuthTabContent() {
  const { sessionStatus, sessionData, globalPauseState, startAuthentication, checkAuthentication, refreshGlobalPauseState, refreshSessionStatus } = useWhatsAppSession();
  const { addToast } = useUI();
  const { openModal } = useModal();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  const handleStartAuthentication = async () => {
    setIsAuthenticating(true);
    try {
      const result = await startAuthentication();
      
      // Refresh both session status and global pause state after authentication attempt
      // This ensures the UI reflects the latest state from the database
      await Promise.all([
        refreshSessionStatus(),
        refreshGlobalPauseState()
      ]);
      
      // Check using isSuccess property as primary indicator
      if (result.isSuccess === true || result.state === 'Success') {
        addToast('تم الاتصال بواتساب بنجاح', 'success');
        // Ensure states are refreshed one more time after success to clear any PendingQR state
        await Promise.all([
          refreshSessionStatus(),
          refreshGlobalPauseState()
        ]);
      } else if (result.state === 'PendingQR') {
        addToast('يرجى مسح رمز QR من تطبيق واتساب', 'info');
        // Open QR code modal to show QR code
        openModal('qrCode');
      } else if (result.state === 'PendingNET') {
        addToast('فشل الاتصال بالإنترنت (PendingNET)', 'warning');
      } else if (result.state === 'Failure' || result.isSuccess === false) {
        addToast(result.resultMessage || 'فشل بدء المصادقة', 'error');
      }
      // Don't show error for other intermediate states
    } catch (error: any) {
      addToast(error.message || 'حدث خطأ أثناء بدء المصادقة', 'error');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleCheckAuthentication = async () => {
    setIsChecking(true);
    try {
      const result = await checkAuthentication();
      
      // Refresh both session status and global pause state after check
      // This ensures the UI reflects the latest state from the database
      await Promise.all([
        refreshSessionStatus(),
        refreshGlobalPauseState()
      ]);
      
      // Check using isSuccess property as primary indicator
      if (result.isSuccess === true || result.state === 'Success') {
        addToast('واتساب متصل بنجاح', 'success');
        // Ensure states are refreshed one more time after success to clear any PendingQR state
        await Promise.all([
          refreshSessionStatus(),
          refreshGlobalPauseState()
        ]);
      } else if (result.state === 'PendingQR') {
        addToast('في انتظار مسح رمز QR', 'info');
      } else if (result.state === 'PendingNET') {
        addToast('فشل الاتصال بالإنترنت (PendingNET)', 'warning');
      } else if (result.state === 'Failure' || result.isSuccess === false) {
        addToast(result.resultMessage || 'غير متصل بواتساب', 'error');
      }
      // Don't show toast for other states (Waiting, etc.) unless there's a message
    } catch (error: any) {
      addToast(error.message || 'فشل التحقق من حالة الاتصال', 'error');
    } finally {
      setIsChecking(false);
    }
  };

  // Determine status display - prioritize WhatsAppSession.Status when connected
  const getStatusDisplay = () => {
    // PRIORITY 1: If WhatsAppSession.Status is 'connected', always show connected
    // (even if paused - pause is for task control, not connection status)
    if (sessionStatus === 'connected') {
      // Show connected with pause indicator if paused
      if (globalPauseState?.isPaused) {
        return {
          bgColor: 'bg-green-100',
          textColor: 'text-green-800',
          icon: 'fa-check-circle',
          label: 'متصل (متوقف مؤقتاً)',
        };
      }
      return {
        bgColor: 'bg-green-100',
        textColor: 'text-green-800',
        icon: 'fa-check-circle',
        label: 'متصل',
      };
    }

    // PRIORITY 2: Check global pause state for specific reasons (only when NOT connected)
    if (globalPauseState?.isPaused) {
      if (globalPauseState.pauseReason?.includes('PendingQR')) {
        return {
          bgColor: 'bg-yellow-100',
          textColor: 'text-yellow-800',
          icon: 'fa-exclamation-triangle',
          label: 'في انتظار المصادقة (PendingQR)',
        };
      } else if (globalPauseState.pauseReason?.includes('PendingNET')) {
        return {
          bgColor: 'bg-orange-100',
          textColor: 'text-orange-800',
          icon: 'fa-wifi',
          label: 'فشل الاتصال بالإنترنت (PendingNET)',
        };
      } else if (globalPauseState.pauseReason?.includes('BrowserClosure')) {
        return {
          bgColor: 'bg-red-100',
          textColor: 'text-red-800',
          icon: 'fa-times-circle',
          label: 'تم إغلاق المتصفح',
        };
      }
    }
    
    // PRIORITY 3: Fallback to WhatsAppSession.Status
    switch (sessionStatus) {
      case 'pending':
        return {
          bgColor: 'bg-yellow-100',
          textColor: 'text-yellow-800',
          icon: 'fa-clock',
          label: 'في انتظار المصادقة',
        };
      case 'disconnected':
      default:
        return {
          bgColor: 'bg-red-100',
          textColor: 'text-red-800',
          icon: 'fa-times-circle',
          label: 'غير متصل',
        };
    }
  };

  const statusDisplay = getStatusDisplay();

  return (
    <div className="space-y-6">
      {/* WhatsApp Auth Header */}
      <div className="bg-emerald-50 border-2 border-emerald-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-emerald-900 flex items-center gap-2">
          <i className="fab fa-whatsapp"></i>
          مصادقة واتساب
        </h3>
        <p className="text-sm text-emerald-700 mt-2">
          قم بربط حسابك بواتساب للبدء في إرسال الرسائل وإدارة قوائم الانتظار
        </p>
      </div>

      {/* Authentication Status Card */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
              <i className="fab fa-whatsapp text-emerald-600 text-xl"></i>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">حالة الاتصال</h4>
              <p className="text-sm text-gray-600">معلومات ربط حسابك بواتساب</p>
            </div>
          </div>
          <span className={`inline-flex px-4 py-2 rounded-full text-sm font-medium ${statusDisplay.bgColor} ${statusDisplay.textColor}`}>
            <i className={`fas ${statusDisplay.icon} ml-2`}></i>
            {statusDisplay.label}
          </span>
        </div>

        <div className="space-y-4">
          {/* Last Sync */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-600 font-medium mb-1">آخر مزامنة</p>
            <p className="text-sm text-gray-900">
              {sessionData?.lastSyncAt 
                ? formatLocalDateTime(sessionData.lastSyncAt)
                : 'لم يتم المصادقة بعد'}
            </p>
          </div>

          {/* Session Info */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-600 font-medium mb-1">معلومات الجلسة</p>
            <p className="text-sm text-gray-900">
              {sessionData?.sessionName || 'لا توجد جلسة نشطة'}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={handleStartAuthentication}
              disabled={isAuthenticating || isChecking || sessionStatus === 'connected'}
              className={`flex-1 inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3 text-white font-medium transition-colors ${
                isAuthenticating || isChecking || sessionStatus === 'connected'
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              <i className={`fab fa-whatsapp ${isAuthenticating ? 'animate-spin' : ''}`}></i>
              <span>{isAuthenticating ? 'جاري البدء...' : 'بدء المصادقة'}</span>
            </button>
            <button
              onClick={handleCheckAuthentication}
              disabled={isChecking || isAuthenticating}
              className={`inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3 text-white font-medium transition-colors ${
                isChecking || isAuthenticating
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              <i className={`fas fa-sync-alt ${isChecking ? 'animate-spin' : ''}`}></i>
              <span>{isChecking ? 'جاري التحقق...' : 'تحديث الحالة'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Global Pause Warning - PendingQR/PendingNET/BrowserClosure */}
      {globalPauseState?.isPaused && (
        <div className={`rounded-lg p-4 flex items-start gap-3 ${
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
            <h4 className={`font-semibold mb-2 ${
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
            </h4>
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
            {globalPauseState.pauseReason?.includes('PendingQR') && (
              <p className="text-sm text-yellow-700 mt-2">
                <strong>الحل:</strong> قم ببدء المصادقة باستخدام زر "بدء المصادقة" أعلاه لاستئناف المهام.
              </p>
            )}
            {globalPauseState.pauseReason?.includes('PendingNET') && (
              <p className="text-sm text-orange-700 mt-2">
                <strong>الحل:</strong> تحقق من اتصالك بالإنترنت وحاول تحديث الحالة.
              </p>
            )}
            {globalPauseState.pauseReason?.includes('BrowserClosure') && (
              <p className="text-sm text-red-700 mt-2">
                <strong>الحل:</strong> تم إغلاق المتصفح. قم ببدء المصادقة مرة أخرى.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Instructions Card */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
          <i className="fas fa-info-circle"></i>
          كيفية المصادقة
        </h4>
        <ol className="text-sm text-blue-800 space-y-1 mr-4 list-decimal">
          <li>انقر على زر "بدء المصادقة" أعلاه</li>
          <li>سيظهر لك رمز QR على الشاشة</li>
          <li>افتح تطبيق واتساب على هاتفك</li>
          <li>اذهب إلى الإعدادات {'>'} الأجهزة المرتبطة</li>
          <li>امسح رمز QR الظاهر على الشاشة</li>
          <li>انتظر حتى يتم التأكيد والاتصال بنجاح</li>
        </ol>
      </div>

      {/* Extension Pairing Section */}
      <ExtensionPairingSection />
    </div>
  );
}
