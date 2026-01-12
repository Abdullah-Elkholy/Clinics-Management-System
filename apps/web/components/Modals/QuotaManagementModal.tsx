'use client';

import { useModal } from '@/contexts/ModalContext';
import { useUI } from '@/contexts/UIContext';
import { messageApiClient } from '@/services/api/messageApiClient';
import Modal from './Modal';
import { useState, useEffect } from 'react';
import logger from '@/utils/logger';

export default function QuotaManagementModal() {
  const { openModals, closeModal, getModalData } = useModal();
  const { addToast } = useUI();
  
  const [addMessages, setAddMessages] = useState('');
  const [addQueues, setAddQueues] = useState('');
  const [moderatorData, setModeratorData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const isOpen = openModals.has('quotaManagement');
  const modalData = getModalData('quotaManagement');
  
  // Initialize moderator data from modal context
  useEffect(() => {
    if (isOpen && modalData?.moderator) {
      setModeratorData(modalData.moderator);
      setAddMessages('');
      setAddQueues('');
    }
  }, [isOpen, modalData?.moderator?.id]);

  const moderatorName = moderatorData?.firstName && moderatorData?.lastName 
    ? `${moderatorData.firstName} ${moderatorData.lastName}`
    : moderatorData?.firstName || 'غير محدد';
    
  const moderatorUsername = moderatorData?.username || '-';
  const currentMessagesQuota = modalData?.currentQuotas?.messagesQuota ?? -1;
  const currentQueuesQuota = modalData?.currentQuotas?.queuesQuota ?? -1;
  
  // Calculate used quotas from modal data or moderatorData
  const messagesUsed = moderatorData?.messagesUsed || 0;
  const queuesUsed = moderatorData?.queuesUsed || 0;
  const messagesRemaining = currentMessagesQuota === -1 ? -1 : currentMessagesQuota - messagesUsed;
  const queuesRemaining = currentQueuesQuota === -1 ? -1 : currentQueuesQuota - queuesUsed;

  const handleAddQuota = async (type: 'messages' | 'queues') => {
    if (!moderatorData?.id) {
      addToast('لم يتم تحديد مشرف', 'error');
      return;
    }

    const amount = type === 'messages' ? parseInt(addMessages) : parseInt(addQueues);
    
    if (!amount || amount <= 0) {
      addToast('يرجى إدخال كمية صحيحة', 'error');
      return;
    }

    try {
      setIsLoading(true);
      
      const moderatorIdNum = Number(moderatorData.id);
      if (isNaN(moderatorIdNum)) {
        addToast('معرّف المشرف غير صالح', 'error');
        return;
      }

      // Get current quota to calculate new total
      const currentQuota = await messageApiClient.getQuota(moderatorIdNum);
      
      // Calculate new quota values
      const newMessagesQuota = type === 'messages' 
        ? (currentQuota.limit || currentMessagesQuota) + amount 
        : undefined;
      const newQueuesQuota = type === 'queues' 
        ? (currentQuota.queuesLimit || currentQueuesQuota) + amount 
        : undefined;

      // Update quota via API
      await messageApiClient.updateQuota(moderatorIdNum, {
        limit: newMessagesQuota,
        queuesLimit: newQueuesQuota,
      });

      addToast(
        `تم إضافة ${amount} ${type === 'messages' ? 'رسالة' : 'عيادة'} للمشرف بنجاح`,
        'success'
      );
      
      // Clear input fields
      if (type === 'messages') setAddMessages('');
      else setAddQueues('');

      // Refresh modal data by closing and reopening (parent component should handle refetch)
      // The parent component should refetch quota data after modal closes
    } catch (error: any) {
      const errorMessage = messageApiClient.formatApiError?.(error) || error?.message || 'حدث خطأ أثناء تحديث الحصة';
      addToast(errorMessage, 'error');
      logger.error('Failed to update quota:', error);
    } finally {
      setIsLoading(false);
    }
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
          <h4 className="font-medium text-blue-800">{moderatorName}</h4>
          <p className="text-sm text-blue-600">{moderatorUsername}</p>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto pr-2 space-y-6">
          {/* Messages Quota */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-800 mb-3">حصة الرسائل</h4>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-blue-600">{currentMessagesQuota === -1 ? 'غير محدود' : currentMessagesQuota}</div>
                <div className="text-sm text-blue-700">الحصة الإجمالية</div>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-orange-600">{messagesUsed}</div>
                <div className="text-sm text-orange-700">الحصة المستهلكة</div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-600">{messagesRemaining === -1 ? 'غير محدود' : messagesRemaining}</div>
                <div className="text-sm text-green-700">الحصة المتبقية</div>
              </div>
            </div>
            <div className="flex gap-2">
              <label htmlFor="quota-messages" className="sr-only">كمية الرسائل المراد إضافتها</label>
              <input
                id="quota-messages"
                name="addMessages"
                type="number"
                value={addMessages}
                onChange={(e) => setAddMessages(e.target.value)}
                placeholder="أدخل الكمية المراد إضافتها"
                min="0"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
              />
              <button
                onClick={() => handleAddQuota('messages')}
                disabled={isLoading}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <i className="fas fa-spinner fa-spin ml-1"></i>
                    جاري...
                  </>
                ) : (
                  <>
                    <i className="fas fa-plus ml-1"></i>
                    إضافة
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Queues Quota */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-800 mb-3">حصة العيادات</h4>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-blue-600">{currentQueuesQuota === -1 ? 'غير محدود' : currentQueuesQuota}</div>
                <div className="text-sm text-blue-700">الحصة الإجمالية</div>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-orange-600">{queuesUsed}</div>
                <div className="text-sm text-orange-700">الحصة المستهلكة</div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-600">{queuesRemaining === -1 ? 'غير محدود' : queuesRemaining}</div>
                <div className="text-sm text-green-700">الحصة المتبقية</div>
              </div>
            </div>
            <div className="flex gap-2">
              <label htmlFor="quota-queues" className="sr-only">كمية العيادات المراد إضافتها</label>
              <input
                id="quota-queues"
                name="addQueues"
                type="number"
                value={addQueues}
                onChange={(e) => setAddQueues(e.target.value)}
                placeholder="أدخل الكمية المراد إضافتها"
                min="0"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
              />
              <button
                onClick={() => handleAddQuota('queues')}
                disabled={isLoading}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <i className="fas fa-spinner fa-spin ml-1"></i>
                    جاري...
                  </>
                ) : (
                  <>
                    <i className="fas fa-plus ml-1"></i>
                    إضافة
                  </>
                )}
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

