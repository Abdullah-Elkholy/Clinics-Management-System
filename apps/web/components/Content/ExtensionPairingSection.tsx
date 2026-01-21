'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useUI } from '@/contexts/UIContext';
import { useWhatsAppSession, ExtensionStatus, WhatsAppSessionData } from '@/contexts/WhatsAppSessionContext';
import extensionApiClient from '@/services/api/extensionApiClient';
import { formatLocalDateTime, parseAsUtc } from '@/utils/dateTimeUtils';

/**
 * Format time ago in Arabic (e.g., "منذ 30 ثانية", "منذ 5 دقائق")
 */
function formatTimeAgo(date: string | Date | undefined): string {
  if (!date) return 'لا يوجد';

  const now = Date.now();
  const dateObj = parseAsUtc(date);
  if (!dateObj) return 'تاريخ غير صالح';

  const past = dateObj.getTime();
  const diffSeconds = Math.floor((now - past) / 1000);

  if (diffSeconds < 60) {
    return `منذ ${diffSeconds} ثانية`;
  } else if (diffSeconds < 3600) {
    const minutes = Math.floor(diffSeconds / 60);
    return `منذ ${minutes} ${minutes === 1 ? 'دقيقة' : minutes === 2 ? 'دقيقتين' : 'دقائق'}`;
  } else if (diffSeconds < 86400) {
    const hours = Math.floor(diffSeconds / 3600);
    return `منذ ${hours} ${hours === 1 ? 'ساعة' : hours === 2 ? 'ساعتين' : 'ساعات'}`;
  } else {
    const days = Math.floor(diffSeconds / 86400);
    return `منذ ${days} ${days === 1 ? 'يوم' : days === 2 ? 'يومين' : 'أيام'}`;
  }
}

interface ExtensionDevice {
  id: string;
  deviceId: string;
  deviceName?: string;
  extensionVersion?: string;
  lastSeenAt?: string;
  createdAt: string;
  isActive?: boolean;
  revokedAt?: string;
  revokedReason?: string;
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

interface StatusDisplay {
  bgColor: string;
  textColor: string;
  icon: string;
  label: string;
  sublabel?: string;
}

interface ExtensionPairingSectionProps {
  statusDisplay: StatusDisplay;
  isBackendDisconnected: boolean;
  extensionStatus: ExtensionStatus | null;
  sessionData: WhatsAppSessionData | null;
  getWhatsAppStatusText: (status?: string) => string;
}

export default function ExtensionPairingSection({
  statusDisplay,
  isBackendDisconnected,
  extensionStatus: parentExtensionStatus,
  sessionData,
  getWhatsAppStatusText,
}: ExtensionPairingSectionProps) {
  const { addToast } = useUI();
  const { refreshCombinedStatus } = useWhatsAppSession();

  // State
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [codeExpiresAt, setCodeExpiresAt] = useState<Date | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [devices, setDevices] = useState<ExtensionDevice[]>([]);
  const [leaseStatus, setLeaseStatus] = useState<LeaseStatus | null>(null);
  const [isLoadingDevices, setIsLoadingDevices] = useState(true);
  const [isLoadingLease, setIsLoadingLease] = useState(true);
  const [countdown, setCountdown] = useState<number>(0);
  const [pairingSuccess, setPairingSuccess] = useState(false);
  const [initialDeviceCount, setInitialDeviceCount] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(Date.now()); // For relative time updates

  // Update current time every 10 seconds for relative time display
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, []);

  // Memoize formatted times to prevent unnecessary re-renders
  const lastSyncDisplay = useMemo(() => {
    if (sessionData?.lastSyncAt) {
      return formatTimeAgo(sessionData.lastSyncAt);
    } else if (parentExtensionStatus?.lastHeartbeat) {
      return formatTimeAgo(parentExtensionStatus.lastHeartbeat);
    }
    return 'لم يتم المزامنة بعد';
  }, [sessionData?.lastSyncAt, parentExtensionStatus?.lastHeartbeat, currentTime]);

  const lastActivityDisplay = useMemo(() => {
    if (parentExtensionStatus?.lastHeartbeat) {
      return formatTimeAgo(parentExtensionStatus.lastHeartbeat);
    } else if (sessionData?.lastActivityAt) {
      return formatTimeAgo(sessionData.lastActivityAt);
    }
    return 'لا يوجد نشاط';
  }, [parentExtensionStatus?.lastHeartbeat, sessionData?.lastActivityAt, currentTime]);

  const leaseLastHeartbeatDisplay = useMemo(() => {
    if (leaseStatus?.lastHeartbeat) {
      return formatTimeAgo(leaseStatus.lastHeartbeat);
    }
    return null;
  }, [leaseStatus?.lastHeartbeat, currentTime]);

  // Filter active (non-revoked) devices
  const activeDevices = useMemo(() => {
    return devices.filter(d => !d.revokedAt);
  }, [devices]);

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
    } catch {
      // Error loading extension data - silently handle
    } finally {
      setIsLoadingDevices(false);
      setIsLoadingLease(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    // Refresh lease status AND devices every 10 seconds (silently - no error toasts on heartbeat failures)
    // Faster polling to detect device revocations from extension quickly
    const interval = setInterval(() => {
      // Poll lease status
      extensionApiClient.getLeaseStatus().then((result) => {
        if (result.success) {
          // Only update state if values actually changed to prevent unnecessary re-renders
          setLeaseStatus((prev) => {
            if (!prev) {
              return {
                hasActiveLease: result.hasActiveLease ?? false,
                deviceName: result.deviceName,
                whatsAppStatus: result.whatsAppStatus,
                lastHeartbeat: result.lastHeartbeat,
              };
            }

            // Deep comparison - only update if something changed
            const hasChanged =
              prev.hasActiveLease !== (result.hasActiveLease ?? false) ||
              prev.deviceName !== result.deviceName ||
              prev.whatsAppStatus !== result.whatsAppStatus ||
              // Only update lastHeartbeat if it changed by more than 5 seconds (reduce flicker)
              (result.lastHeartbeat && prev.lastHeartbeat &&
                Math.abs(new Date(result.lastHeartbeat).getTime() - new Date(prev.lastHeartbeat).getTime()) > 5000);

            return hasChanged ? {
              hasActiveLease: result.hasActiveLease ?? false,
              deviceName: result.deviceName,
              whatsAppStatus: result.whatsAppStatus,
              lastHeartbeat: result.lastHeartbeat,
            } : prev;
          });
        }
        // Silently ignore heartbeat failures - don't disrupt user with errors
      }).catch(() => {
        // Silently handle connection errors during heartbeat polling
      });

      // Poll devices to detect revocation from extension
      extensionApiClient.getDevices().then((result) => {
        if (result.success && result.devices) {
          setDevices((prev) => {
            // Deep comparison: check if any device changed (including revocation status)
            const prevActiveIds = new Set(prev.filter(d => !d.revokedAt).map(d => d.id));
            const newActiveIds = new Set(result.devices.filter(d => !d.revokedAt).map(d => d.id));

            // Check if active device IDs changed
            const activeIdsChanged =
              prevActiveIds.size !== newActiveIds.size ||
              [...prevActiveIds].some(id => !newActiveIds.has(id)) ||
              [...newActiveIds].some(id => !prevActiveIds.has(id));

            // Check if total device list changed
            const totalCountChanged = prev.length !== result.devices.length;

            // Update if active devices changed OR if a device was revoked/added
            if (activeIdsChanged || totalCountChanged) {
              return result.devices;
            }

            return prev;
          });
        }
      }).catch(() => {
        // Silently handle connection errors
      });
    }, 10000); // Poll every 10 seconds to detect revocations quickly

    return () => clearInterval(interval);
  }, [loadData]);

  // Countdown timer for pairing code - polls for device pairing and stops on success
  useEffect(() => {
    if (!codeExpiresAt || pairingSuccess) {
      setCountdown(0);
      return;
    }

    const updateCountdown = async () => {
      const remaining = Math.max(0, Math.floor((codeExpiresAt.getTime() - Date.now()) / 1000));
      setCountdown(remaining);

      // Poll for device connection every 3 seconds
      if (remaining > 0 && remaining % 3 === 0) {
        try {
          // Check for new devices (code was used even if lease not acquired yet)
          const devicesResult = await extensionApiClient.getDevices();
          if (devicesResult.success && devicesResult.devices) {
            const currentDeviceCount = devicesResult.devices.length;
            // If device count increased, the code was used
            if (initialDeviceCount !== null && currentDeviceCount > initialDeviceCount) {
              // Code was used! Clear the pairing code display
              setPairingSuccess(true);
              setPairingCode(null);
              setCodeExpiresAt(null);
              setDevices(devicesResult.devices);
              addToast('تم إقران الإضافة بنجاح!', 'success');
              loadData();
              // Refresh all status including WhatsApp connection to update Header and other components
              refreshCombinedStatus();
              return;
            }
          }

          // Also check for active lease (extension already connected)
          const leaseResult = await extensionApiClient.getLeaseStatus();
          if (leaseResult.success && leaseResult.hasActiveLease) {
            // Device connected! Stop the timer
            setPairingSuccess(true);
            setPairingCode(null);
            setCodeExpiresAt(null);
            setLeaseStatus({
              hasActiveLease: true,
              deviceName: leaseResult.deviceName,
              whatsAppStatus: leaseResult.whatsAppStatus,
              lastHeartbeat: leaseResult.lastHeartbeat,
            });
            addToast('تم إقران الإضافة بنجاح!', 'success');
            loadData();
            // Refresh all status including WhatsApp connection to update Header and other components
            refreshCombinedStatus();
            return;
          }
        } catch {
          // Error polling - silently handle
        }
      }

      if (remaining === 0) {
        setPairingCode(null);
        setCodeExpiresAt(null);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [codeExpiresAt, pairingSuccess, addToast, loadData, initialDeviceCount]);

  // Generate pairing code
  const handleGenerateCode = async () => {
    setIsGenerating(true);
    setPairingSuccess(false);
    try {
      // Store current device count before generating code
      const devicesResult = await extensionApiClient.getDevices();
      if (devicesResult.success && devicesResult.devices) {
        setInitialDeviceCount(devicesResult.devices.length);
      }

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
        // Handle specific error for existing device
        const errorMsg = result.error || 'فشل إنشاء رمز الإقران';
        addToast(errorMsg, 'error');
        // Refresh devices list in case the UI was out of sync
        loadData();
      }
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
        // Refresh all status to update Header and other components
        refreshCombinedStatus();
      } else {
        addToast(result.error || 'فشل إلغاء الإقران', 'error');
      }
    } finally {
      // Always refresh after attempt
    }
  };

  // Force release lease
  const [isReleasingLease, setIsReleasingLease] = useState(false);

  const handleForceRelease = async () => {
    if (!confirm('هل تريد فصل الإضافة المتصلة حالياً؟')) {
      return;
    }

    setIsReleasingLease(true);
    try {
      const result = await extensionApiClient.forceReleaseLease();

      if (result.success) {
        addToast('تم فصل الإضافة', 'success');
        loadData();
        // Refresh all status to update Header and other components
        refreshCombinedStatus();
      } else {
        // Check for "no active lease" which means lease already expired - treat as success
        const errorLower = (result.error || '').toLowerCase();
        if (errorLower.includes('no active lease') || errorLower.includes('لا يوجد جلسة')) {
          addToast('الإضافة غير متصلة بالفعل', 'info');
          loadData();
          refreshCombinedStatus();
        } else {
          addToast(result.error || 'فشل فصل الإضافة', 'error');
        }
      }
    } catch (error: any) {
      // Network errors or unexpected failures
      const errorMsg = error?.message || 'حدث خطأ أثناء فصل الإضافة';
      // If error indicates lease already gone, treat as success
      if (errorMsg.toLowerCase().includes('no active lease') || errorMsg.toLowerCase().includes('404')) {
        addToast('الإضافة غير متصلة بالفعل', 'info');
        loadData();
        refreshCombinedStatus();
      } else {
        addToast(errorMsg, 'error');
      }
    } finally {
      setIsReleasingLease(false);
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
      case 'unknown':
      case 'غير معروف':
        return { color: 'text-gray-600', bg: 'bg-gray-100', label: 'جاري التحقق...' };
      default:
        return { color: 'text-gray-600', bg: 'bg-gray-100', label: status || 'جاري التحقق...' };
    }
  };

  return (
    <div className="space-y-6 mt-6">
      {/* Extension Section (WhatsApp Auth Tab) Header */}
      <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-green-900 flex items-center gap-2">
          <i className="fab fa-whatsapp"></i>
          مصادقة واتساب
        </h3>
        <p className="text-sm text-green-700 mt-2">
          إدارة حالة الواتساب وإضافة المتصفح (Extension) على جهازك للتحكم في واتساب ويب مباشرة من متصفحك
        </p>
      </div>

      {/* Session Info Card - Status Overview */}
      <div className="bg-white border border-green-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold text-gray-900 flex items-center gap-2">
            <i className="fas fa-info-circle text-blue-500"></i>
            معلومات الجلسة
          </h4>
          <div className="flex flex-col items-end gap-1">
            <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${statusDisplay.bgColor} ${statusDisplay.textColor}`}>
              <i className={`fas ${statusDisplay.icon} ml-2`}></i>
              {statusDisplay.label}
            </span>
            {statusDisplay.sublabel && (
              <span className={`text-xs ${statusDisplay.textColor} opacity-80`}>
                {statusDisplay.sublabel}
              </span>
            )}
          </div>
        </div>

        {/* Backend Disconnection Warning */}
        {isBackendDisconnected && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700 flex items-center gap-2">
              <i className="fas fa-exclamation-circle"></i>
              <span>تعذر الاتصال بالخادم. البيانات المعروضة قد تكون قديمة.</span>
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {/* Extension Status */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-600 font-medium mb-1 flex items-center gap-1">
              <i className="fas fa-puzzle-piece text-gray-400"></i>
              حالة الإضافة
            </p>
            <p className={`text-sm font-medium ${isBackendDisconnected ? 'text-red-600' :
              parentExtensionStatus?.hasActiveLease && parentExtensionStatus?.isOnline ? 'text-green-600' :
                parentExtensionStatus?.hasActiveLease ? 'text-orange-600' : 'text-gray-500'
              }`}>
              {isBackendDisconnected ? 'تعذر التحقق' :
                parentExtensionStatus?.hasActiveLease && parentExtensionStatus?.isOnline ? 'متصلة ونشطة' :
                  parentExtensionStatus?.hasActiveLease ? 'مقترنة (غير نشطة)' : 'غير مقترنة'}
            </p>
          </div>

          {/* WhatsApp Status */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-600 font-medium mb-1 flex items-center gap-1">
              <i className="fab fa-whatsapp text-gray-400"></i>
              حالة واتساب
            </p>
            <p className={`text-sm font-medium ${isBackendDisconnected ? 'text-red-600' :
              parentExtensionStatus?.whatsAppStatus === 'connected' ? 'text-green-600' :
                parentExtensionStatus?.whatsAppStatus === 'qr_pending' || parentExtensionStatus?.whatsAppStatus === 'pending_qr' ? 'text-yellow-600' :
                  'text-gray-500'
              }`}>
              {isBackendDisconnected ? 'تعذر التحقق' : getWhatsAppStatusText(parentExtensionStatus?.whatsAppStatus)}
            </p>
          </div>

          {/* Last Sync */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-600 font-medium mb-1 flex items-center gap-1">
              <i className="fas fa-sync-alt text-gray-400"></i>
              آخر مزامنة
            </p>
            <p className={`text-sm ${isBackendDisconnected ? 'text-red-600' : 'text-gray-900'}`}>
              {isBackendDisconnected ? 'تعذر التحقق' : lastSyncDisplay}
            </p>
          </div>

          {/* Last Activity */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-600 font-medium mb-1 flex items-center gap-1">
              <i className="fas fa-clock text-gray-400"></i>
              آخر نشاط
            </p>
            <p className={`text-sm ${isBackendDisconnected ? 'text-red-600' : 'text-gray-900'}`}>
              {isBackendDisconnected ? 'تعذر التحقق' : lastActivityDisplay}
            </p>
          </div>
        </div>
      </div>

      {/* Current Extension Session Status */}
      <div className="bg-white border border-green-200 rounded-lg p-6">
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
            {/* Important disclaimer */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-2">
                <i className="fas fa-exclamation-triangle text-amber-600 mt-0.5"></i>
                <div className="text-sm text-amber-800">
                  <span className="font-medium">هام:</span> بعد إقران الإضافة، يجب الضغط على زر <span className="font-bold">&quot;فتح واتساب&quot;</span> في الإضافة لبدء جلسة واتساب ويب.
                </div>
              </div>
            </div>

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

            {leaseLastHeartbeatDisplay && (
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">آخر نشاط:</span>
                <span className="text-sm text-gray-900">
                  {leaseLastHeartbeatDisplay}
                </span>
              </div>
            )}

            <button
              onClick={handleForceRelease}
              disabled={isReleasingLease}
              className={`w-full px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg transition-colors ${isReleasingLease ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-100'
                }`}
            >
              {isReleasingLease ? (
                <>
                  <i className="fas fa-spinner fa-spin ml-2"></i>
                  جاري الفصل...
                </>
              ) : (
                <>
                  <i className="fas fa-unlink ml-2"></i>
                  فصل الإضافة
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Pairing Code Section */}
      <div className="bg-white border border-green-200 rounded-lg p-6">
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
            {/* Check if there's already a paired device */}
            {activeDevices.length > 0 ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <i className="fas fa-exclamation-triangle text-amber-600 mt-0.5"></i>
                  <div className="text-right">
                    <p className="text-sm font-medium text-amber-800 mb-1">
                      يوجد جهاز مقترن بالفعل
                    </p>
                    <p className="text-sm text-amber-700">
                      لإضافة جهاز جديد، يرجى إلغاء إقران الجهاز الحالي من قسم &quot;الأجهزة المقترنة&quot; أدناه أولاً.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <>
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
              </>
            )}
          </div>
        )}
      </div>

      {/* Paired Devices Section */}
      <div className="bg-white border border-green-200 rounded-lg p-6">
        <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <i className="fas fa-laptop"></i>
          الأجهزة المقترنة
          {activeDevices.length > 0 && (
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
              {activeDevices.length}
            </span>
          )}
        </h4>

        {isLoadingDevices ? (
          <div className="text-center py-4 text-gray-500">
            <i className="fas fa-spinner fa-spin ml-2"></i>
            جاري التحميل...
          </div>
        ) : activeDevices.length === 0 ? (
          <div className="text-center py-6 text-gray-500">
            <i className="fas fa-laptop text-3xl mb-2 opacity-30"></i>
            <p>لا توجد أجهزة مقترنة</p>
            <p className="text-sm">قم بإنشاء رمز إقران لربط إضافة المتصفح</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeDevices.map((device) => (
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
                      إصدار الإضافة: {device.extensionVersion || 'غير معروف'}
                      {device.lastSeenAt && (
                        <> • آخر ظهور: {parseAsUtc(device.lastSeenAt)?.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</>
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

      {/* Help Section - Extension Installation */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
        <h4 className="font-semibold text-amber-900 mb-3 flex items-center gap-2">
          <i className="fas fa-download"></i>
          تثبيت الإضافة يدوياً
        </h4>
        <ol className="text-sm text-amber-800 space-y-2 mr-4 list-decimal">
          <li>احصل على مجلد الإضافة <code className="bg-amber-100 px-1 rounded">extension</code> من مسؤول النظام</li>
          <li>افتح المتصفح واذهب إلى صفحة الإضافات:
            <ul className="mr-4 mt-1 space-y-1 list-disc text-amber-700">
              <li><strong>Chrome:</strong> <code className="bg-amber-100 px-1 rounded text-xs">chrome://extensions</code></li>
              <li><strong>Edge:</strong> <code className="bg-amber-100 px-1 rounded text-xs">edge://extensions</code></li>
              <li><strong>Opera:</strong> <code className="bg-amber-100 px-1 rounded text-xs">opera://extensions</code></li>
            </ul>
          </li>
          <li>فعّل <strong>&quot;وضع المطور&quot;</strong> (Developer mode) من أعلى الصفحة</li>
          <li>اضغط على <strong>&quot;تحميل إضافة غير مضغوطة&quot;</strong> (Load unpacked)</li>
          <li>اختر مجلد <code className="bg-amber-100 px-1 rounded">extension</code> ثم اضغط &quot;اختيار المجلد&quot;</li>
          <li>ستظهر الإضافة في شريط الأدوات - اضغط على أيقونتها للبدء</li>
        </ol>
      </div>

      {/* Help Section - Usage Steps */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
          <i className="fas fa-info-circle"></i>
          خطوات الاستخدام بعد التثبيت
        </h4>
        <ol className="text-sm text-blue-800 space-y-2 mr-4 list-decimal">
          <li>انقر على أيقونة الإضافة في شريط الأدوات</li>
          <li>أدخل عنوان الخادم (API URL) واحفظه</li>
          <li>أنشئ رمز إقران من قسم &quot;إقران إضافة جديدة&quot; أعلاه</li>
          <li>أدخل الرمز المكون من 8 أرقام في نافذة الإضافة</li>
          <li>بعد الإقران، اضغط <strong>&quot;بدء الجلسة&quot;</strong> في الإضافة</li>
          <li>اضغط <strong>&quot;فتح واتساب&quot;</strong> لفتح واتساب ويب</li>
          <li>امسح رمز QR من هاتفك إذا طُلب منك</li>
          <li>الآن الإضافة جاهزة لإرسال الرسائل تلقائياً!</li>
        </ol>
      </div>
    </div>
  );
}
