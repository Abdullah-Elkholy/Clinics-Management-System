'use client';

import { useModal } from '@/contexts/ModalContext';
import { useQueue } from '@/contexts/QueueContext';
import { useUI } from '@/contexts/UIContext';
import { useAuth } from '@/contexts/AuthContext';
import { validateName, ValidationError, hasErrors } from '@/utils/validation';
import { getModeratorInfo } from '@/utils/moderatorAggregation';
import { queuesApiClient } from '@/services/api/queuesApiClient';
import logger from '@/utils/logger';
import Modal from './Modal';
import { useState, type FormEvent } from 'react';

export default function AddQueueModal() {
  const { openModals, closeModal, getModalData } = useModal();
  const { refreshQueues } = useQueue();
  const { addToast } = useUI();
  const { user: currentUser } = useAuth();
  
  const [doctorName, setDoctorName] = useState('');
  const [errors, setErrors] = useState<ValidationError>({});
  const [isLoading, setIsLoading] = useState(false);
  const [touched, setTouched] = useState(false);

  const isOpen = openModals.has('addQueue');
  const modalData = getModalData('addQueue');
  const targetModeratorId = modalData?.moderatorId;
  const moderatorInfo = targetModeratorId ? getModeratorInfo(targetModeratorId) : null;

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

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setTouched(true);
    
    // Validate doctor name
    const error = validateName(doctorName, 'اسم الطبيب');
    
    if (error) {
      setErrors({ doctorName: error });
      return; // Prevent submission if validation fails
    }

    try {
      setIsLoading(true);
      
      // Make API call to create queue
      // If a moderatorId is provided in modal data (e.g., admin creating for moderator), use it
      // Otherwise, use the current user's ID
      const createdByUserId = currentUser?.id ? Number(currentUser.id) : 0;
      const queueModeratorId = targetModeratorId ? Number(targetModeratorId) : createdByUserId;

      await queuesApiClient.createQueue({
        doctorName: doctorName.trim(),
        moderatorId: queueModeratorId,
        createdBy: createdByUserId,
        currentPosition: 1,
        isActive: true,
      });
      addToast('تم إضافة الطابور بنجاح', 'success');
      
      // Refresh queues list from backend to include the newly created queue
      // Wait for refetch to complete before closing modal and dispatching event
      await refreshQueues();

      // Clear form fields after successful creation
      setDoctorName('');
      setErrors({});
      setTouched(false);
      
      closeModal('addQueue');
      
      // Trigger a custom event to notify other components to refetch
      // Dispatch after a small delay to ensure refreshQueues has updated the state
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('queueDataUpdated'));
      }, 100);
    } catch (error: unknown) {
      const typedError = error as { message?: string } | undefined;
      const errorMessage =
        queuesApiClient.formatApiError?.(typedError) || typedError?.message || 'حدث خطأ غير معروف';
      logger.error('Failed to add queue:', errorMessage);
      addToast(`حدث خطأ: ${errorMessage}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        closeModal('addQueue');
        setDoctorName('');
        setErrors({});
        setTouched(false);
      }}
      title={moderatorInfo ? `إضافة طابور للمشرف: ${moderatorInfo.name} (@${moderatorInfo.username})` : 'إضافة طابور جديد'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {moderatorInfo && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800 flex items-center gap-2">
            <i className="fas fa-user-tie text-blue-600"></i>
            <span>سيتم ربط هذا الطابور تلقائياً بالمشرف <strong>{moderatorInfo.name}</strong></span>
          </div>
        )}
        {/* Validation Errors Alert - Only show if user touched field and there are errors */}
        {touched && hasErrors(errors) && (
          <div className="bg-red-50 border-2 border-red-400 rounded-lg p-4">
            <p className="text-red-800 font-semibold flex items-center gap-2 mb-2">
              <i className="fas fa-exclamation-circle text-red-600"></i>
              يرجى تصحيح الأخطاء التالية:
            </p>
            <ul className="space-y-1 text-sm text-red-700">
              {Object.entries(errors).map(([field, errorMessage]) => (
                <li key={field} className="flex items-center gap-2">
                  <span className="inline-block w-1.5 h-1.5 bg-red-600 rounded-full"></span>
                  {errorMessage}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Doctor Name */}
        <div>
          <label htmlFor="addQueue-doctorName" className="block text-sm font-medium text-gray-700 mb-2">
            اسم الطبيب *
          </label>
          <input
            id="addQueue-doctorName"
            name="doctorName"
            type="text"
            value={doctorName ?? ''}
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
            disabled={hasErrors(errors) || !doctorName.trim() || isLoading}
            className="flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-2 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
