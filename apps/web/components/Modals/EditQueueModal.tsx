'use client';

import React, { useState, useEffect } from 'react';
import { useModal } from '@/contexts/ModalContext';
import { useUI } from '@/contexts/UIContext';
import { useQueue } from '@/contexts/QueueContext';
import { validateName, ValidationError } from '@/utils/validation';
import { queuesApiClient, type QueueDto } from '@/services/api/queuesApiClient';
import { queueDtoToModel } from '@/services/api/adapters';
import Modal from './Modal';
import logger from '@/utils/logger';

export default function EditQueueModal() {
  const { openModals, closeModal, getModalData } = useModal();
  const { addToast } = useUI();
  const { queues, updateQueue, refreshQueues } = useQueue();
  const [doctorName, setDoctorName] = useState('');
  const [errors, setErrors] = useState<ValidationError>({});
  const [isLoading, setIsLoading] = useState(false);
  const [touched, setTouched] = useState(false);
  const [freshQueueData, setFreshQueueData] = useState<any>(null);

  const isOpen = openModals.has('editQueue');
  const data = getModalData('editQueue');
  const queue = data?.queue;
  
  // Fetch fresh queue data when modal opens
  useEffect(() => {
    if (!isOpen || !queue?.id) return;
    
    const fetchFreshQueueData = async () => {
      try {
        const queueIdNum = Number(queue.id);
        if (!isNaN(queueIdNum)) {
          const freshQueueDto: QueueDto = await queuesApiClient.getQueue(queueIdNum);
          if (freshQueueDto) {
            // Convert backend DTO to frontend format
            const freshQueue = queueDtoToModel(freshQueueDto);
            setFreshQueueData(freshQueue);
          }
        }
      } catch (err) {
        // If fresh data fetch fails, fall back to existing data
        if (process.env.NODE_ENV === 'development') {
          logger.error('Failed to fetch fresh queue data:', err);
        }
        setFreshQueueData(null);
      }
    };
    
    // Always refetch when modal opens to ensure fresh data
    fetchFreshQueueData();
  }, [isOpen, queue?.id]);
  
  // Get fresh queue data - prioritize freshQueueData, then queues array, then props
  const freshQueue = freshQueueData 
    || (queue?.id 
      ? queues.find(q => q.id === queue.id) || queue
      : queue);
  
  // Initialize field with existing data when modal opens
  // Get fresh queue data
  useEffect(() => {
    if (!isOpen) return;
    
    if (freshQueue?.doctorName) {
      setDoctorName(freshQueue.doctorName);
      setErrors({});
      setTouched(false);
    }
  }, [isOpen, freshQueue?.id, freshQueue?.doctorName]); // Depend on queue ID and doctorName to re-init when data updates

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    
    if (!queue?.id) {
      addToast('خطأ: معرّف الطابور غير صالح', 'error');
      logger.error('Queue ID is missing or invalid:', queue);
      return;
    }
    
    const error = validateName(doctorName, 'اسم الطبيب');
    
    if (error) {
      setErrors({ doctorName: error });
      return;
    }

    try {
      setIsLoading(true);
      
      // Make API call to update queue
      await queuesApiClient.updateQueue(queue.id, {
        doctorName: doctorName.trim(),
      });

      // Update local context state for backward-compatibility with existing consumers/tests
      if (queue?.id) {
        updateQueue(String(queue.id), { doctorName: doctorName.trim() });
      }

      addToast('تم تحديث اسم الطبيب بنجاح', 'success');
      
      // If refresh is available, also refetch from backend to ensure server truth
      // Wait for refetch to complete before closing modal and dispatching event
      if (typeof refreshQueues === 'function') {
        await refreshQueues();
      }

      // Clear form fields after successful update
      setDoctorName('');
      setErrors({});
      setTouched(false);
      
      closeModal('editQueue');
      
      // Trigger a custom event to notify other components to refetch
      // Dispatch after a small delay to ensure refreshQueues has updated the state
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('queueDataUpdated'));
      }, 100);
    } catch (err) {
      // Extract validation errors from response
      let errorMessage = 'حدث خطأ غير معروف';
      const errorObj = (err as any)?.response?.data || (err as any)?.data || err;
      
      if (errorObj?.errors && typeof errorObj.errors === 'object') {
        // Format validation errors: {"id": ["The value 'NaN' is not valid."]}
        const errorEntries = Object.entries(errorObj.errors);
        const formattedErrors = errorEntries
          .map(([field, messages]: [string, any]) => 
            Array.isArray(messages) ? messages[0] : String(messages)
          )
          .join('; ');
        errorMessage = formattedErrors || errorObj.title || errorMessage;
      } else {
        errorMessage = queuesApiClient.formatApiError?.(err) || (err as any)?.message || errorMessage;
      }
      
      logger.error('Failed to update queue:', { error: err, parsed: errorMessage });
      addToast(`حدث خطأ أثناء تحديث الطابور: ${errorMessage}`, 'error');
    } finally {
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
          <label htmlFor="editQueue-doctorName" className="block text-sm font-medium text-gray-700 mb-2">اسم الطبيب *</label>
          <input
            id="editQueue-doctorName"
            name="doctorName"
            type="text"
            value={doctorName ?? ''}
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
