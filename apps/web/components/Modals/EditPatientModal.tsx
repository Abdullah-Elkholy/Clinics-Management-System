'use client';

import { useModal } from '@/contexts/ModalContext';
import { useUI } from '@/contexts/UIContext';
import { COUNTRY_CODES } from '@/constants';
import { validateCountryCode } from '@/utils/validation';
import Modal from './Modal';
import { useState } from 'react';
import CountryCodeSelector from '@/components/Common/CountryCodeSelector';
import CustomCountryCodeInput from '@/components/Common/CustomCountryCodeInput';
import { getEffectiveCountryCode } from '@/utils/core.utils';

export default function EditPatientModal() {
  const { openModals, closeModal, getModalData } = useModal();
  const { addToast } = useUI();
  const data = getModalData('editPatient');

  const initialName = data?.patient?.name ?? '';
  const initialPhone = data?.patient?.phone ?? '';
  const initialCountryCode = data?.patient?.countryCode ?? '+20';

  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [countryCode, setCountryCode] = useState(initialCountryCode);
  const [customCountryCode, setCustomCountryCode] = useState('');

  const isOpen = openModals.has('editPatient');

  // When modal opens with data, keep local state in sync
  if (isOpen && (name === '' && initialName !== '')) {
    setName(initialName);
  }
  if (isOpen && (phone === '' && initialPhone !== '')) {
    setPhone(initialPhone);
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

    // Get effective country code (handle "OTHER" option)
    const effectiveCountryCode = getEffectiveCountryCode(countryCode, customCountryCode);

    // Validate country code
    const countryCodeError = validateCountryCode(effectiveCountryCode, true);
    if (countryCodeError) {
      addToast(`خطأ في كود الدولة: ${countryCodeError}`, 'error');
      return;
    }

    const updated = {
      ...data?.patient,
      name: name.trim(),
      phone: phone.trim(),
      countryCode: effectiveCountryCode,
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
          <CountryCodeSelector
            value={countryCode}
            onChange={setCountryCode}
            size="md"
            showOptgroups={true}
          />
        </div>

        {/* Custom Country Code Input */}
        {countryCode === 'OTHER' && (
          <CustomCountryCodeInput
            value={customCountryCode}
            onChange={setCustomCountryCode}
            size="md"
            placeholder="مثال: +44 (بريطانيا) أو +1 (أمريكا) أو +86 (الصين)"
            showFullInfo={true}
          />
        )}

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
