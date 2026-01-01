'use client';

import React, { useEffect } from 'react';
import { useWhatsAppSession, DetailedSessionStatus } from '@/contexts/WhatsAppSessionContext';
import { formatLocalDateTime } from '@/utils/dateTimeUtils';
import ExtensionPairingSection from './ExtensionPairingSection';

export default function WhatsAppAuthTabContent() {
  const { 
    sessionData, 
    globalPauseState, 
    detailedStatus,
    extensionStatus,
    refreshExtensionStatus,
    isLoading,
    error
  } = useWhatsAppSession();
  
  // Refresh extension status on mount
  useEffect(() => {
    refreshExtensionStatus();
  }, [refreshExtensionStatus]);

  // Determine if backend is disconnected (no data but could have data)
  const isBackendDisconnected = error && !isLoading;

  // Determine status display using detailed status from context
  const getStatusDisplay = () => {
    // Handle backend disconnection state
    if (isBackendDisconnected) {
      return {
        bgColor: 'bg-red-100',
        textColor: 'text-red-800',
        icon: 'fa-server',
        label: 'خطأ في الاتصال',
        sublabel: 'تعذر الاتصال بالخادم',
      };
    }

    const statusMap: Record<DetailedSessionStatus, { bgColor: string; textColor: string; icon: string; label: string; sublabel?: string }> = {
      'connected_idle': {
        bgColor: 'bg-green-100',
        textColor: 'text-green-800',
        icon: 'fa-check-circle',
        label: 'متصل',
        sublabel: 'جاهز للإرسال',
      },
      'connected_sending': {
        bgColor: 'bg-green-100',
        textColor: 'text-green-800',
        icon: 'fa-paper-plane',
        label: 'متصل',
        sublabel: 'جاري الإرسال...',
      },
      'connected_paused': {
        bgColor: 'bg-amber-100',
        textColor: 'text-amber-800',
        icon: 'fa-pause-circle',
        label: 'متصل (متوقف مؤقتاً)',
        sublabel: globalPauseState?.pauseReason || 'تم الإيقاف المؤقت',
      },
      'extension_connected': {
        bgColor: 'bg-blue-100',
        textColor: 'text-blue-800',
        icon: 'fa-plug',
        label: 'الإضافة متصلة',
        sublabel: extensionStatus?.deviceName || 'جاري التحقق من واتساب...',
      },
      'extension_disconnected': {
        bgColor: 'bg-orange-100',
        textColor: 'text-orange-700',
        icon: 'fa-exclamation-triangle',
        label: 'الإضافة غير متصلة',
        sublabel: 'افتح الإضافة لإعادة الاتصال',
      },
      'no_extension': {
        bgColor: 'bg-gray-100',
        textColor: 'text-gray-700',
        icon: 'fa-plug',
        label: 'الإضافة غير نشطة',
        sublabel: 'افتح الإضافة واضغط "بدء الجلسة"',
      },
      'pending_qr': {
        bgColor: 'bg-yellow-100',
        textColor: 'text-yellow-800',
        icon: 'fa-qrcode',
        label: 'في انتظار QR',
        sublabel: 'امسح الكود من تطبيق واتساب',
      },
      'pending_net': {
        bgColor: 'bg-orange-100',
        textColor: 'text-orange-800',
        icon: 'fa-wifi',
        label: 'فشل الاتصال',
        sublabel: 'تحقق من الإنترنت',
      },
      'browser_closed': {
        bgColor: 'bg-red-100',
        textColor: 'text-red-800',
        icon: 'fa-window-close',
        label: 'المتصفح مغلق',
        sublabel: 'أعد تشغيل الجلسة',
      },
      'disconnected': {
        bgColor: 'bg-gray-100',
        textColor: 'text-gray-700',
        icon: 'fa-plug',
        label: 'غير متصل',
        sublabel: 'افتح الإضافة واضغط "بدء الجلسة"',
      },
      'loading': {
        bgColor: 'bg-gray-100',
        textColor: 'text-gray-600',
        icon: 'fa-spinner fa-spin',
        label: 'جاري التحميل...',
        sublabel: undefined,
      },
    };

    return statusMap[detailedStatus] || statusMap['no_extension'];
  };

  // Get WhatsApp status display with proper handling of unknown statuses
  const getWhatsAppStatusText = (status?: string): string => {
    if (!status) return 'في انتظار الاتصال';
    
    const statusLower = status.toLowerCase();
    switch (statusLower) {
      case 'connected':
        return 'متصل بواتساب';
      case 'qr_pending':
      case 'pending_qr':
        return 'يتطلب مسح QR';
      case 'pending_net':
        return 'خطأ في الشبكة';
      case 'loading':
        return 'جاري التحميل...';
      case 'phone_disconnected':
        return 'الهاتف غير متصل';
      case 'disconnected':
        return 'غير متصل';
      case 'unknown':
        return 'جاري التحقق...';
      default:
        return 'جاري التحقق...';
    }
  };

  const statusDisplay = getStatusDisplay();

  return (
    <div className="space-y-6">
      {/* Extension Pairing Section - includes Session Info */}
      <ExtensionPairingSection 
        statusDisplay={statusDisplay}
        isBackendDisconnected={isBackendDisconnected}
        extensionStatus={extensionStatus}
        sessionData={sessionData}
        getWhatsAppStatusText={getWhatsAppStatusText}
      />
    </div>
  );
}
