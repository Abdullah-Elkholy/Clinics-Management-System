'use client';

import React, { useState } from 'react';
import { useWhatsAppSession } from '@/contexts/WhatsAppSessionContext';
import { useUI } from '@/contexts/UIContext';
import { formatLocalDateTime } from '@/utils/dateTimeUtils';

export default function WhatsAppAuthTabContent() {
  const { sessionStatus, sessionData, startAuthentication, checkAuthentication } = useWhatsAppSession();
  const { addToast } = useUI();
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const handleStartAuthentication = async () => {
    setIsAuthenticating(true);
    try {
      const result = await startAuthentication();
      
      // Check using isSuccess property as primary indicator
      if (result.isSuccess === true || result.state === 'Success') {
        addToast('تم الاتصال بواتساب بنجاح', 'success');
      } else if (result.state === 'PendingQR') {
        addToast('يرجى مسح رمز QR من تطبيق واتساب', 'info');
        // TODO: Open QR code modal
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
    try {
      const result = await checkAuthentication();
      
      // Check using isSuccess property as primary indicator
      if (result.isSuccess === true || result.state === 'Success') {
        addToast('واتساب متصل بنجاح', 'success');
      } else if (result.state === 'PendingQR') {
        addToast('في انتظار مسح رمز QR', 'info');
      } else if (result.state === 'Failure' || result.isSuccess === false) {
        addToast(result.resultMessage || 'غير متصل بواتساب', 'error');
      }
      // Don't show toast for other states (Waiting, PendingNET, etc.) unless there's a message
    } catch (error: any) {
      addToast(error.message || 'فشل التحقق من حالة الاتصال', 'error');
    }
  };

  // Determine status display
  const getStatusDisplay = () => {
    switch (sessionStatus) {
      case 'connected':
        return {
          bgColor: 'bg-green-100',
          textColor: 'text-green-800',
          icon: 'fa-check-circle',
          label: 'متصل',
        };
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
              disabled={isAuthenticating || sessionStatus === 'connected'}
              className={`flex-1 inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3 text-white font-medium transition-colors ${
                isAuthenticating || sessionStatus === 'connected'
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              <i className={`fab fa-whatsapp ${isAuthenticating ? 'animate-spin' : ''}`}></i>
              <span>{isAuthenticating ? 'جاري البدء...' : 'بدء المصادقة'}</span>
            </button>
            <button
              onClick={handleCheckAuthentication}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-white hover:bg-blue-700 transition-colors font-medium"
            >
              <i className="fas fa-sync-alt"></i>
              <span>تحديث الحالة</span>
            </button>
          </div>
        </div>
      </div>

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
    </div>
  );
}
