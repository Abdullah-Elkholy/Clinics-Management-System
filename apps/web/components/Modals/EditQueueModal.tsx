'use client';

import { useModal } from '@/contexts/ModalContext';
import { useUI } from '@/contexts/UIContext';
import { validateName, ValidationError } from '@/utils/validation';
import Modal from './Modal';
import { useState } from 'react';

export default function EditQueueModal() {
  const { openModals, closeModal, getModalData } = useModal();
  const { addToast } = useUI();
  const [doctorName, setDoctorName] = useState('');
  const [errors, setErrors] = useState<ValidationError>({});
  const [isLoading, setIsLoading] = useState(false);
  const [touched, setTouched] = useState(false);

  const isOpen = openModals.has('editQueue');
  const data = getModalData('editQueue');

  const validateField = (value: string) => {
    const error = validateName(value, 'اسم الطبيب');
    if (error) {
      setErrors({ doctorName: error });
    } else {
      setErrors({});
    }
  };

  const handleFieldChange = (value: string) => {
    setDoctorName(value);
    setTouched(true);
    // Validate on change for better UX
    if (errors.doctorName) {
      validateField(value);
    }
  };

  const handleFieldBlur = () => {
    setTouched(true);
    validateField(doctorName);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    
    const error = validateName(doctorName, 'اسم الطبيب');
    
    if (error) {
      setErrors({ doctorName: error });
      return;
    }

    try {
      setIsLoading(true);
      
      // Simulate API call
      setTimeout(() => {
        addToast('تم تحديث اسم الطبيب بنجاح', 'success');
        setDoctorName('');
        setErrors({});
        closeModal('editQueue');
        setIsLoading(false);
      }, 500);
    } catch (err) {
      addToast('حدث خطأ أثناء تحديث الطابور', 'error');
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        closeModal('editQueue');
        setDoctorName('');
        setErrors({});
        setTouched(false);
      }}
      title="تعديل الطابور"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">اسم الطبيب *</label>
          <input
            type="text"
            value={doctorName}
            onChange={(e) => handleFieldChange(e.target.value)}
            onBlur={handleFieldBlur}
            placeholder="أدخل اسم الطبيب"
            disabled={isLoading}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent transition-all ${
              errors.doctorName
                ? 'border-red-500 focus:ring-red-500'
                : 'border-gray-300 focus:ring-blue-500'
            }`}
          />
          {errors.doctorName && (
            <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
              <i className="fas fa-exclamation-circle"></i>
              {errors.doctorName}
            </p>
          )}
        </div>

        <div className="flex gap-3 pt-4 border-t">
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-2 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <i className="fas fa-spinner fa-spin"></i>
                جاري الحفظ...
              </>
            ) : (
              <>
                <i className="fas fa-save"></i>
                حفظ التغييرات
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              closeModal('editQueue');
              setDoctorName('');
              setErrors({});
            }}
            disabled={isLoading}
            className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            إلغاء
          </button>
        </div>
      </form>
    </Modal>
  );
}
