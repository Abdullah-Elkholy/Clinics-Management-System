'use client';

import { useModal } from '@/contexts/ModalContext';
import { useUI } from '@/contexts/UIContext';
import Modal from './Modal';
import { useState } from 'react';

export default function EditPatientModal() {
  const { openModals, closeModal, getModalData } = useModal();
  const { addToast } = useUI();
  const data = getModalData('editPatient');

  const initialName = data?.patient?.name ?? '';
  const initialPhone = data?.patient?.phone ?? '';
  const initialQueue = data?.patient?.queue ?? 1;
  const initialCountryCode = data?.patient?.countryCode ?? '+20';

  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [queue, setQueue] = useState(initialQueue.toString());
  const [countryCode, setCountryCode] = useState(initialCountryCode);

  const isOpen = openModals.has('editPatient');

  // When modal opens with data, keep local state in sync
  if (isOpen && (name === '' && initialName !== '')) {
    setName(initialName);
  }
  if (isOpen && (phone === '' && initialPhone !== '')) {
    setPhone(initialPhone);
  }
  if (isOpen && queue === '' && initialQueue) {
    setQueue(initialQueue.toString());
  }
  if (isOpen && countryCode === initialCountryCode && initialCountryCode !== data?.patient?.countryCode) {
    setCountryCode(data?.patient?.countryCode ?? '+20');
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !phone.trim()) {
      addToast('يرجى إدخال الاسم ورقم الهاتف', 'error');
      return;
    }

    const queueNum = parseInt(queue, 10);
    if (isNaN(queueNum) || queueNum <= 0) {
      addToast('يرجى إدخال ترتيب انتظار صحيح', 'error');
      return;
    }

    const updated = {
      ...data?.patient,
      name: name.trim(),
      phone: phone.trim(),
      countryCode: countryCode,
      queue: queueNum,
    };

    // call onSave callback if provided
    try {
      data?.onSave && data.onSave(updated);
    } catch (err) {
      // swallow errors from consumer
    }

    addToast('تم تحديث بيانات المريض بنجاح', 'success');
    closeModal('editPatient');
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => closeModal('editPatient')}
      title="تعديل بيانات المريض"
      size="md"
    >
        
      <form onSubmit={handleSubmit} className="space-y-4">

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">ترتيب الانتظار</label>
          <input
            type="number"
            value={queue}
            onChange={(e) => setQueue(e.target.value)}
            placeholder="أدخل ترتيب الانتظار"
            min="1"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">الاسم الكامل</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="أدخل الاسم الكامل"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">كود الدولة</label>
          <select
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="+20">مصر (+20)</option>
            <option value="+966">السعودية (+966)</option>
            <option value="+971">الإمارات (+971)</option>
            <option value="+974">قطر (+974)</option>
            <option value="+965">الكويت (+965)</option>
            <option value="+968">عمان (+968)</option>
            <option value="+973">البحرين (+973)</option>
            <option value="+962">الأردن (+962)</option>
            <option value="+963">سوريا (+963)</option>
            <option value="+961">لبنان (+961)</option>
            <option value="+212">المغرب (+212)</option>
            <option value="+216">تونس (+216)</option>
            <option value="+213">الجزائر (+213)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">رقم الهاتف</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="أدخل رقم الهاتف"
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
            onClick={() => closeModal('editPatient')}
            className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400 transition-colors"
          >
            إلغاء
          </button>
        </div>
      </form>
    </Modal>
  );
}
