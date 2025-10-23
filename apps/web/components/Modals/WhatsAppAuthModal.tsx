'use client';

import { useModal } from '@/contexts/ModalContext';
import { useUI } from '@/contexts/UIContext';
import Modal from './Modal';

export default function WhatsAppAuthModal() {
  const { openModals, closeModal } = useModal();
  const { addToast } = useUI();

  const isOpen = openModals.has('whatsappAuth');

  const handleAuthenticate = () => {
    addToast('جاري المصادقة...', 'info');
    setTimeout(() => {
      addToast('تم تأكيد مصادقة واتساب بنجاح', 'success');
      closeModal('whatsappAuth');
    }, 2000);
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => closeModal('whatsappAuth')}
      title="مصادقة جلسة واتساب"
      size="md"
    >
      <div className="space-y-4">
        <div className="text-center">
          <div className="bg-gray-100 w-48 h-48 mx-auto rounded-lg flex items-center justify-center mb-4">
            <div className="text-center">
              <i className="fas fa-qrcode text-6xl text-gray-400 mb-2 block"></i>
              <p className="text-sm text-gray-600">رمز QR للمسح</p>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-blue-700">
              <i className="fas fa-info-circle ml-1"></i>
              افتح واتساب على هاتفك واذهب إلى الإعدادات &gt; الأجهزة المرتبطة &gt; ربط جهاز
            </p>
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t">
          <button
            onClick={handleAuthenticate}
            className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
          >
            <i className="fab fa-whatsapp"></i>
            تأكيد المصادقة
          </button>
          <button
            onClick={() => closeModal('whatsappAuth')}
            className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400 transition-colors"
          >
            إلغاء
          </button>
        </div>
      </div>
    </Modal>
  );
}
