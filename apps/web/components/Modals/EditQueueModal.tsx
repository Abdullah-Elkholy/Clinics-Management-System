'use client';

import { useModal } from '@/contexts/ModalContext';
import { useUI } from '@/contexts/UIContext';
import Modal from './Modal';
import { useState } from 'react';

export default function EditQueueModal() {
  const { openModals, closeModal, getModalData } = useModal();
  const { addToast } = useUI();
  const [doctorName, setDoctorName] = useState('');

  const isOpen = openModals.has('editQueue');
  const data = getModalData('editQueue');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!doctorName.trim()) {
      addToast('يرجى إدخال اسم الطبيب', 'error');
      return;
    }

    addToast('تم تحديث اسم الطبيب بنجاح', 'success');
    closeModal('editQueue');
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => closeModal('editQueue')}
      title="تعديل الطابور"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">اسم الطبيب</label>
          <input
            type="text"
            value={doctorName}
            onChange={(e) => setDoctorName(e.target.value)}
            placeholder="أدخل اسم الطبيب"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex gap-3 pt-4 border-t">
          <button
            type="submit"
            className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            حفظ التغييرات
          </button>
          <button
            type="button"
            onClick={() => closeModal('editQueue')}
            className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400 transition-colors"
          >
            إلغاء
          </button>
        </div>
      </form>
    </Modal>
  );
}
