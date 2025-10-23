'use client';

import { useModal } from '@/contexts/ModalContext';
import { useUI } from '@/contexts/UIContext';
import Modal from './Modal';
import { useState } from 'react';

export default function QuotaManagementModal() {
  const { openModals, closeModal } = useModal();
  const { addToast } = useUI();
  const [addMessages, setAddMessages] = useState('');
  const [addQueues, setAddQueues] = useState('');

  const isOpen = openModals.has('quotaManagement');

  const handleAddQuota = (type: 'messages' | 'queues') => {
    const amount = type === 'messages' ? parseInt(addMessages) : parseInt(addQueues);
    
    if (!amount || amount <= 0) {
      addToast('يرجى إدخال كمية صحيحة', 'error');
      return;
    }

    addToast(
      `تم إضافة ${amount} ${type === 'messages' ? 'رسالة' : 'طابور'} بنجاح`,
      'success'
    );
    
    if (type === 'messages') setAddMessages('');
    else setAddQueues('');
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => closeModal('quotaManagement')}
      title="إدارة حصة المشرف"
      size="lg"
    >
      <div className="flex flex-col h-full space-y-6">
        {/* Moderator Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex-shrink-0">
          <h4 className="font-medium text-blue-800">محمد أحمد</h4>
          <p className="text-sm text-blue-600">mod1</p>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto pr-2 space-y-6">
          {/* Messages Quota */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-800 mb-3">حصة الرسائل</h4>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-blue-600">100</div>
                <div className="text-sm text-blue-700">الحصة الإجمالية</div>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-orange-600">45</div>
                <div className="text-sm text-orange-700">الحصة المستهلكة</div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-600">55</div>
                <div className="text-sm text-green-700">الحصة المتبقية</div>
              </div>
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                value={addMessages}
                onChange={(e) => setAddMessages(e.target.value)}
                placeholder="أدخل الكمية المراد إضافتها"
                min="0"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
              />
              <button
                onClick={() => handleAddQuota('messages')}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
              >
                <i className="fas fa-plus ml-1"></i>
                إضافة
              </button>
            </div>
          </div>

          {/* Queues Quota */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-800 mb-3">حصة الطوابير</h4>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-blue-600">5</div>
                <div className="text-sm text-blue-700">الحصة الإجمالية</div>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-orange-600">3</div>
                <div className="text-sm text-orange-700">الحصة المستهلكة</div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-600">2</div>
                <div className="text-sm text-green-700">الحصة المتبقية</div>
              </div>
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                value={addQueues}
                onChange={(e) => setAddQueues(e.target.value)}
                placeholder="أدخل الكمية المراد إضافتها"
                min="0"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
              />
              <button
                onClick={() => handleAddQuota('queues')}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
              >
                <i className="fas fa-plus ml-1"></i>
                إضافة
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t flex-shrink-0">
          <button
            onClick={() => closeModal('quotaManagement')}
            className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400 transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    </Modal>
  );
}
