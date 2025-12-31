'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useUI } from '@/contexts/UIContext';
import extensionApiClient from '@/services/api/extensionApiClient';

interface ExtensionDevice {
  id: string;
  deviceId: string;
  deviceName?: string;
  extensionVersion?: string;
  lastSeenAt?: string;
  createdAt: string;
}

interface LeaseStatus {
  hasActiveLease: boolean;
  deviceName?: string;
  whatsAppStatus?: string;
  lastHeartbeat?: string;
}

/**
 * Extension Pairing Section for WhatsApp Auth Tab
 * Allows moderators to pair browser extensions and manage connected devices
 */
export default function ExtensionPairingSection() {
  const { addToast } = useUI();
  
  // State
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [codeExpiresAt, setCodeExpiresAt] = useState<Date | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [devices, setDevices] = useState<ExtensionDevice[]>([]);
  const [leaseStatus, setLeaseStatus] = useState<LeaseStatus | null>(null);
  const [isLoadingDevices, setIsLoadingDevices] = useState(true);
  const [isLoadingLease, setIsLoadingLease] = useState(true);
  const [countdown, setCountdown] = useState<number>(0);

  // Load devices and lease status
  const loadData = useCallback(async () => {
    setIsLoadingDevices(true);
    setIsLoadingLease(true);
    
    try {
      const [devicesResult, leaseResult] = await Promise.all([
        extensionApiClient.getDevices(),
        extensionApiClient.getLeaseStatus(),
      ]);
      
      if (devicesResult.success && devicesResult.devices) {
        setDevices(devicesResult.devices);
      }
      
      if (leaseResult.success) {
        setLeaseStatus({
          hasActiveLease: leaseResult.hasActiveLease ?? false,
          deviceName: leaseResult.deviceName,
          whatsAppStatus: leaseResult.whatsAppStatus,
          lastHeartbeat: leaseResult.lastHeartbeat,
        });
      }
    } catch (error) {
      console.error('Error loading extension data:', error);
    } finally {
      setIsLoadingDevices(false);
      setIsLoadingLease(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    
    // Refresh lease status every 30 seconds
    const interval = setInterval(() => {
      extensionApiClient.getLeaseStatus().then((result) => {
        if (result.success) {
          setLeaseStatus({
            hasActiveLease: result.hasActiveLease ?? false,
            deviceName: result.deviceName,
            whatsAppStatus: result.whatsAppStatus,
            lastHeartbeat: result.lastHeartbeat,
          });
        }
      });
    }, 30000);
    
    return () => clearInterval(interval);
  }, [loadData]);

  // Countdown timer for pairing code
  useEffect(() => {
    if (!codeExpiresAt) {
      setCountdown(0);
      return;
    }
    
    const updateCountdown = () => {
      const remaining = Math.max(0, Math.floor((codeExpiresAt.getTime() - Date.now()) / 1000));
      setCountdown(remaining);
      
      if (remaining === 0) {
        setPairingCode(null);
        setCodeExpiresAt(null);
      }
    };
    
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    
    return () => clearInterval(interval);
  }, [codeExpiresAt]);

  // Generate pairing code
  const handleGenerateCode = async () => {
    setIsGenerating(true);
    try {
      const result = await extensionApiClient.startPairing();
      
      if (result.success && result.code) {
        setPairingCode(result.code);
        // Use expiresInSeconds for more reliable countdown (avoids timezone issues)
        // Subtract 5 seconds buffer to ensure code is still valid on server
        if (result.expiresInSeconds) {
          const bufferSeconds = 5;
          setCodeExpiresAt(new Date(Date.now() + (result.expiresInSeconds - bufferSeconds) * 1000));
        } else if (result.expiresAt) {
          setCodeExpiresAt(new Date(result.expiresAt));
        }
        addToast('تم إنشاء رمز الإقران', 'success');
      } else {
        addToast(result.error || 'فشل إنشاء رمز الإقران', 'error');
      }
    } catch (error: any) {
      addToast(error.message || 'حدث خطأ', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  // Revoke device
  const handleRevokeDevice = async (deviceId: string, deviceName?: string) => {
    if (!confirm(`هل تريد إلغاء إقران الجهاز "${deviceName || deviceId}"؟`)) {
      return;
    }
    
    try {
      const result = await extensionApiClient.revokeDevice(deviceId);
      
      if (result.success) {
        addToast('تم إلغاء إقران الجهاز', 'success');
        loadData();
      } else {
        addToast(result.error || 'فشل إلغاء الإقران', 'error');
      }
    } catch (error: any) {
      addToast(error.message || 'حدث خطأ', 'error');
    }
  };

  // Force release lease
  const handleForceRelease = async () => {
    if (!confirm('هل تريد فصل الإضافة المتصلة حالياً؟')) {
      return;
    }
    
    try {
      const result = await extensionApiClient.forceReleaseLease();
      
      if (result.success) {
        addToast('تم فصل الإضافة', 'success');
        loadData();
      } else {
        addToast(result.error || 'فشل فصل الإضافة', 'error');
      }
    } catch (error: any) {
      addToast(error.message || 'حدث خطأ', 'error');
    }
  };

  // Get WhatsApp status display
  const getWhatsAppStatusDisplay = (status?: string) => {
    switch (status) {
      case 'connected':
        return { color: 'text-green-600', bg: 'bg-green-100', label: 'متصل بواتساب' };
      case 'qr_pending':
        return { color: 'text-yellow-600', bg: 'bg-yellow-100', label: 'في انتظار QR' };
      case 'loading':
        return { color: 'text-blue-600', bg: 'bg-blue-100', label: 'جاري التحميل' };
      case 'phone_disconnected':
        return { color: 'text-orange-600', bg: 'bg-orange-100', label: 'الهاتف غير متصل' };
      default:
        return { color: 'text-gray-600', bg: 'bg-gray-100', label: 'غير معروف' };
    }
  };

  return (
    <div className="space-y-6 mt-6">
      {/* Extension Section Header */}
      <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-blue-900 flex items-center gap-2">
          <i className="fas fa-puzzle-piece"></i>
          إضافة المتصفح (Extension)
        </h3>
        <p className="text-sm text-blue-700 mt-2">
          قم بتثبيت إضافة المتصفح على جهازك للتحكم في واتساب ويب مباشرة من متصفحك
        </p>
      </div>

      {/* Current Extension Session Status */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold text-gray-900 flex items-center gap-2">
            <i className="fas fa-broadcast-tower"></i>
            حالة الجلسة
          </h4>
          {isLoadingLease ? (
            <span className="text-sm text-gray-500">
              <i className="fas fa-spinner fa-spin ml-1"></i>
              جاري التحميل...
            </span>
          ) : leaseStatus?.hasActiveLease ? (
            <span className="inline-flex px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
              <i className="fas fa-check-circle ml-2"></i>
              متصل
            </span>
          ) : (
            <span className="inline-flex px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600">
              <i className="fas fa-times-circle ml-2"></i>
              غير متصل
            </span>
          )}
        </div>

        {leaseStatus?.hasActiveLease && (
          <div className="space-y-3 mb-4">
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">الجهاز:</span>
              <span className="text-sm font-medium text-gray-900">
                {leaseStatus.deviceName || 'غير معروف'}
              </span>
            </div>
            
            {leaseStatus.whatsAppStatus && (
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">حالة واتساب:</span>
                <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${getWhatsAppStatusDisplay(leaseStatus.whatsAppStatus).bg} ${getWhatsAppStatusDisplay(leaseStatus.whatsAppStatus).color}`}>
                  {getWhatsAppStatusDisplay(leaseStatus.whatsAppStatus).label}
                </span>
              </div>
            )}
            
            {leaseStatus.lastHeartbeat && (
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">آخر نشاط:</span>
                <span className="text-sm text-gray-900">
                  {new Date(leaseStatus.lastHeartbeat).toLocaleTimeString('ar-SA')}
                </span>
              </div>
            )}
            
            <button
              onClick={handleForceRelease}
              className="w-full px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
            >
              <i className="fas fa-unlink ml-2"></i>
              فصل الإضافة
            </button>
          </div>
        )}
      </div>

      {/* Pairing Code Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <i className="fas fa-qrcode"></i>
          إقران إضافة جديدة
        </h4>
        
        {pairingCode ? (
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-3">
              أدخل هذا الرمز في إضافة المتصفح:
            </p>
            <div className="relative inline-block">
              <div className="bg-gray-900 text-white text-3xl font-mono tracking-widest px-6 py-4 rounded-lg mb-3">
                {pairingCode.slice(0, 4)}-{pairingCode.slice(4)}
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(pairingCode);
                  addToast('تم نسخ الرمز', 'success');
                }}
                className="absolute -left-2 top-1/2 -translate-y-1/2 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-lg"
                title="نسخ الرمز"
              >
                <i className="fas fa-copy"></i>
              </button>
            </div>
            <p className="text-sm text-gray-500">
              <i className="fas fa-clock ml-1"></i>
              ينتهي خلال {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')} دقيقة
            </p>
            <button
              onClick={handleGenerateCode}
              disabled={isGenerating}
              className="mt-4 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
            >
              <i className="fas fa-redo ml-2"></i>
              إنشاء رمز جديد
            </button>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-4">
              قم بإنشاء رمز إقران لربط إضافة المتصفح بحسابك
            </p>
            <button
              onClick={handleGenerateCode}
              disabled={isGenerating}
              className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <i className="fas fa-spinner fa-spin ml-2"></i>
                  جاري الإنشاء...
                </>
              ) : (
                <>
                  <i className="fas fa-plus ml-2"></i>
                  إنشاء رمز إقران
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Paired Devices Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <i className="fas fa-laptop"></i>
          الأجهزة المقترنة
          {devices.length > 0 && (
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
              {devices.length}
            </span>
          )}
        </h4>
        
        {isLoadingDevices ? (
          <div className="text-center py-4 text-gray-500">
            <i className="fas fa-spinner fa-spin ml-2"></i>
            جاري التحميل...
          </div>
        ) : devices.length === 0 ? (
          <div className="text-center py-6 text-gray-500">
            <i className="fas fa-laptop text-3xl mb-2 opacity-30"></i>
            <p>لا توجد أجهزة مقترنة</p>
            <p className="text-sm">قم بإنشاء رمز إقران لربط إضافة المتصفح</p>
          </div>
        ) : (
          <div className="space-y-3">
            {devices.map((device) => (
              <div
                key={device.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <i className="fas fa-laptop text-blue-600"></i>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {device.deviceName || 'جهاز غير معروف'}
                    </p>
                    <p className="text-xs text-gray-500">
                      الإصدار: {device.extensionVersion || 'غير معروف'}
                      {device.lastSeenAt && (
                        <> • آخر ظهور: {new Date(device.lastSeenAt).toLocaleDateString('ar-SA')}</>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleRevokeDevice(device.id, device.deviceName)}
                  className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="إلغاء الإقران"
                >
                  <i className="fas fa-trash"></i>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Help Section */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h5 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
          <i className="fas fa-info-circle text-blue-500"></i>
          كيفية استخدام الإضافة
        </h5>
        <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
          <li>قم بتثبيت إضافة &quot;Clinics WhatsApp Runner&quot; من متجر Chrome</li>
          <li>انقر على أيقونة الإضافة وأدخل عنوان الخادم</li>
          <li>أنشئ رمز إقران من هذه الصفحة</li>
          <li>أدخل الرمز في الإضافة لربطها بحسابك</li>
          <li>افتح واتساب ويب في تبويبة جديدة</li>
          <li>ستقوم الإضافة بالتحكم في واتساب تلقائياً</li>
        </ol>
      </div>
    </div>
  );
}
