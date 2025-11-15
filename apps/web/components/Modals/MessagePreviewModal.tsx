'use client';

import { useModal } from '@/contexts/ModalContext';
import { useUI } from '@/contexts/UIContext';
import { formatPositionDisplay } from '@/utils/queuePositionUtils';
import { resolvePatientMessages } from '@/services/queueMessageService';
import { QueueMessageConfig, MessageResolution } from '@/types/messageCondition';
import { Patient } from '@/types';
// Mock data removed - using API data instead
import { useState } from 'react';
import Modal from './Modal';

export default function MessagePreviewModal() {
  const { openModals, closeModal, getModalData } = useModal();
  const { addToast } = useUI();
  const data = getModalData('messagePreview');

  const isOpen = openModals.has('messagePreview');
  const selectedCount = data?.selectedPatientCount ?? 0;
  const selectedPatientIds = data?.selectedPatients ?? [];
  const currentCQP = data?.currentCQP ? parseInt(data.currentCQP) : undefined;

  // State for removed patients
  const [removedPatients, setRemovedPatients] = useState<string[]>([]);

  // Preview data with queue positions - use data from modal or empty array
  const previewPatients: Patient[] = data?.patients || [];

  // Sort patients by queue position (الترتيب) - ascending order
  const sortedPatients = [...previewPatients].sort((a, b) => {
    // Sort by queueId (treating as string GUID)
    const queueIdA = a.queueId || '';
    const queueIdB = b.queueId || '';
    return queueIdA.localeCompare(queueIdB);
  });

  // Real values for message variables
  const currentQueuePosition = currentCQP !== undefined ? parseInt(String(currentCQP)) : 3;  // CQP value
  const estimatedTimePerSession = data?.estimatedTimeRemaining || 15;  // ETS in minutes
  const queueName = data?.queueName || 'د. أحمد محمد';  // DN: doctor name

  // Build a QueueMessageConfig from data (for service resolution)
  // For now, default config with no conditions (defaults to simple message)
  const messageConfig: QueueMessageConfig = {
    queueId: data?.queueId || 'default',
    queueName,
    defaultTemplate: data?.messageTemplate || `مرحباً بك {PN}، ترتيبك الحالي هو {PQP}، الوقت المتبقي المقدر حتى دورك هو {ETR}. شكراً لانتظارك عند ${queueName}`,
    conditions: data?.conditions || [],
  };

  // Resolve all patients using the service
  const patientArray = sortedPatients
    .filter((p) => selectedPatientIds.includes(p.id) && !removedPatients.includes(String(p.id)))
    .map((p) => ({ id: String(p.id), name: p.name, position: p.position || 0 }));

  const resolutions = resolvePatientMessages(
    messageConfig,
    patientArray,
    currentQueuePosition,
    { estimatedTimePerSessionMinutes: estimatedTimePerSession }
  );

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
  
  // Helper function to format phone number
  const formatPhoneNumber = (phone: string, countryCode: string = '+20') => {
    return `${countryCode} ${phone}`;
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

  const handleConfirmSend = () => {
    addToast(`تم إرسال ${selectedCount} رسالة بنجاح`, 'success');
    closeModal('messagePreview');
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
                        <td className="px-4 py-2">{formatPhoneNumber(patient.phone, patient.countryCode)}</td>
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
            disabled={selectedCount - removedPatients.length === 0}
            className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            <i className="fab fa-whatsapp"></i>
            تأكيد الإرسال ({selectedCount - removedPatients.length})
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
