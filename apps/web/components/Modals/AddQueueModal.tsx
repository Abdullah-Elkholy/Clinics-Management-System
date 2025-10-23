'use client';

import { useModal } from '@/contexts/ModalContext';
import { useQueue } from '@/contexts/QueueContext';
import { useUI } from '@/contexts/UIContext';
import Modal from './Modal';
import { useState } from 'react';

export default function AddQueueModal() {
  const { openModals, closeModal } = useModal();
  const { addQueue } = useQueue();
  const { addToast } = useUI();
  const [doctorName, setDoctorName] = useState('');

  const isOpen = openModals.has('addQueue');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!doctorName.trim()) {
      addToast('يرجى إدخال اسم الطبيب', 'error');
      return;
    }

    addQueue({
      doctorName: doctorName.trim(),
    });

    addToast('تم إضافة الطابور بنجاح', 'success');
    setDoctorName('');
    closeModal('addQueue');
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => closeModal('addQueue')}
      title="إضافة طابور جديد"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            اسم الطبيب
          </label>
          <input
            type="text"
            value={doctorName}
            onChange={(e) => setDoctorName(e.target.value)}
            placeholder="أدخل اسم الطبيب"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="flex gap-3 pt-4 border-t">
          <button
            type="submit"
            className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            إضافة
          </button>
          <button
            type="button"
            onClick={() => closeModal('addQueue')}
            className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400 transition-colors"
          >
            إلغاء
          </button>
        </div>
      </form>
    </Modal>
  );
}
