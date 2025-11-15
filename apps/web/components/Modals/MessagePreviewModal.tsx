'use client';

import { useModal } from '@/contexts/ModalContext';
import { useUI } from '@/contexts/UIContext';
import { useQueue } from '@/contexts/QueueContext';
import { formatPositionDisplay } from '@/utils/queuePositionUtils';
import { resolvePatientMessages } from '@/services/queueMessageService';
import { QueueMessageConfig, MessageResolution } from '@/types/messageCondition';
import { Patient } from '@/types';
import { messageApiClient } from '@/services/api/messageApiClient';
import { useState, useMemo } from 'react';
import Modal from './Modal';

export default function MessagePreviewModal() {
  const { openModals, closeModal, getModalData } = useModal();
  const { addToast } = useUI();
  const { queues, messageTemplates, messageConditions, patients: contextPatients } = useQueue();
  const data = getModalData('messagePreview');

  const isOpen = openModals.has('messagePreview');
  const selectedCount = data?.selectedPatientCount ?? 0;
  const selectedPatientIds = data?.selectedPatients ?? [];
  const currentCQP = data?.currentCQP ? parseInt(data.currentCQP) : undefined;
  const queueId = data?.queueId;
  const defaultTemplateId = data?.defaultTemplateId; // Template ID from queue data

  // State for removed patients
  const [removedPatients, setRemovedPatients] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);

  // Get queue data from context as fallback
  const queue = useMemo(() => {
    if (!queueId) return null;
    return queues.find(q => String(q.id) === String(queueId));
  }, [queues, queueId]);

  // Get real templates and conditions from context
  const realTemplates = useMemo(() => {
    if (!queueId) return [];
    return messageTemplates.filter(t => String(t.queueId) === String(queueId));
  }, [messageTemplates, queueId]);

  const realConditions = useMemo(() => {
    if (!queueId) return [];
    return messageConditions.filter(c => String(c.queueId) === String(queueId));
  }, [messageConditions, queueId]);

  // Get default template ONLY if explicitly marked by DEFAULT condition (do not fallback silently)
  const defaultTemplate = useMemo(() => {
    return realTemplates.find(t => t.condition?.operator === 'DEFAULT');
  }, [realTemplates]);

  // Preview data with queue positions - use data from modal, fallback to context patients
  const previewPatients: Patient[] = useMemo(() => {
    if (data?.patients && data.patients.length > 0) {
      return data.patients;
    }
    // Fallback to context patients filtered by selected IDs
    if (queueId && selectedPatientIds.length > 0) {
      return contextPatients.filter(p => 
        String(p.queueId) === String(queueId) && selectedPatientIds.includes(String(p.id))
      );
    }
    return [];
  }, [data?.patients, contextPatients, queueId, selectedPatientIds]);

  // Sort patients by queue position (الترتيب) - ascending order
  const sortedPatients = useMemo(() => {
    return [...previewPatients].sort((a, b) => {
      const posA = a.position || 0;
      const posB = b.position || 0;
      return posA - posB;
    });
  }, [previewPatients]);

  // Real values for message variables from queue or data
  const currentQueuePosition = useMemo(() => {
    if (currentCQP !== undefined) return parseInt(String(currentCQP));
    if (queue && 'currentPosition' in queue) return (queue as any).currentPosition || 3;
    return 3;
  }, [currentCQP, queue]);

  const estimatedTimePerSession = useMemo(() => {
    if (data?.estimatedTimeRemaining) return parseInt(String(data.estimatedTimeRemaining));
    if (queue && 'estimatedWaitMinutes' in queue) return (queue as any).estimatedWaitMinutes || 15;
    return 15;
  }, [data?.estimatedTimeRemaining, queue]);

  const queueName = useMemo(() => {
    if (data?.queueName) return data.queueName;
    if (queue) return queue.doctorName;
    return 'د. أحمد محمد';
  }, [data?.queueName, queue]);

  // Build a QueueMessageConfig from real data
  const messageConfig: QueueMessageConfig = useMemo(() => ({
    queueId: queueId || 'default',
    queueName,
    // Only include a default template if one truly exists
    defaultTemplate: defaultTemplate?.content,
    conditions: realConditions,
  }), [queueId, queueName, defaultTemplate, realConditions]);

  const missingDefaultTemplate = !defaultTemplate;

  // Resolve all patients using the service
  const patientArray = useMemo(() => {
    return sortedPatients
      .filter((p) => selectedPatientIds.includes(String(p.id)) && !removedPatients.includes(String(p.id)))
      .map((p) => ({ id: String(p.id), name: p.name, position: p.position || 0 }));
  }, [sortedPatients, selectedPatientIds, removedPatients]);

  const resolutions = useMemo(() => {
    return resolvePatientMessages(
      messageConfig,
      patientArray,
      currentQueuePosition,
      { estimatedTimePerSessionMinutes: estimatedTimePerSession }
    );
  }, [messageConfig, patientArray, currentQueuePosition, estimatedTimePerSession]);

  // Group resolutions by resolvedTemplate for grouped display
  const groupedByTemplate = resolutions.reduce(
    (acc, res) => {
      const key = res.resolvedTemplate || `[${res.reason}]`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(res);
      return acc;
    },
    {} as Record<string, MessageResolution[]>
  );
  
  // Helper function to format phone number using the utility
  const formatPhoneNumber = (phone: string, countryCode: string = '+20') => {
    // Import formatPhoneForDisplay at the top, but for now use inline logic
    if (!phone) return '';
    let cleaned = phone.replace(/[^\d]/g, '');
    const countryCodeDigits = countryCode.replace(/[^\d]/g, '');
    if (cleaned.startsWith(countryCodeDigits)) {
      cleaned = cleaned.substring(countryCodeDigits.length);
    }
    // Remove leading zero for Egypt
    if (countryCodeDigits === '20' && cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }
    return `${countryCode} ${cleaned}`;
  };

  // Function to get badge color and text for resolution reason
  const getReasonBadge = (reason: string) => {
    switch (reason) {
      case 'CONDITION':
        return { bg: 'bg-blue-100', text: 'text-blue-700', label: 'حالة' };
      case 'DEFAULT':
        return { bg: 'bg-green-100', text: 'text-green-700', label: 'افتراضي' };
      case 'EXCLUDED':
        return { bg: 'bg-gray-100', text: 'text-gray-700', label: 'مستثنى' };
      case 'NO_MATCH':
        return { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'بلا تطابق' };
      default:
        return { bg: 'bg-gray-100', text: 'text-gray-700', label: reason };
    }
  };

  const handleConfirmSend = async () => {
    // Use default template from real templates if defaultTemplateId is not provided
    const templateToUse = defaultTemplateId ? Number(defaultTemplateId) : (defaultTemplate ? Number(defaultTemplate.id) : null);
    
    if (!templateToUse || isNaN(templateToUse)) {
      addToast('القالب الافتراضي غير محدد، برجاء إنشاء قالب وجعله افتراضياً أولاً', 'error');
      return;
    }

    const patientsToSend = resolutions
      .filter((res) => res.reason !== 'EXCLUDED' && !removedPatients.includes(String(res.patientId)))
      .map((res) => Number(res.patientId))
      .filter((id) => !isNaN(id));

    if (patientsToSend.length === 0) {
      addToast('لا يوجد مرضى لإرسال الرسائل لهم', 'error');
      return;
    }

    setIsSending(true);
    try {
      await messageApiClient.sendMessages({
        templateId: templateToUse,
        patientIds: patientsToSend,
        channel: 'whatsapp',
      });

      addToast(`تم إرسال ${patientsToSend.length} رسالة بنجاح`, 'success');
      closeModal('messagePreview');
      
      // Trigger refetch events
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('patientDataUpdated'));
        window.dispatchEvent(new CustomEvent('queueDataUpdated'));
        window.dispatchEvent(new CustomEvent('messageDataUpdated'));
      }, 100);
    } catch (err: any) {
      addToast(err?.message || 'فشل إرسال الرسائل', 'error');
    } finally {
      setIsSending(false);
    }
  };

  const handleRemovePatient = (patientId: string | number) => {
    setRemovedPatients([...removedPatients, String(patientId)]);
    addToast('تم إزالة المريض من المعاينة', 'info');
  };

  const handleRestorePatient = (patientId: string | number) => {
    setRemovedPatients(removedPatients.filter(id => id !== String(patientId)));
    addToast('تم استعادة المريض', 'info');
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => closeModal('messagePreview')}
      title="معاينة الرسائل قبل الإرسال"
      size="2xl"
    >
      <div className="flex flex-col h-full space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-blue-800">معلومات الحل</h4>
              <p className="text-sm text-blue-600 mt-2">
                الإجمالي: {selectedCount} مريض | الموقع الحالي (CQP): {currentQueuePosition}
              </p>
            </div>
            <div className="text-blue-600 text-left">
              <span className="text-2xl font-bold">{selectedCount - removedPatients.length}</span>
              <p className="text-sm">سيتم إرسال الرسالة لهم</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col flex-1">
          {missingDefaultTemplate && (
            <div className="px-4 py-3 bg-yellow-50 border-b border-yellow-200 flex items-start gap-3 text-sm text-yellow-800">
              <i className="fas fa-exclamation-triangle mt-1"></i>
              <div>
                <p className="font-medium">لا يوجد قالب افتراضي معرف لهذا الطابور.</p>
                <p className="mt-1">قم بإنشاء قالب جديد وجعل حالته DEFAULT من خلال إدارة القوالب، أو اختر قالباً افتراضياً قبل المتابعة. لن يمكنك إرسال الرسائل بدون قالب افتراضي.</p>
              </div>
            </div>
          )}
          <div className="px-4 py-3 bg-gray-50 border-b flex-shrink-0">
            <h4 className="font-bold text-gray-800">جدول المعاينة</h4>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-600">الترتيب</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-600">الاسم</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-600">الهاتف</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-600">الرسالة</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-600">الحالة</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-600">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {resolutions
                  .filter((res) => res.reason !== 'EXCLUDED')
                  .map((resolution) => {
                    const patient = previewPatients.find((p) => String(p.id) === resolution.patientId);
                    if (!patient) return null;
                    const reasonBadge = getReasonBadge(resolution.reason);
                    
                    return (
                      <tr key={resolution.patientId} className="hover:bg-gray-50">
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-1">
                            <span className="font-medium text-gray-900">
                              {resolution.patientPosition}
                            </span>
                            <span className="text-xs text-gray-500 whitespace-nowrap">
                              ({resolution.offset > 0 ? '+' : ''}{resolution.offset})
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2">{resolution.patientName}</td>
                        <td className="px-4 py-2">{formatPhoneNumber(patient.phone || '', patient.countryCode || '+20')}</td>
                        <td className="px-4 py-2 text-gray-600 max-w-xs">{resolution.resolvedTemplate}</td>
                        <td className="px-4 py-2 text-center">
                          <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${reasonBadge.bg} ${reasonBadge.text}`}>
                            {reasonBadge.label}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-center">
                          <button
                            onClick={() => handleRemovePatient(resolution.patientId)}
                            className="inline-flex items-center gap-1 px-3 py-1 text-xs bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                            title="إزالة من المعاينة"
                          >
                            <i className="fas fa-trash"></i>
                            إزالة
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t flex-shrink-0">
          <button
            onClick={handleConfirmSend}
            disabled={missingDefaultTemplate || selectedCount - removedPatients.length === 0 || isSending}
            className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isSending ? (
              <>
                <i className="fas fa-spinner fa-spin"></i>
                جاري الإرسال...
              </>
            ) : (
              <>
                <i className="fab fa-whatsapp"></i>
                {missingDefaultTemplate ? 'مطلوب قالب افتراضي' : `تأكيد الإرسال (${selectedCount - removedPatients.length})`}
              </>
            )}
          </button>
          <button
            onClick={() => closeModal('messagePreview')}
            className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400 transition-colors"
          >
            إلغاء
          </button>
        </div>
      </div>
    </Modal>
  );
}
