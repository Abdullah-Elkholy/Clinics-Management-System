'use client';

import { useModal } from '@/contexts/ModalContext';
import { useUI } from '@/contexts/UIContext';
import { useQueue } from '@/contexts/QueueContext';
import { formatPositionDisplay } from '@/utils/queuePositionUtils';
import { resolvePatientMessages } from '@/services/queueMessageService';
import { QueueMessageConfig, MessageResolution } from '@/types/messageCondition';
import { Patient } from '@/types';
import { messageApiClient } from '@/services/api/messageApiClient';
import { whatsappApiClient } from '@/services/api/whatsappApiClient';
// normalizePhoneNumber removed - phone numbers stored separately from country codes
import { useState, useMemo, useEffect, useCallback } from 'react';
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

  // WhatsApp validation state
  const [validationStatus, setValidationStatus] = useState<Record<string, {
    isValid: boolean | null; // null = checking/not checked, true = valid, false = invalid
    isChecking: boolean;
    error?: string;
    attempts: number;
  }>>({});
  const [isValidating, setIsValidating] = useState(false);
  const [validationProgress, setValidationProgress] = useState({ current: 0, total: 0 });

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
    // Filter conditions for this queue and populate template content from templates
    return messageConditions
      .filter(c => String(c.queueId) === String(queueId))
      .map(condition => {
        // If condition already has template content, use it
        if (condition.template) {
          return condition;
        }
        // Otherwise, look up template content from templateId
        if (condition.templateId) {
          const template = realTemplates.find(t => String(t.id) === String(condition.templateId));
          if (template) {
            return {
              ...condition,
              template: template.content,
            };
          }
        }
        // If no template found, return condition as-is (will show empty message)
        return condition;
      });
  }, [messageConditions, queueId, realTemplates]);

  // Get default template by finding condition with DEFAULT operator, then finding its template
  const defaultTemplate = useMemo(() => {
    // Find condition with DEFAULT operator
    const defaultCondition = realConditions.find(c => c.operator === 'DEFAULT');
    if (!defaultCondition || !defaultCondition.templateId) {
      return undefined;
    }
    // Find template by templateId from the condition
    return realTemplates.find(t => String(t.id) === String(defaultCondition.templateId));
  }, [realConditions, realTemplates]);

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
    const results = resolvePatientMessages(
      messageConfig,
      patientArray,
      currentQueuePosition,
      { estimatedTimePerSessionMinutes: estimatedTimePerSession }
    );
    
    // Debug logging (remove in production if needed)
    if (process.env.NODE_ENV === 'development') {
      console.log('[MessagePreview] Resolutions:', {
        config: {
          queueId: messageConfig.queueId,
          queueName: messageConfig.queueName,
          conditionsCount: messageConfig.conditions?.length || 0,
          defaultTemplate: messageConfig.defaultTemplate ? 'exists' : 'missing',
          conditions: messageConfig.conditions?.map(c => ({
            id: c.id,
            operator: c.operator,
            template: c.template ? `${c.template.substring(0, 50)}...` : 'EMPTY',
            templateId: c.templateId,
            enabled: c.enabled,
          })),
        },
        patients: patientArray.length,
        currentQueuePosition,
        results: results.map(r => ({
          patientId: r.patientId,
          reason: r.reason,
          hasTemplate: !!r.resolvedTemplate,
          templateLength: r.resolvedTemplate?.length || 0,
        })),
      });
    }
    
    return results;
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
    // Check if validation is still in progress
    if (isValidating) {
      addToast('يرجى الانتظار حتى اكتمال عملية التحقق من أرقام الواتساب', 'error');
      return;
    }

    // Get patients that will be sent (not excluded, not removed)
    const patientsToSend = resolutions
      .filter((res) => res.reason !== 'EXCLUDED' && !removedPatients.includes(String(res.patientId)))
      .map((res) => {
        const patient = previewPatients.find((p) => String(p.id) === res.patientId);
        return {
          patientId: res.patientId,
          patient,
        };
      })
      .filter((item) => item.patient !== undefined);

    if (patientsToSend.length === 0) {
      addToast('لا يوجد مرضى لإرسال الرسائل لهم', 'error');
      return;
    }

    // Check 1: Verify all patients have IsValidWhatsAppNumber === true
    const invalidWhatsAppPatients = patientsToSend.filter((item) => {
      const patient = item.patient;
      // Must have isValidWhatsAppNumber explicitly set to true
      return !patient || patient.isValidWhatsAppNumber !== true;
    });

    if (invalidWhatsAppPatients.length > 0) {
      const invalidNames = invalidWhatsAppPatients
        .map((item) => item.patient?.name || `ID: ${item.patientId}`)
        .join(', ');
      addToast(
        `لا يمكن إرسال الرسائل: بعض المرضى ليس لديهم أرقام واتساب صالحة (${invalidNames}). يرجى التحقق من صحة الأرقام أولاً.`,
        'error'
      );
      return;
    }

    // Check 2: Verify default template exists
    const templateToUse = defaultTemplateId ? Number(defaultTemplateId) : (defaultTemplate ? Number(defaultTemplate.id) : null);
    
    if (!templateToUse || isNaN(templateToUse)) {
      addToast('القالب الافتراضي غير محدد، برجاء إنشاء قالب وجعله افتراضياً أولاً', 'error');
      return;
    }

    // Extract patient IDs for API call
    const patientIdsToSend = patientsToSend
      .map((item) => Number(item.patientId))
      .filter((id) => !isNaN(id));

    setIsSending(true);
    try {
      await messageApiClient.sendMessages({
        templateId: templateToUse,
        patientIds: patientIdsToSend,
        channel: 'whatsapp',
      });

      addToast(`تم إرسال ${patientIdsToSend.length} رسالة بنجاح`, 'success');
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

  // Check a single phone number with retry logic (max 2 attempts)
  const checkPhoneNumber = useCallback(async (
    patientId: string,
    phoneNumber: string,
    attempt: number = 1
  ): Promise<boolean | null> => {
    const maxAttempts = 2;
    
    // Update status to checking
    setValidationStatus(prev => ({
      ...prev,
      [patientId]: {
        isValid: null,
        isChecking: true,
        attempts: attempt,
      }
    }));

    try {
      const result = await whatsappApiClient.checkWhatsAppNumber(phoneNumber);
      
      // Check if service is unavailable (connection refused, etc.)
      if (result.state === 'ServiceUnavailable') {
        setValidationStatus(prev => ({
          ...prev,
          [patientId]: {
            isValid: null,
            isChecking: false,
            error: 'خدمة التحقق من الواتساب غير متاحة. يمكنك المتابعة بدون التحقق.',
            attempts: attempt,
          }
        }));
        return null; // Don't retry if service is unavailable
      }
      
      // Check if result indicates success
      if (result.isSuccess === true) {
        setValidationStatus(prev => ({
          ...prev,
          [patientId]: {
            isValid: true,
            isChecking: false,
            attempts: attempt,
          }
        }));
        return true;
      } else if (result.isSuccess === false) {
        setValidationStatus(prev => ({
          ...prev,
          [patientId]: {
            isValid: false,
            isChecking: false,
            attempts: attempt,
          }
        }));
        return false;
      } else {
        // Pending or other states - treat as error for retry
        throw new Error(result.resultMessage || 'Unknown validation state');
      }
    } catch (error: any) {
      // Check if it's a connection error - don't retry
      const isConnectionError = 
        error?.message?.includes('ERR_CONNECTION_REFUSED') ||
        error?.message?.includes('Failed to fetch') ||
        error?.message?.includes('NetworkError') ||
        error?.message?.includes('connection refused');
      
      if (isConnectionError) {
        setValidationStatus(prev => ({
          ...prev,
          [patientId]: {
            isValid: null,
            isChecking: false,
            error: 'خدمة التحقق من الواتساب غير متاحة. يمكنك المتابعة بدون التحقق.',
            attempts: attempt,
          }
        }));
        return null; // Don't retry connection errors
      }
      
      // If we haven't reached max attempts, retry
      if (attempt < maxAttempts) {
        // Wait a bit before retry
        await new Promise(resolve => setTimeout(resolve, 1000));
        return checkPhoneNumber(patientId, phoneNumber, attempt + 1);
      } else {
        // Max attempts reached - show error with retry option
        setValidationStatus(prev => ({
          ...prev,
          [patientId]: {
            isValid: null,
            isChecking: false,
            error: error?.message || 'فشل التحقق من رقم الواتساب',
            attempts: attempt,
          }
        }));
        return null;
      }
    }
  }, []);

  // Validate all patients sequentially (1 at a time)
  const validateAllPatients = useCallback(async () => {
    if (!isOpen) return;

    // Get patients that need validation (not excluded, not removed)
    const patientsToValidate = sortedPatients.filter(p => 
      selectedPatientIds.includes(String(p.id)) && 
      !removedPatients.includes(String(p.id)) &&
      p.phone
    );

    if (patientsToValidate.length === 0) {
      setIsValidating(false);
      return;
    }

    setIsValidating(true);
    setValidationProgress({ current: 0, total: patientsToValidate.length });

    // Initialize validation status for all patients
    const initialStatus: Record<string, {
      isValid: boolean | null;
      isChecking: boolean;
      error?: string;
      attempts: number;
    }> = {};

    patientsToValidate.forEach(p => {
      const patientId = String(p.id);
      
      // If already validated (true/false), use that value, otherwise check
      if (p.isValidWhatsAppNumber === true) {
        initialStatus[patientId] = {
          isValid: true,
          isChecking: false,
          attempts: 0,
        };
      } else if (p.isValidWhatsAppNumber === false) {
        initialStatus[patientId] = {
          isValid: false,
          isChecking: false,
          attempts: 0,
        };
      } else {
        // Need to check - will be set during validation
        initialStatus[patientId] = {
          isValid: null,
          isChecking: false,
          attempts: 0,
        };
      }
    });

    setValidationStatus(initialStatus);

    // Check each patient sequentially (1 at a time)
    for (let i = 0; i < patientsToValidate.length; i++) {
      const patient = patientsToValidate[i];
      const patientId = String(patient.id);
      
      // Skip if already validated (true/false from database)
      if (patient.isValidWhatsAppNumber === true || patient.isValidWhatsAppNumber === false) {
        setValidationProgress({ current: i + 1, total: patientsToValidate.length });
        continue;
      }

      // Build full phone number with country code (E.164 format for WhatsApp API)
      const countryCode = patient.countryCode || '+20';
      // Combine country code and phone number: +20 1018542431 -> +201018542431
      const phoneNumber = `${countryCode}${patient.phone}`;

      await checkPhoneNumber(patientId, phoneNumber);
      setValidationProgress({ current: i + 1, total: patientsToValidate.length });
    }

    setIsValidating(false);
  }, [isOpen, sortedPatients, selectedPatientIds, removedPatients, checkPhoneNumber]);

  // Trigger validation when modal opens
  useEffect(() => {
    if (isOpen && sortedPatients.length > 0 && selectedPatientIds.length > 0) {
      // Reset validation status when modal opens
      setValidationStatus({});
      validateAllPatients();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]); // Only trigger on open/close, not on patient changes

  // Retry validation for a specific patient
  const handleRetryValidation = useCallback(async (patientId: string) => {
    const patient = sortedPatients.find(p => String(p.id) === patientId);
    if (!patient || !patient.phone) return;

    const countryCode = patient.countryCode || '+20';
    // Combine country code and phone number: +20 1018542431 -> +201018542431
    const phoneNumber = `${countryCode}${patient.phone}`;

    await checkPhoneNumber(patientId, phoneNumber, 1);
  }, [sortedPatients, checkPhoneNumber]);

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

          {/* WhatsApp Validation Progress */}
          {isValidating && (
            <div className="px-4 py-3 bg-blue-50 border-b border-blue-200 flex items-center gap-3">
              <i className="fas fa-spinner fa-spin text-blue-600"></i>
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-800">
                  جاري التحقق من أرقام الواتساب...
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  {validationProgress.current} / {validationProgress.total}
                </p>
              </div>
            </div>
          )}

          {/* Invalid WhatsApp Numbers Disclaimer */}
          {(() => {
            const invalidPatients = resolutions
              .filter((res) => res.reason !== 'EXCLUDED' && !removedPatients.includes(String(res.patientId)))
              .filter((res) => {
                const status = validationStatus[String(res.patientId)];
                return status && status.isValid === false;
              });

            if (invalidPatients.length > 0 && !isValidating) {
              return (
                <div className="px-4 py-3 bg-red-50 border-b border-red-200">
                  <div className="flex items-start gap-3 text-sm text-red-800 mb-2">
                    <i className="fas fa-exclamation-circle mt-1"></i>
                    <div className="flex-1">
                      <p className="font-medium">تحذير: بعض أرقام الهاتف غير صالحة للواتساب</p>
                      <p className="mt-1 text-xs">يرجى إصلاح الأرقام التالية أو إزالتها من المعاينة قبل الإرسال:</p>
                    </div>
                  </div>
                  <div className="mt-2 space-y-1">
                    {invalidPatients.map((res) => {
                      const patient = previewPatients.find((p) => String(p.id) === res.patientId);
                      if (!patient) return null;
                      return (
                        <div key={res.patientId} className="text-xs text-red-700 bg-red-100 px-2 py-1 rounded">
                          <span className="font-medium">{patient.name}</span> - {formatPhoneNumber(patient.phone || '', patient.countryCode || '+20')}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            }
            return null;
          })()}

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
                        <td className={`px-4 py-2 ${
                          (() => {
                            const status = validationStatus[String(resolution.patientId)];
                            if (status && status.isValid === false) {
                              return 'bg-red-100 text-red-800 font-medium';
                            }
                            return '';
                          })()
                        }`}>
                          <div className="flex items-center gap-2">
                            {formatPhoneNumber(patient.phone || '', patient.countryCode || '+20')}
                            {(() => {
                              const status = validationStatus[String(resolution.patientId)];
                              if (status?.isChecking) {
                                return <i className="fas fa-spinner fa-spin text-blue-500 text-xs"></i>;
                              }
                              if (status?.isValid === true) {
                                return <i className="fas fa-check-circle text-green-500 text-xs"></i>;
                              }
                              if (status?.isValid === false) {
                                return <i className="fas fa-times-circle text-red-500 text-xs"></i>;
                              }
                              if (status?.error) {
                                return (
                                  <div className="flex items-center gap-1">
                                    <i className="fas fa-exclamation-triangle text-orange-500 text-xs"></i>
                                    <button
                                      onClick={() => handleRetryValidation(String(resolution.patientId))}
                                      className="text-xs text-orange-600 hover:text-orange-800 underline"
                                      title="إعادة المحاولة"
                                    >
                                      إعادة المحاولة
                                    </button>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        </td>
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
            disabled={isSending || isValidating}
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
                {`تأكيد الإرسال (${selectedCount - removedPatients.length})`}
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
