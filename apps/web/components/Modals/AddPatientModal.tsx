'use client';

import { useModal } from '@/contexts/ModalContext';
import { useUI } from '@/contexts/UIContext';
import Modal from './Modal';
import { useState } from 'react';

export default function AddPatientModal() {
  const { openModals, closeModal } = useModal();
  const { addToast } = useUI();
  const [patients, setPatients] = useState([
    { name: '', phone: '', countryCode: '+20' }
  ]);

  const isOpen = openModals.has('addPatient');

  const addPatientSlot = () => {
    if (patients.length >= 50) {
      addToast('الحد الأقصى 50 مريض', 'error');
      return;
    }
    setPatients([...patients, { name: '', phone: '', countryCode: '+20' }]);
  };

  const removePatientSlot = (index: number) => {
    setPatients(patients.filter((_, i) => i !== index));
  };

  const updatePatient = (index: number, field: string, value: string) => {
    const updated = [...patients];
    updated[index] = { ...updated[index], [field]: value };
    setPatients(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const validPatients = patients.filter(p => p.name.trim() && p.phone.trim());
    
    if (validPatients.length === 0) {
      addToast('يرجى إدخال بيانات المرضى', 'error');
      return;
    }

    // TODO: Add patients through context
    addToast(`تم إضافة ${validPatients.length} مريض بنجاح`, 'success');
    setPatients([{ name: '', phone: '', countryCode: '+20' }]);
    closeModal('addPatient');
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => closeModal('addPatient')}
      title="إضافة مرضى جدد"
      size="2xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col h-full space-y-4">
        <div id="patientSlots" className="space-y-4 flex-1 overflow-y-auto pr-2">
          {patients.map((patient, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    الاسم الكامل
                  </label>
                  <input
                    type="text"
                    value={patient.name}
                    onChange={(e) => updatePatient(index, 'name', e.target.value)}
                    placeholder="أدخل الاسم الكامل"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    رقم الهاتف
                  </label>
                  <div className="flex gap-1">
                    <select
                      value={patient.countryCode}
                      onChange={(e) => updatePatient(index, 'countryCode', e.target.value)}
                      className="px-2 py-2 border border-gray-300 rounded-r-lg bg-gray-50 text-sm"
                    >
                      <option value="+20">+20 (مصر)</option>
                      <option value="+966">+966 (السعودية)</option>
                      <option value="+971">+971 (الإمارات)</option>
                    </select>
                    <input
                      type="tel"
                      value={patient.phone}
                      onChange={(e) => updatePatient(index, 'phone', e.target.value)}
                      placeholder="رقم الهاتف"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-l-lg"
                    />
                  </div>
                </div>
              </div>
              {patients.length > 1 && (
                <button
                  type="button"
                  onClick={() => removePatientSlot(index)}
                  className="mt-2 text-red-600 hover:text-red-700 text-sm"
                >
                  <i className="fas fa-trash ml-1"></i>
                  حذف هذا المريض
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <button
            type="button"
            onClick={addPatientSlot}
            className="text-blue-600 hover:text-blue-700 text-sm"
          >
            <i className="fas fa-plus ml-1"></i>
            إضافة مريض آخر
          </button>
          <span className="text-sm text-gray-600">الحد الأقصى: 50 مريض</span>
        </div>

        <div className="flex gap-3 pt-4 border-t">
          <button
            type="submit"
            className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            إضافة المرضى
          </button>
          <button
            type="button"
            onClick={() => closeModal('addPatient')}
            className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400 transition-colors"
          >
            إلغاء
          </button>
        </div>
      </form>
    </Modal>
  );
}
