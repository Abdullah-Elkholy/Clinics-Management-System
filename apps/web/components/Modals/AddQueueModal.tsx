'use client';

import { useModal } from '@/contexts/ModalContext';
import { useQueue } from '@/contexts/QueueContext';
import { useUI } from '@/contexts/UIContext';
import { validateName, validatePhone, ValidationError, hasErrors } from '@/utils/validation';
import Modal from './Modal';
import { useState } from 'react';

export default function AddQueueModal() {
  const { openModals, closeModal } = useModal();
  const { addQueue } = useQueue();
  const { addToast } = useUI();
  
  const [doctorName, setDoctorName] = useState('');
  const [errors, setErrors] = useState<ValidationError>({});
  const [isLoading, setIsLoading] = useState(false);

  const isOpen = openModals.has('addQueue');

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
    // Validate on change for better UX
    if (errors.doctorName) {
      validateField(value);
    }
  };

  const handleFieldBlur = () => {
    validateField(doctorName);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate doctor name
    const error = validateName(doctorName, 'اسم الطبيب');
    
    if (error) {
      setErrors({ doctorName: error });
      addToast('يرجى تصحيح الأخطاء أعلاه', 'error');
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      addQueue({
        doctorName: doctorName.trim(),
      });

      addToast('تم إضافة الطابور بنجاح', 'success');
      
      // Reset form
      setDoctorName('');
      setErrors({});
      closeModal('addQueue');
    } catch (error) {
      addToast('حدث خطأ أثناء إضافة الطابور', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const isSubmitDisabled = hasErrors(errors) || !doctorName.trim() || isLoading;

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        closeModal('addQueue');
        setDoctorName('');
        setErrors({});
      }}
      title="إضافة طابور جديد"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Doctor Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            اسم الطبيب *
          </label>
          <input
            type="text"
            value={doctorName}
            onChange={(e) => handleFieldChange(e.target.value)}
            onBlur={handleFieldBlur}
            placeholder="أدخل اسم الطبيب"
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:border-transparent transition-all ${
              errors.doctorName
                ? 'border-red-500 focus:ring-red-500'
                : 'border-gray-300 focus:ring-blue-500'
            }`}
            disabled={isLoading}
          />
          {errors.doctorName && (
            <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
              <i className="fas fa-exclamation-circle"></i>
              {errors.doctorName}
            </p>
          )}
        </div>

        {/* Buttons */}
        <div className="flex gap-3 pt-4 border-t">
          <button
            type="submit"
            disabled={isSubmitDisabled}
            className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-2 ${
              isSubmitDisabled
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isLoading ? (
              <>
                <i className="fas fa-spinner fa-spin"></i>
                جاري الإضافة...
              </>
            ) : (
              <>
                <i className="fas fa-plus"></i>
                إضافة
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              closeModal('addQueue');
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
