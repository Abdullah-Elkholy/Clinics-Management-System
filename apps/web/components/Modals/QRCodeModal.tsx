'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useModal } from '@/contexts/ModalContext';
import { useUI } from '@/contexts/UIContext';
import { useAuth } from '@/contexts/AuthContext';
import { useWhatsAppSession } from '@/contexts/WhatsAppSessionContext';
import { whatsappApiClient } from '@/services/api/whatsappApiClient';
import Modal from './Modal';

/**
 * QRCodeModal - Displays QR code for WhatsApp authentication
 * Auto-refreshes QR code every 10 seconds
 * Auto-closes when authenticated
 */
export default function QRCodeModal() {
  const { openModals, closeModal } = useModal();
  const { addToast } = useUI();
  const { user } = useAuth();
  const { checkAuthentication, refreshSessionStatus, refreshGlobalPauseState } = useWhatsAppSession();
  const isOpen = openModals.has('qrCode');

  const [qrCodeImage, setQrCodeImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const authCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const moderatorId = user?.assignedModerator 
    ? parseInt(user.assignedModerator) 
    : (user?.role === 'moderator' ? (typeof user.id === 'number' ? user.id : parseInt(String(user.id))) : null);

  const loadQRCode = useCallback(async (silent = false) => {
    if (!moderatorId) {
      setError('لا يوجد مشرف مخصص');
      return;
    }

    if (!silent) {
      setIsLoading(true);
    }
    setError(null);
    setQrCodeImage(null);

    try {
      const response = await whatsappApiClient.getQRCode(moderatorId);
      
      if (response.success && response.data?.qrCodeImage) {
        setQrCodeImage(`data:${response.data.format};base64,${response.data.qrCodeImage}`);
      } else {
        setError(response.error || 'فشل تحميل رمز QR');
        if (!silent) {
          addToast(response.error || 'فشل تحميل رمز QR', 'error');
        }
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'فشل تحميل رمز QR';
      setError(errorMsg);
      if (!silent) {
        addToast(errorMsg, 'error');
      }
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  }, [moderatorId, addToast]);

  // Check authentication status periodically
  const checkAuthStatus = useCallback(async () => {
    if (!moderatorId || !isOpen) return;

    try {
      const result = await checkAuthentication();
      if (result.isSuccess === true || result.state === 'Success') {
        // Authenticated! Refresh both states to clear any PendingQR state
        await Promise.all([
          refreshSessionStatus(),
          refreshGlobalPauseState()
        ]);
        // Authenticated! Close modal and show success
        addToast('تم المصادقة بنجاح!', 'success');
        closeModal('qrCode');
      }
    } catch {
      // Silently fail - don't show error for auth checks
      // Error is intentionally ignored for background auth checks
    }
  }, [moderatorId, isOpen, checkAuthentication, addToast, closeModal, refreshSessionStatus, refreshGlobalPauseState]);

  useEffect(() => {
    if (isOpen) {
      // Initial load
      loadQRCode();

      // Auto-refresh QR code every 10 seconds
      refreshIntervalRef.current = setInterval(() => {
        loadQRCode(true); // Silent refresh
      }, 10000); // 10 seconds

      // Check authentication status every 3 seconds
      authCheckIntervalRef.current = setInterval(() => {
        checkAuthStatus();
      }, 3000); // 3 seconds
    } else {
      // Reset state when modal closes
      setQrCodeImage(null);
      setError(null);
      
      // Clear intervals
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
      if (authCheckIntervalRef.current) {
        clearInterval(authCheckIntervalRef.current);
        authCheckIntervalRef.current = null;
      }
    }

    // Cleanup on unmount
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
      if (authCheckIntervalRef.current) {
        clearInterval(authCheckIntervalRef.current);
      }
    };
  }, [isOpen, loadQRCode, checkAuthStatus]);

  const handleClose = useCallback(() => {
    closeModal('qrCode');
  }, [closeModal]);

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="رمز QR للمصادقة"
      size="md"
    >
      <div className="space-y-4" dir="rtl">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600">جاري تحميل رمز QR...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12">
            <i className="fas fa-exclamation-triangle text-red-500 text-5xl mb-4"></i>
            <p className="text-gray-800 font-semibold mb-2">خطأ</p>
            <p className="text-gray-600 text-center mb-4">{error}</p>
            <button
              onClick={() => loadQRCode()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <i className="fas fa-redo ml-2"></i>
              إعادة المحاولة
            </button>
          </div>
        ) : qrCodeImage ? (
          <>
            <div className="bg-gray-100 rounded-lg p-6 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrCodeImage}
                alt="WhatsApp QR Code"
                className="max-w-full h-auto"
                style={{ maxHeight: '400px' }}
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800 flex items-start gap-2">
                <i className="fas fa-info-circle mt-0.5"></i>
                <span>
                  افتح واتساب على هاتفك واذهب إلى الإعدادات &gt; الأجهزة المرتبطة &gt; ربط جهاز،
                  ثم امسح رمز QR أعلاه
                </span>
              </p>
            </div>

            <div className="flex gap-3 pt-4 border-t">
              <button
                onClick={() => loadQRCode()}
                className="flex-1 bg-gray-600 text-white py-2 rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
              >
                <i className="fas fa-redo"></i>
                تحديث الرمز
              </button>
              <button
                onClick={handleClose}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                إغلاق
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-12">
            <i className="fas fa-qrcode text-gray-400 text-5xl mb-4"></i>
            <p className="text-gray-600">لا يمكن عرض رمز QR</p>
          </div>
        )}
      </div>
    </Modal>
  );
}

