/* eslint-disable no-console */
/* NOTE: This component has extensive debug logging for message preview functionality.
   Console statements are kept for debugging production issues. */
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
import { patientsApiClient } from '@/services/api/patientsApiClient';
// normalizePhoneNumber removed - phone numbers stored separately from country codes
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import Modal from './Modal';
import ConfirmationDialog from './ConfirmationDialog';

export default function MessagePreviewModal() {
  const { openModals, closeModal, getModalData } = useModal();
  const { addToast } = useUI();
  const { queues, messageTemplates, messageConditions, patients: contextPatients, refreshPatients } = useQueue();
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
  
  // Abort controller to actually cancel fetch requests
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Abort flag to cancel validation when modal closes
  const abortValidationRef = useRef(false);
  
  // Ref to track modal open state (for checking inside async functions)
  const isOpenRef = useRef(isOpen);
  
  // Confirmation dialog state
  const [showCloseConfirmation, setShowCloseConfirmation] = useState(false);
  
  // Update isOpenRef whenever isOpen changes
  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

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
    // Format as: +countryCode phoneNumber (with space)
    // Use Left-to-Right Mark (\u200E) to force LTR rendering in RTL contexts
    // This ensures the "+" sign appears on the left side of the country code
    return `\u200E${countryCode} ${cleaned}`;
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

    // Check ALL patients' IsValidWhatsAppNumber attribute from database
    // Separate into: valid (true), invalid (false), and unvalidated (null)
    const validPatients = patientsToSend.filter((item) => 
      item.patient?.isValidWhatsAppNumber === true
    );
    const invalidPatients = patientsToSend.filter((item) => 
      item.patient?.isValidWhatsAppNumber === false
    );
    const unvalidatedPatients = patientsToSend.filter((item) => 
      item.patient?.isValidWhatsAppNumber !== true && 
      item.patient?.isValidWhatsAppNumber !== false
    );

    // Reject if ANY patient is invalid (false) or unvalidated (null)
    if (invalidPatients.length > 0) {
      // Some patients have invalid WhatsApp numbers (false)
      const invalidNames = invalidPatients
        .map((item) => item.patient?.name || `ID: ${item.patientId}`)
        .slice(0, 5) // Show max 5 names
        .join(', ');
      const moreCount = invalidPatients.length > 5 ? ` و${invalidPatients.length - 5} آخرين` : '';
      addToast(
        `لا يمكن إرسال الرسائل: بعض المرضى لديهم أرقام هاتف غير صالحة للواتساب (${invalidNames}${moreCount}). يرجى إصلاح الأرقام أو إزالة هؤلاء المرضى من المعاينة.`,
        'error'
      );
      return;
    }

    if (unvalidatedPatients.length > 0) {
      // Some patients haven't been validated yet (null)
      const unvalidatedNames = unvalidatedPatients
        .map((item) => item.patient?.name || `ID: ${item.patientId}`)
        .slice(0, 5) // Show max 5 names
        .join(', ');
      const moreCount = unvalidatedPatients.length > 5 ? ` و${unvalidatedPatients.length - 5} آخرين` : '';
      addToast(
        `لا يمكن إرسال الرسائل: بعض المرضى لم يتم التحقق من أرقام الواتساب الخاصة بهم بعد (${unvalidatedNames}${moreCount}). يرجى الانتظار حتى اكتمال عملية التحقق أو إعادة المحاولة للتحقق من الأرقام.`,
        'error'
      );
      return;
    }

    // All patients must have IsValidWhatsAppNumber === true to proceed
    if (validPatients.length !== patientsToSend.length) {
      addToast('لا يمكن إرسال الرسائل: يجب التحقق من جميع أرقام الواتساب أولاً', 'error');
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
    
    // Check if modal is still open and validation was aborted
    if (!isOpenRef.current || abortValidationRef.current || abortControllerRef.current?.signal.aborted) {
      setValidationStatus(prev => ({
        ...prev,
        [patientId]: {
          isValid: null,
          isChecking: false,
          error: 'تم إلغاء عملية التحقق',
          attempts: attempt,
        }
      }));
      return null;
    }
    
    // CRITICAL: FIRST check database IsValidWhatsAppNumber attribute BEFORE calling API
    // Look up patient from sortedPatients to get latest database value
    const patient = sortedPatients.find(p => String(p.id) === patientId);
    
    if (patient) {
      // Check database value FIRST - if it exists, use it directly (NO API CALL)
      const dbValue = patient.isValidWhatsAppNumber;
      
      // Debug logging (remove in production if needed)
      if (process.env.NODE_ENV === 'development') {
        console.log(`[MessagePreview] checkPhoneNumber for ${patientId} (${patient.name}): isValidWhatsAppNumber =`, dbValue, typeof dbValue);
      }
      
      if (dbValue === true) {
        // Database says valid - use it directly, NO API call
        if (process.env.NODE_ENV === 'development') {
          console.log(`[MessagePreview] checkPhoneNumber: Patient ${patientId} has TRUE in DB, skipping API call`);
        }
        setValidationStatus(prev => ({
          ...prev,
          [patientId]: {
            isValid: true,
            isChecking: false,
            attempts: attempt,
          }
        }));
        return true;
      } else if (dbValue === false) {
        // Database says invalid - use it directly, NO API call
        if (process.env.NODE_ENV === 'development') {
          console.log(`[MessagePreview] checkPhoneNumber: Patient ${patientId} has FALSE in DB, skipping API call`);
        }
        setValidationStatus(prev => ({
          ...prev,
          [patientId]: {
            isValid: false,
            isChecking: false,
            attempts: attempt,
          }
        }));
        return false;
      }
      // If database value is null/undefined, continue to API call below
      if (process.env.NODE_ENV === 'development') {
        console.log(`[MessagePreview] checkPhoneNumber: Patient ${patientId} has ${dbValue} (${typeof dbValue}) in DB, will call API`);
      }
    } else {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[MessagePreview] checkPhoneNumber: Patient ${patientId} not found in sortedPatients, will call API`);
      }
    }
    
    // Check if modal is still open and abort flag again before API call
    if (!isOpenRef.current || abortValidationRef.current || abortControllerRef.current?.signal.aborted) {
      setValidationStatus(prev => ({
        ...prev,
        [patientId]: {
          isValid: null,
          isChecking: false,
          error: 'تم إلغاء عملية التحقق',
          attempts: attempt,
        }
      }));
      return null;
    }
    
    // Only call API if database value is null/undefined
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
      // Check if modal is still open and abort flag before making API call
      if (!isOpenRef.current || abortValidationRef.current || abortControllerRef.current?.signal.aborted) {
        setValidationStatus(prev => ({
          ...prev,
          [patientId]: {
            isValid: null,
            isChecking: false,
            error: 'تم إلغاء عملية التحقق',
            attempts: attempt,
          }
        }));
        return null;
      }
      
      // Pass abort signal to actually cancel the fetch request
      const result = await whatsappApiClient.checkWhatsAppNumber(
        phoneNumber,
        abortControllerRef.current?.signal
      );
      
      // Check if modal is still open and abort flag after API call
      if (!isOpenRef.current || abortValidationRef.current || abortControllerRef.current?.signal.aborted || result.state === 'Aborted') {
        setValidationStatus(prev => ({
          ...prev,
          [patientId]: {
            isValid: null,
            isChecking: false,
            error: 'تم إلغاء عملية التحقق',
            attempts: attempt,
          }
        }));
        return null;
      }
      
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
        
        // Update database with validation result
        try {
          const patientIdNum = Number(patientId);
          if (!isNaN(patientIdNum)) {
            await patientsApiClient.updatePatient(patientIdNum, {
              isValidWhatsAppNumber: true,
            });
          }
        } catch (dbError) {
          // Log error but don't block UI - validation succeeded, just DB update failed
          console.error(`Failed to update database for patient ${patientId}:`, dbError);
        }
        
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
        
        // Update database with validation result
        try {
          const patientIdNum = Number(patientId);
          if (!isNaN(patientIdNum)) {
            await patientsApiClient.updatePatient(patientIdNum, {
              isValidWhatsAppNumber: false,
            });
          }
        } catch (dbError) {
          // Log error but don't block UI - validation succeeded, just DB update failed
          console.error(`Failed to update database for patient ${patientId}:`, dbError);
        }
        
        return false;
      } else {
        // Pending or other states - treat as error for retry
        throw new Error(result.resultMessage || 'Unknown validation state');
      }
    } catch (error: any) {
      // Check if modal is still open and error is due to abort
      if (!isOpenRef.current || error?.name === 'AbortError' || abortValidationRef.current || abortControllerRef.current?.signal.aborted) {
        setValidationStatus(prev => ({
          ...prev,
          [patientId]: {
            isValid: null,
            isChecking: false,
            error: 'تم إلغاء عملية التحقق',
            attempts: attempt,
          }
        }));
        return null; // Don't retry if aborted or modal closed
      }
      
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
      
      // Check if modal is still open and abort flag before retry
      if (!isOpenRef.current || abortValidationRef.current || abortControllerRef.current?.signal.aborted) {
        setValidationStatus(prev => ({
          ...prev,
          [patientId]: {
            isValid: null,
            isChecking: false,
            error: 'تم إلغاء عملية التحقق',
            attempts: attempt,
          }
        }));
        return null;
      }
      
      // If we haven't reached max attempts, retry
      if (attempt < maxAttempts) {
        // Wait a bit before retry, but check abort and modal state during wait
        await new Promise(resolve => {
          const timeout = setTimeout(resolve, 1000);
          // Check abort and modal state every 100ms during wait
          const checkAbort = setInterval(() => {
            if (!isOpenRef.current || abortValidationRef.current || abortControllerRef.current?.signal.aborted) {
              clearTimeout(timeout);
              clearInterval(checkAbort);
              resolve(undefined);
            }
          }, 100);
          setTimeout(() => clearInterval(checkAbort), 1000);
        });
        
        // Check if modal is still open and abort flag again after wait
        if (!isOpenRef.current || abortValidationRef.current || abortControllerRef.current?.signal.aborted) {
          setValidationStatus(prev => ({
            ...prev,
            [patientId]: {
              isValid: null,
              isChecking: false,
              error: 'تم إلغاء عملية التحقق',
              attempts: attempt,
            }
          }));
          return null;
        }
        
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
  }, [sortedPatients]);

  // Validate all patients sequentially (1 at a time)
  const validateAllPatients = useCallback(async () => {
    // Check if modal is still open using ref (for current value)
    if (!isOpenRef.current) return;
    
    // Create new AbortController for this validation session
    abortControllerRef.current = new AbortController();
    
    // Reset abort flag when starting new validation
    abortValidationRef.current = false;

    // Get all eligible patients (not excluded, not removed, have phone)
    const allEligiblePatients = sortedPatients.filter(p => 
      selectedPatientIds.includes(String(p.id)) && 
      !removedPatients.includes(String(p.id)) &&
      p.phone
    );

    if (allEligiblePatients.length === 0) {
      setIsValidating(false);
      return;
    }

    // Debug: Log all patients and their isValidWhatsAppNumber values
    if (process.env.NODE_ENV === 'development') {
      console.log(`[MessagePreview] validateAllPatients: Checking ${allEligiblePatients.length} patients`);
      console.log(`[MessagePreview] Sample patient data:`, allEligiblePatients.slice(0, 3).map(p => ({
        id: p.id,
        name: p.name,
        isValidWhatsAppNumber: p.isValidWhatsAppNumber,
        hasField: 'isValidWhatsAppNumber' in p,
      })));
    }

    // Initialize validation status for ALL patients
    // FIRST: Check IsValidWhatsAppNumber from database (Patient entity)
    // Only call check-whatsapp endpoint if value is null/undefined
    const initialStatus: Record<string, {
      isValid: boolean | null;
      isChecking: boolean;
      error?: string;
      attempts: number;
    }> = {};

    // Separate patients: those with database values vs those needing API validation
    const patientsNeedingApiValidation: typeof allEligiblePatients = [];

    allEligiblePatients.forEach(p => {
      const patientId = String(p.id);
      
      // CRITICAL: Check database IsValidWhatsAppNumber attribute FIRST
      // Explicitly check for true, false, null, and undefined
      // If it's true or false, use that value directly (no API call needed)
      const dbValue = p.isValidWhatsAppNumber;
      
      // Debug logging (remove in production if needed)
      if (process.env.NODE_ENV === 'development') {
        console.log(`[MessagePreview] Patient ${patientId} (${p.name}): isValidWhatsAppNumber =`, dbValue, typeof dbValue);
      }
      
      if (dbValue === true) {
        // Database says valid - use it directly, no API call
        if (process.env.NODE_ENV === 'development') {
          console.log(`[MessagePreview] Patient ${patientId}: Using database value TRUE, skipping API call`);
        }
        initialStatus[patientId] = {
          isValid: true,
          isChecking: false,
          attempts: 0,
        };
      } else if (dbValue === false) {
        // Database says invalid - use it directly, no API call
        if (process.env.NODE_ENV === 'development') {
          console.log(`[MessagePreview] Patient ${patientId}: Using database value FALSE, skipping API call`);
        }
        initialStatus[patientId] = {
          isValid: false,
          isChecking: false,
          attempts: 0,
        };
      } else {
        // Database value is null/undefined - need to call check-whatsapp endpoint
        if (process.env.NODE_ENV === 'development') {
          console.log(`[MessagePreview] Patient ${patientId}: Database value is ${dbValue} (${typeof dbValue}), will call API`);
        }
        initialStatus[patientId] = {
          isValid: null,
          isChecking: false,
          attempts: 0,
        };
        patientsNeedingApiValidation.push(p);
      }
    });

    setValidationStatus(initialStatus);

    // If no patients need API validation (all have database values), we're done
    if (patientsNeedingApiValidation.length === 0) {
      setIsValidating(false);
      return;
    }

    setIsValidating(true);
    // Progress counter only includes patients that actually need API validation
    setValidationProgress({ current: 0, total: patientsNeedingApiValidation.length });

    // Only call check-whatsapp endpoint for patients where database value is null
    for (let i = 0; i < patientsNeedingApiValidation.length; i++) {
      // Check if modal is still open and abort flags at start of each iteration
      if (!isOpenRef.current || abortValidationRef.current || abortControllerRef.current?.signal.aborted) {
        setIsValidating(false);
        return;
      }
      
      const patientFromArray = patientsNeedingApiValidation[i];
      const patientId = String(patientFromArray.id);

      // CRITICAL: Fresh lookup from sortedPatients to get latest database value
      // Don't rely on patientFromArray which might have stale data
      const freshPatient = sortedPatients.find(p => String(p.id) === patientId);

      // Double-check: only validate if database value is still null
      // (in case it was updated by another process or between iterations)
      if (freshPatient && (freshPatient.isValidWhatsAppNumber === true || freshPatient.isValidWhatsAppNumber === false)) {
        // Check if modal is still open before updating state
        if (!isOpenRef.current || abortValidationRef.current || abortControllerRef.current?.signal.aborted) {
          setIsValidating(false);
          return;
        }
        // Database value exists now - use it instead of API call
        setValidationStatus(prev => ({
          ...prev,
          [patientId]: {
            isValid: freshPatient.isValidWhatsAppNumber === true,
            isChecking: false,
            attempts: 0,
          }
        }));
        setValidationProgress({ current: i + 1, total: patientsNeedingApiValidation.length });
        continue;
      }

      // Check if modal is still open and abort flags before API call
      if (!isOpenRef.current || abortValidationRef.current || abortControllerRef.current?.signal.aborted) {
        setIsValidating(false);
        return;
      }

      // Build full phone number with country code (E.164 format for WhatsApp API)
      // Use freshPatient if available, otherwise fallback to patientFromArray
      const patientToUse = freshPatient || patientFromArray;
      const countryCode = patientToUse.countryCode || '+20';
      // Combine country code and phone number: +20 1018542431 -> +201018542431
      const phoneNumber = `${countryCode}${patientToUse.phone}`;

      // checkPhoneNumber will also check database value before calling API
      // It uses abortControllerRef.current?.signal internally
      await checkPhoneNumber(patientId, phoneNumber, 1);
      
      // Check if modal is still open and abort flags after API call
      if (!isOpenRef.current || abortValidationRef.current || abortControllerRef.current?.signal.aborted) {
        setIsValidating(false);
        return;
      }
      
      setValidationProgress({ current: i + 1, total: patientsNeedingApiValidation.length });
    }

    setIsValidating(false);
  }, [isOpen, sortedPatients, selectedPatientIds, removedPatients, checkPhoneNumber]);

  // Refresh patient data and trigger validation when modal opens
  useEffect(() => {
    if (isOpen && queueId && selectedPatientIds.length > 0) {
      // Refresh patients from database to get latest IsValidWhatsAppNumber values
      refreshPatients(queueId).then(() => {
        // After refresh, wait a bit for state to update, then validate
        // Use a longer timeout to ensure React state has updated
        setTimeout(() => {
          // Reset validation status when modal opens
          setValidationStatus({});
          // Call validateAllPatients - it will use the fresh sortedPatients
          validateAllPatients();
        }, 200);
      }).catch((error) => {
        console.error('Failed to refresh patients:', error);
        // Still try to validate with existing data
        setValidationStatus({});
        validateAllPatients();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, queueId, selectedPatientIds.length]); // Trigger on open/close and when patient selection changes

  // Retry validation for a specific patient (always re-validates, even if value exists)
  const handleRetryValidation = useCallback(async (patientId: string) => {
    // First, refresh patient data to get latest from database
    if (queueId) {
      try {
        await refreshPatients(queueId);
        // Wait a bit for state to update
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error('Failed to refresh patient data:', error);
      }
    }

    // Get fresh patient data after refresh
    const patient = sortedPatients.find(p => String(p.id) === patientId);
    if (!patient || !patient.phone) {
      // If still not found, try to get from contextPatients
      const contextPatient = contextPatients.find(p => String(p.id) === patientId);
      if (!contextPatient || !contextPatient.phone) {
        addToast('لم يتم العثور على بيانات المريض', 'error');
        return;
      }
    }

    const patientToUse = patient || contextPatients.find(p => String(p.id) === patientId);
    if (!patientToUse || !patientToUse.phone) return;

    // ALWAYS re-validate by calling API, regardless of existing database value
    // Create new AbortController if one doesn't exist
    if (!abortControllerRef.current) {
      abortControllerRef.current = new AbortController();
    }
    
    const countryCode = patientToUse.countryCode || '+20';
    // Combine country code and phone number: +20 1018542431 -> +201018542431
    const phoneNumber = `${countryCode}${patientToUse.phone}`;

    // Reset validation status before retry
    setValidationStatus(prev => ({
      ...prev,
      [patientId]: {
        isValid: null,
        isChecking: true,
        attempts: 0,
      }
    }));

    // ALWAYS re-validate by calling API directly (bypassing database check)
    // This ensures we get fresh validation even if database has a value
    try {
      const result = await whatsappApiClient.checkWhatsAppNumber(
        phoneNumber,
        abortControllerRef.current?.signal
      );

      if (result.isSuccess === true) {
        setValidationStatus(prev => ({
          ...prev,
          [patientId]: {
            isValid: true,
            isChecking: false,
            attempts: 0,
          }
        }));
        
        // Update database
        try {
          const patientIdNum = Number(patientId);
          if (!isNaN(patientIdNum)) {
            await patientsApiClient.updatePatient(patientIdNum, {
              isValidWhatsAppNumber: true,
            });
            // Refresh patients to get updated value
            if (queueId) {
              await refreshPatients(queueId);
            }
          }
        } catch (dbError) {
          console.error(`Failed to update database for patient ${patientId}:`, dbError);
        }
      } else if (result.isSuccess === false) {
        setValidationStatus(prev => ({
          ...prev,
          [patientId]: {
            isValid: false,
            isChecking: false,
            attempts: 0,
          }
        }));
        
        // Update database
        try {
          const patientIdNum = Number(patientId);
          if (!isNaN(patientIdNum)) {
            await patientsApiClient.updatePatient(patientIdNum, {
              isValidWhatsAppNumber: false,
            });
            // Refresh patients to get updated value
            if (queueId) {
              await refreshPatients(queueId);
            }
          }
        } catch (dbError) {
          console.error(`Failed to update database for patient ${patientId}:`, dbError);
        }
      } else {
        setValidationStatus(prev => ({
          ...prev,
          [patientId]: {
            isValid: null,
            isChecking: false,
            error: result.resultMessage || 'فشل التحقق من رقم الواتساب',
            attempts: 0,
          }
        }));
      }
    } catch (error: any) {
      if (error?.name === 'AbortError' || abortControllerRef.current?.signal.aborted) {
        setValidationStatus(prev => ({
          ...prev,
          [patientId]: {
            isValid: null,
            isChecking: false,
            error: 'تم إلغاء عملية التحقق',
            attempts: 0,
          }
        }));
        return;
      }
      
      setValidationStatus(prev => ({
        ...prev,
        [patientId]: {
          isValid: null,
          isChecking: false,
          error: error?.message || 'فشل التحقق من رقم الواتساب',
          attempts: 0,
        }
      }));
    }
  }, [sortedPatients, contextPatients, checkPhoneNumber, queueId, refreshPatients, addToast]);

  // Handle modal close with confirmation if validating
  const handleCloseModal = () => {
    if (isValidating) {
      // Show confirmation dialog
      setShowCloseConfirmation(true);
    } else {
      // Close immediately if not validating
      closeModal('messagePreview');
    }
  };

  // Handle confirmation to abort validation
  const handleConfirmAbort = () => {
    // Set abort flag
    abortValidationRef.current = true;
    
    // Actually abort all ongoing fetch requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    setIsValidating(false);
    setShowCloseConfirmation(false);
    closeModal('messagePreview');
    addToast('تم إلغاء عملية التحقق من أرقام الواتساب', 'info');
  };

  // Handle cancel - continue validation
  const handleCancelAbort = () => {
    setShowCloseConfirmation(false);
  };

  // Reset all state and abort processes when modal closes
  useEffect(() => {
    if (!isOpen) {
      // Abort any ongoing requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      
      // Reset all state variables
      abortValidationRef.current = false;
      setIsValidating(false);
      setShowCloseConfirmation(false);
      setValidationStatus({});
      setValidationProgress({ current: 0, total: 0 });
      setRemovedPatients([]);
      setIsSending(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleCloseModal}
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
                            <span>{formatPhoneNumber(patient.phone || '', patient.countryCode || '+20')}</span>
                            <div className="flex items-center gap-1">
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
                                  return <i className="fas fa-exclamation-triangle text-orange-500 text-xs"></i>;
                                }
                                return null;
                              })()}
                              {/* Always show retry button */}
                              <button
                                onClick={() => handleRetryValidation(String(resolution.patientId))}
                                disabled={(() => {
                                  const status = validationStatus[String(resolution.patientId)];
                                  return status?.isChecking === true;
                                })()}
                                className="text-xs text-blue-600 hover:text-blue-800 underline disabled:opacity-50 disabled:cursor-not-allowed"
                                title="إعادة التحقق من رقم الواتساب"
                              >
                                <i className="fas fa-redo text-xs"></i>
                              </button>
                            </div>
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
            onClick={handleCloseModal}
            className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400 transition-colors"
          >
            إلغاء
          </button>
        </div>
      </div>
    </Modal>
    
    {/* Confirmation Dialog for Aborting Validation */}
    <ConfirmationDialog
      isOpen={showCloseConfirmation}
      title="إلغاء عملية التحقق"
      message="جاري التحقق من أرقام الواتساب حالياً. هل تريد إلغاء العملية وإغلاق النافذة؟"
      confirmText="نعم، إلغاء وإغلاق"
      cancelText="لا، متابعة التحقق"
      isDangerous={true}
      onConfirm={handleConfirmAbort}
      onCancel={handleCancelAbort}
    />
    </>
  );
}
