'use client';

import { useModal } from '@/contexts/ModalContext';
import { useState, useCallback } from 'react';
import Modal from './Modal';
import MessageConditionsForm, { MessageCondition } from '@/components/Common/MessageConditionsForm';

export default function MessageConditionsModal() {
  const { openModals, closeModal } = useModal();

  const isOpen = openModals.has('messageConditions');

  const [conditions, setConditions] = useState<MessageCondition[]>([
    {
      id: '1',
      type: 'queue_position',
      operator: 'greater',
      value: '5',
    },
  ]);

  /**
   * Save conditions and close modal
   */
  const handleSaveConditions = useCallback(() => {
    closeModal('messageConditions');
  }, [closeModal]);

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => closeModal('messageConditions')}
      title="إدارة شروط/قواعد الرسائل"
      size="2xl"
    >
      <div className="flex flex-col h-full space-y-4">
        <div className="flex-1 overflow-y-auto">
          <MessageConditionsForm
            conditions={conditions}
            onChange={setConditions}
            compact={false}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t flex-shrink-0">
          <button
            onClick={handleSaveConditions}
            className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 font-medium"
          >
            <i className="fas fa-check"></i>
            حفظ الشروط
          </button>
          <button
            onClick={() => closeModal('messageConditions')}
            className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400 transition-colors font-medium"
          >
            إلغاء
          </button>
        </div>
      </div>
    </Modal>
  );
}

