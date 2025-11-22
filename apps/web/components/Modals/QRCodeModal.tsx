'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useModal } from '@/contexts/ModalContext';
import { useUI } from '@/contexts/UIContext';
import { useAuth } from '@/contexts/AuthContext';
import { whatsappApiClient } from '@/services/api/whatsappApiClient';
import Modal from './Modal';

/**
 * QRCodeModal - Displays QR code for WhatsApp authentication
 */
export default function QRCodeModal() {
  const { openModals, closeModal } = useModal();
  const { addToast } = useUI();
  const { user } = useAuth();
  const isOpen = openModals.has('qrCode');

  const [qrCodeImage, setQrCodeImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const moderatorId = user?.assignedModerator 
    ? parseInt(user.assignedModerator) 
    : (user?.role === 'moderator' ? user.id : null);

  const loadQRCode = useCallback(async () => {
    if (!moderatorId) {
      setError('لا يوجد مشرف مخصص');
      return;
    }

    setIsLoading(true);
    setError(null);
    setQrCodeImage(null);

    try {
      const response = await whatsappApiClient.getQRCode(moderatorId);
      
      if (response.success && response.data?.qrCodeImage) {
        setQrCodeImage(`data:${response.data.format};base64,${response.data.qrCodeImage}`);
      } else {
        setError(response.error || 'فشل تحميل رمز QR');
        addToast(response.error || 'فشل تحميل رمز QR', 'error');
      }
    } catch (err: any) {
      const errorMsg = err?.message || 'فشل تحميل رمز QR';
      setError(errorMsg);
      addToast(errorMsg, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [moderatorId, addToast]);

  useEffect(() => {
    if (isOpen) {
      loadQRCode();
    } else {
      // Reset state when modal closes
      setQrCodeImage(null);
      setError(null);
    }
  }, [isOpen, loadQRCode]);

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
              onClick={loadQRCode}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <i className="fas fa-redo ml-2"></i>
              إعادة المحاولة
            </button>
          </div>
        ) : qrCodeImage ? (
          <>
            <div className="bg-gray-100 rounded-lg p-6 flex items-center justify-center">
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
                onClick={loadQRCode}
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

