/* eslint-disable no-console */
/* NOTE: This component has extensive debug logging for message preview functionality.
   Console statements are kept for debugging production issues. */
'use client';

import { useModal } from '@/contexts/ModalContext';
import { useUI } from '@/contexts/UIContext';
import { useQueue } from '@/contexts/QueueContext';
import { useAuth } from '@/contexts/AuthContext';
import { formatPositionDisplay } from '@/utils/queuePositionUtils';
import { resolvePatientMessages } from '@/services/queueMessageService';
import { QueueMessageConfig, MessageResolution } from '@/types/messageCondition';
import { Patient } from '@/types';
import { messageApiClient } from '@/services/api/messageApiClient';
import { whatsappApiClient } from '@/services/api/whatsappApiClient';
import { useWhatsAppSession } from '@/contexts/WhatsAppSessionContext';
import { patientsApiClient } from '@/services/api/patientsApiClient';
// normalizePhoneNumber removed - phone numbers stored separately from country codes
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import Modal from './Modal';
import ConfirmationDialog from './ConfirmationDialog';

export default function MessagePreviewModal() {
  const { openModals, closeModal, getModalData } = useModal();
  const { addToast, incrementBadge } = useUI();
  const { queues, messageTemplates, messageConditions, patients: contextPatients, refreshPatients, selectedQueueId } = useQueue();
  const { user } = useAuth();
  const { sessionData } = useWhatsAppSession();
  const moderatorUserId = sessionData?.moderatorUserId;
  const userId = user?.id ? parseInt(user.id, 10) : undefined;
  const data = getModalData('messagePreview');

  const isOpen = openModals.has('messagePreview');
  const selectedCount = data?.selectedPatientCount ?? 0;
  const selectedPatientIds = data?.selectedPatients ?? [];
  const currentCQP = data?.currentCQP ? parseInt(data.currentCQP) : undefined;
  // Use selectedQueueId as fallback when queueId is 'default' or missing
  const queueId = data?.queueId && data.queueId !== 'default' ? data.queueId : (selectedQueueId || data?.queueId);
  const defaultTemplateId = data?.defaultTemplateId; // Template ID from queue data

  // State for removed patients
  const [removedPatients, setRemovedPatients] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);

  // WhatsApp validation state
  const [validationStatus, setValidationStatus] = useState<Record<string, {
    isValid: boolean | null; // null = checking/not checked, true = valid, false = invalid
    isChecking: boolean;
    isQueued?: boolean; // true = waiting in queue to be checked (batch)
    isManualCheck?: boolean; // true = this is a manual retry check (purple vs blue)
    error?: string;
    attempts: number;
  }>>({});
  const [isValidating, setIsValidating] = useState(false);
  const [validationProgress, setValidationProgress] = useState({ current: 0, total: 0 });
  const [validationPaused, setValidationPaused] = useState(false);
  const [shouldResumeValidation, setShouldResumeValidation] = useState(false);

  // Queue for manual validation requests (processed after batch validation completes)
  const manualValidationQueueRef = useRef<string[]>([]);
  // Ref to store processManualValidationQueue function (avoids circular dependency)
  const processManualValidationQueueRef = useRef<(() => Promise<void>) | null>(null);

  // Track check session IDs for server-side cancellation
  const activeCheckSessionsRef = useRef<Set<string>>(new Set());

  // Abort controller for batch validation (validateAllPatients)
  const abortControllerRef = useRef<AbortController | null>(null);

  // Per-patient abort controllers for manual retry validations (prevents concurrent overwrites)
  const patientAbortControllersRef = useRef<Map<string, AbortController>>(new Map());

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

  // Helper function to generate user-friendly error messages with actionable guidance
  const getValidationErrorMessage = (status: typeof validationStatus[string] | undefined): string => {
    if (!status || !status.error) return '';

    const error = status.error;

    // Extension-specific errors (NEW)
    if (error.includes('ConcurrentCheck') || error.includes('عملية تحقق أخرى')) {
      return 'عملية تحقق أخرى قيد التنفيذ. يرجى الانتظار حتى تنتهي.';
    }

    if (error.includes('NotConnected') || error.includes('ليس متصلاً') || error.includes('extension')) {
      return 'الإضافة غير متصلة. يرجى:\n• التأكد من تثبيت إضافة المتصفح\n• التحقق من اتصال الإضافة\n• إعادة تحميل الصفحة';
    }

    if (error.includes('PendingQR') || error.includes('QR')) {
      return 'يلزم مسح رمز QR للواتساب. انتقل إلى:\nإدارة الواتساب ← مسح رمز QR';
    }

    // Service unavailable
    if (error.includes('غير متاحة') || error.includes('ServiceUnavailable')) {
      return 'خدمة الواتساب غير متاحة حالياً. تحقق من:\n• اتصال الإنترنت\n• حالة خادم الواتساب\n• يمكنك المتابعة بدون التحقق';
    }

    // Cancelled
    if (error.includes('إلغاء')) {
      return 'تم إلغاء عملية التحقق. اضغط على زر إعادة المحاولة للتحقق مرة أخرى.';
    }

    // Connection errors
    if (error.includes('connection') || error.includes('اتصال') || error.includes('شبكة')) {
      return 'فشل الاتصال بخادم الواتساب. تحقق من:\n• اتصال الإنترنت\n• إعدادات الشبكة\n• جدار الحماية';
    }

    // Authentication required
    if (error.includes('authentication') || error.includes('مصادقة')) {
      return 'يلزم المصادقة على جلسة الواتساب. انتقل إلى:\nالإعدادات ← إدارة الواتساب ← المصادقة';
    }

    // Timeout errors
    if (error.includes('timeout') || error.includes('Timeout') || error.includes('انتهت المهلة')) {
      return 'انتهت مهلة الطلب. جرّب:\n• إعادة المحاولة\n• التحقق من سرعة الإنترنت';
    }

    // Session lock timeout
    if (error.includes('lock') || error.includes('قفل')) {
      return 'جلسة الواتساب مشغولة حالياً. انتظر قليلاً ثم أعد المحاولة.';
    }

    // Default error
    return error;
  };

  // Get queue data from context as fallback
  const queue = useMemo(() => {
    if (!queueId) return null;
    return queues.find(q => String(q.id) === String(queueId));
  }, [queues, queueId]);

  // Get real templates and conditions from context
  const realTemplates = useMemo(() => {
    if (!queueId) {
      // No queueId means no queue selected - this is expected, not an error
      return [];
    }
    // Filter out deleted templates
    const filtered = messageTemplates.filter(t =>
      String(t.queueId) === String(queueId) &&
      !t.isDeleted // Exclude deleted templates
    );
    return filtered;
  }, [messageTemplates, queueId]);

  const realConditions = useMemo(() => {
    if (!queueId) {
      // No queueId means no queue selected - this is expected, not an error
      return [];
    }
    // Filter conditions for this queue and populate template content from templates
    // CRITICAL: Always populate template content from MessageTemplates to ensure correct template is shown
    // This ensures the "الرسالة" column shows the actual MessageTemplate content based on condition matching
    // Filter out deleted conditions
    const filtered = messageConditions.filter(c =>
      String(c.queueId) === String(queueId) &&
      !c.isDeleted // Exclude deleted conditions
    );



    return filtered.map(condition => {
      // Priority 1: Look up template content from templateId (most reliable)
      if (condition.templateId) {
        const template = realTemplates.find(t => String(t.id) === String(condition.templateId));
        if (template && template.content && template.content.trim().length > 0) {
          return {
            ...condition,
            template: template.content, // Use actual template content from MessageTemplate
          };
        }
      }

      // Priority 2: If condition already has template content, use it (fallback from QueueContext)
      if (condition.template && condition.template.trim().length > 0) {
        return condition;
      }

      // Priority 3: If no template found, return condition with empty template
      return condition;
    });
  }, [messageConditions, queueId, realTemplates]);

  // Get default template by finding condition with DEFAULT operator, then finding its template
  const defaultTemplate = useMemo(() => {
    // Find condition with DEFAULT operator
    const defaultCondition = realConditions.find(c => c.operator === 'DEFAULT');
    if (!defaultCondition) {
      // No default condition is expected for unconfigured queues - not an error
      return undefined;
    }

    // Find template by templateId from the condition
    if (defaultCondition.templateId) {
      const template = realTemplates.find(t => String(t.id) === String(defaultCondition.templateId));
      if (template) {
        return template;
      }
    }

    // Fallback: If DEFAULT condition has template content but no templateId, create a synthetic template
    if (defaultCondition.template && defaultCondition.template.trim().length > 0) {
      return {
        id: `default-${defaultCondition.id}`,
        title: 'القالب الافتراضي',
        content: defaultCondition.template,
        queueId: queueId || '',
        variables: [],
      };
    }

    return undefined;
  }, [realConditions, realTemplates, queueId]);

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
  const messageConfig: QueueMessageConfig = useMemo(() => {
    // CRITICAL: Verify all conditions have template content before building config
    const validatedConditions = realConditions.map(cond => {
      if (!cond.template || cond.template.trim().length === 0) {
        // Last attempt: try to find template if templateId exists
        if (cond.templateId && realTemplates.length > 0) {
          const template = realTemplates.find(t => String(t.id) === String(cond.templateId));
          if (template && template.content && template.content.trim().length > 0) {
            if (process.env.NODE_ENV === 'development') {
              console.log('[MessagePreview] Found template in messageConfig validation:', {
                conditionId: cond.id,
                templateId: cond.templateId,
                templateTitle: template.title,
              });
            }
            return {
              ...cond,
              template: template.content,
            };
          }
        }
        // Log error if still no template found
        if (process.env.NODE_ENV === 'development') {
          console.error('[MessagePreview] Condition still has no template in messageConfig:', {
            conditionId: cond.id,
            templateId: cond.templateId,
            operator: cond.operator,
            hasTemplateId: !!cond.templateId,
            templateContent: cond.template,
            availableTemplates: realTemplates.map(t => ({ id: t.id, title: t.title })),
          });
        }
      }
      return cond;
    });

    return {
      queueId: queueId || 'default',
      queueName,
      // Only include a default template if one truly exists
      defaultTemplate: defaultTemplate?.content,
      conditions: validatedConditions,
    };
  }, [queueId, queueName, defaultTemplate, realConditions, realTemplates]);

  const missingDefaultTemplate = !defaultTemplate;

  // Resolve all patients using the service
  const patientArray = useMemo(() => {
    return sortedPatients
      .filter((p) => selectedPatientIds.includes(String(p.id)) && !removedPatients.includes(String(p.id)))
      .map((p) => ({ id: String(p.id), name: p.name, position: p.position || 0 }));
  }, [sortedPatients, selectedPatientIds, removedPatients]);

  const resolutions = useMemo(() => {
    // No conditions is expected when queue hasn't been configured yet - not an error
    // Only log if we have conditions but they're misconfigured (later in this function)

    // Calculate offset (CalculatedPosition) for each patient: position - CQP
    // This is what conditions are matched against
    const results = resolvePatientMessages(
      messageConfig,
      patientArray,
      currentQueuePosition,
      { estimatedTimePerSessionMinutes: estimatedTimePerSession }
    );

    // Only log diagnostics if there are actual issues (reduced console spam)
    if (results.length > 0) {
      // Check for conditions with empty templates - this is the real issue
      const conditionsWithEmptyTemplates = messageConfig.conditions?.filter(c => !c.template || c.template.trim().length === 0) || [];
      if (conditionsWithEmptyTemplates.length > 0) {
        console.warn('[MessagePreview] Conditions with empty templates:', conditionsWithEmptyTemplates.map(c => ({
          id: c.id,
          operator: c.operator,
          templateId: c.templateId,
          hasTemplateId: !!c.templateId,
        })));
      }
    }

    return results;
  }, [messageConfig, patientArray, currentQueuePosition, estimatedTimePerSession]);

  // Calculate actual preview patient count (patients in the preview table, excluding EXCLUDED)
  const previewPatientCount = useMemo(() => {
    if (!resolutions || !Array.isArray(resolutions)) return 0;
    return resolutions.filter((res) => res.reason !== 'EXCLUDED' && !removedPatients.includes(String(res.patientId))).length;
  }, [resolutions, removedPatients]);

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
    // Check if validation is still in progress or already sending
    if (isValidating || isSending) {
      if (isValidating) {
        addToast('يرجى الانتظار حتى اكتمال عملية التحقق من أرقام الواتساب', 'error');
      }
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

    // Check ALL patients' IsValidWhatsAppNumber attribute
    // CRITICAL: Use validationStatus (which has fresh data) instead of previewPatients (which may be stale)
    // validationStatus is updated immediately after successful validation
    // Separate into: valid (true), invalid (false), and unvalidated (null)
    const validPatients = patientsToSend.filter((item) => {
      const patientId = String(item.patientId);
      const status = validationStatus[patientId];
      // Check validationStatus first (fresh data), then fallback to patient data
      if (status) {
        return status.isValid === true;
      }
      // Fallback to patient data if no validation status exists
      return item.patient?.isValidWhatsAppNumber === true;
    });
    const invalidPatients = patientsToSend.filter((item) => {
      const patientId = String(item.patientId);
      const status = validationStatus[patientId];
      // Check validationStatus first (fresh data), then fallback to patient data
      if (status) {
        return status.isValid === false;
      }
      // Fallback to patient data if no validation status exists
      return item.patient?.isValidWhatsAppNumber === false;
    });
    const unvalidatedPatients = patientsToSend.filter((item) => {
      const patientId = String(item.patientId);
      const status = validationStatus[patientId];
      // Check validationStatus first (fresh data), then fallback to patient data
      if (status) {
        return status.isValid !== true && status.isValid !== false;
      }
      // Fallback to patient data if no validation status exists
      return item.patient?.isValidWhatsAppNumber !== true &&
        item.patient?.isValidWhatsAppNumber !== false;
    });

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
      // Generate unique correlationId for idempotency - prevents duplicate messages on retry or double-click
      // Use crypto.randomUUID() which generates a valid GUID, or undefined if not available
      const correlationId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : undefined;
      await messageApiClient.sendMessages({
        templateId: templateToUse,
        patientIds: patientIdsToSend,
        channel: 'whatsapp',
        moderatorId: moderatorUserId, // Pass for admin users to use correct WhatsApp session
        correlationId,
      });

      addToast(`تم إرسال ${patientIdsToSend.length} رسالة بنجاح`, 'success');

      // Increment ongoing panel badge to notify about new messages
      incrementBadge('ongoing', patientIdsToSend.length);

      closeModal('messagePreview');

      // Trigger refetch events
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('patientDataUpdated'));
        window.dispatchEvent(new CustomEvent('queueDataUpdated'));
        window.dispatchEvent(new CustomEvent('messageDataUpdated'));
      }, 100);
    } catch (err: any) {
      // Handle PendingQR errors (authentication required)
      if (err?.error === 'PendingQR' || err?.code === 'AUTHENTICATION_REQUIRED' || err?.message?.includes('المصادقة')) {
        const message = err?.message || 'جلسة الواتساب تحتاج إلى المصادقة. يرجى المصادقة أولاً قبل إرسال الرسائل.';
        addToast(message, err?.warning ? 'warning' : 'error');

        // Dispatch event to notify WhatsApp session context
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('whatsapp:pendingQR', {
            detail: { moderatorUserId: moderatorUserId, source: 'sendMessages' }
          }));
        }
      }
      // Handle PendingNET errors (network failure)
      else if (err?.error === 'PendingNET' || err?.code === 'NETWORK_FAILURE' || err?.message?.includes('الاتصال بالإنترنت')) {
        const message = err?.message || 'فشل الاتصال بالإنترنت. تم إيقاف جميع المهام الجارية. يرجى التحقق من الاتصال والمحاولة مرة أخرى.';
        addToast(message, err?.warning ? 'warning' : 'error');

        // Dispatch event to notify about network failure
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('whatsapp:networkFailure', {
            detail: { moderatorUserId: moderatorUserId, source: 'sendMessages' }
          }));
        }
      }
      // Handle BrowserClosure errors (browser closed)
      else if (err?.error === 'BrowserClosure' || err?.code === 'BROWSER_CLOSED' || err?.message?.includes('إغلاق المتصفح')) {
        const message = err?.message || 'تم إغلاق المتصفح. تم إيقاف جميع المهام الجارية. يرجى إعادة فتح المتصفح والمحاولة مرة أخرى.';
        addToast(message, err?.warning ? 'warning' : 'error');

        // Dispatch event to notify about browser closure
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('whatsapp:browserClosed', {
            detail: { moderatorUserId: moderatorUserId, source: 'sendMessages' }
          }));
        }
      }
      // Handle WhatsApp validation errors specifically
      else if (err?.error === 'WhatsAppValidationRequired' || err?.message?.includes('أرقام واتساب غير محققة')) {
        const invalidCount = err?.invalidPatients?.length || 0;
        const details = invalidCount > 0
          ? ` (${invalidCount} ${invalidCount === 1 ? 'مريض' : 'مرضى'})`
          : '';
        addToast(
          `لا يمكن إرسال الرسائل: بعض المرضى لديهم أرقام واتساب غير محققة${details}. يرجى التحقق من الأرقام أولاً باستخدام زر "التحقق من كافة الأرقام".`,
          'error'
        );
        // Optionally: mark these patients in validation status
        if (err?.invalidPatients && Array.isArray(err.invalidPatients)) {
          const newStatus: Record<string, any> = {};
          err.invalidPatients.forEach((patient: any) => {
            newStatus[String(patient.patientId)] = {
              isValid: patient.isValidWhatsAppNumber === true ? true : false,
              isChecking: false,
              error: patient.isValidWhatsAppNumber === null
                ? 'لم يتم التحقق من الرقم بعد'
                : 'رقم الواتساب غير صالح',
              attempts: 0,
            };
          });
          setValidationStatus(prev => ({ ...prev, ...newStatus }));
        }
      } else {
        addToast(err?.message || 'فشل إرسال الرسائل', 'error');
      }
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
  // Optional abortSignal parameter allows manual retries to use per-patient abort controllers
  const checkPhoneNumber = useCallback(async (
    patientId: string,
    phoneNumber: string,
    attempt = 0,
    force = false,
    abortSignal?: AbortSignal
  ): Promise<boolean | null> => {
    const maxAttempts = 2;
    // Use provided signal (for manual retries) or batch controller signal
    const effectiveSignal = abortSignal || abortControllerRef.current?.signal;

    // Check if modal is still open and validation was aborted
    if (!isOpenRef.current || abortValidationRef.current || effectiveSignal?.aborted) {
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
    // Look up patient from multiple sources to handle stale data when switching queues
    const patientFromPreview = previewPatients.find(p => String(p.id) === patientId);
    const patientFromSorted = sortedPatients.find(p => String(p.id) === patientId);
    const patientFromContext = contextPatients.find(p => String(p.id) === patientId);
    const patient = patientFromPreview || patientFromSorted || patientFromContext;

    if (!force && patient) {
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
        console.warn(`[MessagePreview] checkPhoneNumber: Patient ${patientId} not found in any source (preview: ${!!patientFromPreview}, sorted: ${!!patientFromSorted}, context: ${!!patientFromContext}), will call API`);
      }
    }

    // Check if modal is still open and abort flag again before API call
    if (!isOpenRef.current || abortValidationRef.current || effectiveSignal?.aborted) {
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
    // Update status to checking (remove queued flag)
    setValidationStatus(prev => ({
      ...prev,
      [patientId]: {
        isValid: null,
        isChecking: true,
        isQueued: false, // No longer queued, now actively checking
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

      // Use extension-based check endpoint (NEW)
      // Get country code from patient or use default
      const patientCountryCode = patient?.countryCode || '+20';
      const result = await whatsappApiClient.checkWhatsAppNumberViaExtension(
        phoneNumber,
        {
          countryCode: patientCountryCode,
          forceCheck: force,
          signal: effectiveSignal
        }
      );

      // Check if modal is still open and abort flag after API call
      if (!isOpenRef.current || abortValidationRef.current || effectiveSignal?.aborted || result.category === 'Aborted') {
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
      if (result.category === 'ServiceUnavailable' || result.category === 'NotConnected') {
        setValidationStatus(prev => ({
          ...prev,
          [patientId]: {
            isValid: null,
            isChecking: false,
            error: result.message || 'خدمة التحقق من الواتساب غير متاحة. يمكنك المتابعة بدون التحقق.',
            attempts: attempt,
          }
        }));
        return null; // Don't retry if service is unavailable
      }

      // Check if result indicates success
      if (result.success === true && result.data === true) {
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

            // Refresh patient data in context to update UI with latest database value
            if (queueId) {
              await refreshPatients(queueId);
            }
          }
        } catch (dbError) {
          // Log error but don't block UI - validation succeeded, just DB update failed
          console.error(`Failed to update database for patient ${patientId}:`, dbError);
        }

        return true;
      } else if (result.data === false) {
        // Explicit confirmation: number does NOT have WhatsApp
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

            // Refresh patient data in context to update UI with latest database value
            if (queueId) {
              await refreshPatients(queueId);
            }
          }
        } catch (dbError) {
          // Log error but don't block UI - validation succeeded, just DB update failed
          console.error(`Failed to update database for patient ${patientId}:`, dbError);
        }

        return false;
      } else if (result.success === false && (result.data === null || result.data === undefined)) {
        // Check failed (e.g., extension command error) - status is unknown, NOT "not on WhatsApp"
        // This handles cases like "message channel closed" extension errors
        setValidationStatus(prev => ({
          ...prev,
          [patientId]: {
            isValid: null,
            isChecking: false,
            error: result.message || 'فشل التحقق من الرقم - يمكن المحاولة مرة أخرى',
            attempts: attempt,
          }
        }));
        return null; // Return null to indicate unknown status
      } else {

        // Pending or other states - treat as error for retry
        throw new Error(result.message || 'Unknown validation state');
      }
    } catch (error: any) {
      // Check if modal is still open and error is due to abort
      if (!isOpenRef.current || error?.name === 'AbortError' || abortValidationRef.current || effectiveSignal?.aborted) {
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
      if (!isOpenRef.current || abortValidationRef.current || effectiveSignal?.aborted) {
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
            if (!isOpenRef.current || abortValidationRef.current || effectiveSignal?.aborted) {
              clearTimeout(timeout);
              clearInterval(checkAbort);
              resolve(undefined);
            }
          }, 100);
          setTimeout(() => clearInterval(checkAbort), 1000);
        });

        // Check if modal is still open and abort flag again after wait
        if (!isOpenRef.current || abortValidationRef.current || effectiveSignal?.aborted) {
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

        // Pass the same abort signal for recursive retry
        return checkPhoneNumber(patientId, phoneNumber, attempt + 1, force, abortSignal);
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
  }, [previewPatients, sortedPatients, contextPatients, queueId]);

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
      isQueued?: boolean;
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
          isQueued: true, // Mark as queued for API validation
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
      await checkPhoneNumber(patientId, phoneNumber, 0);

      // Check if modal is still open and abort flags after API call
      if (!isOpenRef.current || abortValidationRef.current || abortControllerRef.current?.signal.aborted) {
        setIsValidating(false);
        return;
      }

      setValidationProgress(prev => ({ ...prev, current: i + 1 }));
    }

    setIsValidating(false);

    // After batch validation completes, process any queued manual validation requests
    if (processManualValidationQueueRef.current) {
      await processManualValidationQueueRef.current();
    }
  }, [isOpen, sortedPatients, selectedPatientIds, removedPatients, checkPhoneNumber]);

  // Refresh patient data and trigger validation when modal opens
  useEffect(() => {
    if (isOpen && queueId && selectedPatientIds.length > 0) {
      // Reset all state first
      setValidationStatus({});
      setRemovedPatients([]);
      setValidationProgress({ current: 0, total: 0 });
      setValidationPaused(false);
      setShouldResumeValidation(false);
      abortValidationRef.current = false;
      setIsSending(false); // Fix: Reset sending state in case it was stuck

      // Clear refs to prevent stale state from previous opens
      manualValidationQueueRef.current = [];
      activeCheckSessionsRef.current.clear();
      patientAbortControllersRef.current.clear();

      // Refresh patients from database to get latest IsValidWhatsAppNumber values
      refreshPatients(queueId).then(() => {
        // After refresh, wait a bit for state to update, then validate
        // Use a longer timeout to ensure React state has updated
        setTimeout(() => {
          // Call validateAllPatients - it will use the fresh sortedPatients
          validateAllPatients();
        }, 200);
      }).catch((error) => {
        console.error('Failed to refresh patients:', error);
        // Still try to validate with existing data
        validateAllPatients();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, queueId, selectedPatientIds.length]); // Trigger on open/close and when patient selection changes

  // Manual retry validation for a specific patient
  // IMPORTANT: This goes DIRECTLY to WhatsApp via extension (force=true)
  // Unlike automated validation which checks database first
  // Queues requests during batch validation, processes after batch completes
  const handleRetryValidation = useCallback(async (patientId: string) => {
    // If batch validation is running, add to queue instead of processing immediately
    if (isValidating) {
      // Check if already in queue
      if (!manualValidationQueueRef.current.includes(patientId)) {
        manualValidationQueueRef.current.push(patientId);
        // Mark as queued for manual check (gray clock icon)
        setValidationStatus(prev => ({
          ...prev,
          [patientId]: {
            isValid: null,
            isChecking: false,
            isQueued: true,
            isManualCheck: true, // Mark as manual for queued display
            attempts: 0,
          }
        }));
        // Update total count to include newly queued item so progress (X/total) reflects it
        setValidationProgress(prev => ({ ...prev, total: prev.total + 1 }));
        addToast('تم إضافة الرقم لقائمة الانتظار. سيتم التحقق بعد انتهاء التحقق التلقائي.', 'info');
      } else {
        addToast('هذا الرقم موجود بالفعل في قائمة الانتظار', 'info');
      }
      return;
    }

    // Not in batch validation - check if another manual check is in progress
    const isAnyManualCheckInProgress = Array.from(patientAbortControllersRef.current.keys()).length > 0;

    if (isAnyManualCheckInProgress) {
      // Another manual check is running - add to queue
      if (!manualValidationQueueRef.current.includes(patientId)) {
        manualValidationQueueRef.current.push(patientId);
        // Update total count to include newly queued item
        setValidationProgress(prev => ({ current: prev.current, total: prev.total + 1 }));
        setValidationStatus(prev => ({
          ...prev,
          [patientId]: {
            isValid: null,
            isChecking: false,
            isQueued: true,
            isManualCheck: true,
            attempts: 0,
          }
        }));
        addToast('تم إضافة الرقم لقائمة الانتظار. سيتم التحقق بعد انتهاء التحقق الحالي.', 'info');
      }
      return;
    }

    // Starting a new manual validation - set validating state
    setIsValidating(true);
    setValidationProgress({ current: 0, total: 1 + manualValidationQueueRef.current.length });

    // Execute the manual validation directly
    await executeManualValidation(patientId);
    setValidationProgress(prev => ({ current: prev.current + 1, total: prev.total }));

    // After this validation completes, process any other queued items
    if (processManualValidationQueueRef.current) {
      await processManualValidationQueueRef.current();
    }

    // All manual checks done - reset validating state
    setIsValidating(false);
    setValidationProgress({ current: 0, total: 0 });
  }, [isValidating, addToast]);

  // Execute a single manual validation (called by handleRetryValidation and processManualValidationQueue)
  const executeManualValidation = useCallback(async (patientId: string) => {
    // Get patient data - IMPORTANT: try multiple sources to handle stale data when switching queues
    // 1. First try resolutions (most reliable - derived from current modal data)
    const patientResolution = resolutions.find(r => String(r.patientId) === patientId);
    // 2. Then try previewPatients (current modal data)
    const patientFromPreview = previewPatients.find(p => String(p.id) === patientId);
    // 3. Then try sortedPatients and contextPatients as fallbacks
    const patientFromSorted = sortedPatients.find(p => String(p.id) === patientId);
    const patientFromContext = contextPatients.find(p => String(p.id) === patientId);

    const patient = patientFromPreview || patientFromSorted || patientFromContext;

    // Debug log to help diagnose stale data issues
    console.log('[MessagePreview] executeManualValidation lookup:', {
      patientId,
      foundInResolutions: !!patientResolution,
      foundInPreview: !!patientFromPreview,
      foundInSorted: !!patientFromSorted,
      foundInContext: !!patientFromContext,
      resolutionsCount: resolutions.length,
      previewPatientsCount: previewPatients.length,
      sortedPatientsCount: sortedPatients.length,
    });

    if (!patient || !patient.phone) {
      addToast('لم يتم العثور على بيانات المريض', 'error');
      return;
    }

    // Create abort controller for this validation
    const patientAbortController = new AbortController();
    patientAbortControllersRef.current.set(patientId, patientAbortController);

    const countryCode = patient.countryCode || '+20';
    const phoneNumber = `${countryCode}${patient.phone}`;

    // Mark as checking with manual flag (purple spinner)
    setValidationStatus(prev => ({
      ...prev,
      [patientId]: {
        isValid: null,
        isChecking: true,
        isQueued: false,
        isManualCheck: true, // Purple spinner for manual check
        attempts: 0,
      }
    }));

    try {
      // Force=true ensures we always call WhatsApp API (no database cache)
      await checkPhoneNumber(patientId, phoneNumber, 0, true, patientAbortController.signal);
    } catch (error: any) {
      if (error?.name === 'AbortError' || patientAbortController.signal.aborted) {
        setValidationStatus(prev => ({
          ...prev,
          [patientId]: {
            isValid: null,
            isChecking: false,
            isManualCheck: true,
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
          isManualCheck: true,
          error: error?.message || 'فشل التحقق من رقم الواتساب',
          attempts: 0,
        }
      }));
    } finally {
      // Clean up the patient's abort controller
      patientAbortControllersRef.current.delete(patientId);
    }
  }, [resolutions, previewPatients, sortedPatients, contextPatients, checkPhoneNumber, addToast]);

  // Process queued manual validation requests one at a time
  const processManualValidationQueue = useCallback(async () => {
    while (manualValidationQueueRef.current.length > 0) {
      // Check if modal is still open
      if (!isOpenRef.current || abortValidationRef.current) {
        // Clear queue on abort or modal close
        manualValidationQueueRef.current = [];
        return;
      }

      // Get the next patient from queue
      const patientId = manualValidationQueueRef.current.shift();
      if (!patientId) continue;

      // Execute validation for this patient
      await executeManualValidation(patientId);

      // Update progress
      setValidationProgress(prev => ({ current: prev.current + 1, total: prev.total }));
    }
  }, [executeManualValidation]);

  // Assign processManualValidationQueue to ref for use in validateAllPatients
  useEffect(() => {
    processManualValidationQueueRef.current = processManualValidationQueue;
  }, [processManualValidationQueue]);

  // Handle modal close with confirmation if validating or manual check in progress
  const handleCloseModal = () => {
    // Check if batch validation OR manual validation is in progress
    const isManualCheckInProgress = patientAbortControllersRef.current.size > 0 || manualValidationQueueRef.current.length > 0;
    if (isValidating || isManualCheckInProgress) {
      // Show confirmation dialog
      setShowCloseConfirmation(true);
    } else {
      // Close immediately if not validating
      closeModal('messagePreview');
    }
  };

  // Handle confirmation to abort validation
  const handleConfirmAbort = async () => {
    // Set abort flag
    abortValidationRef.current = true;

    // Actually abort all ongoing fetch requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Server-side cancellation: cancel check session for this moderator
    // This clears the CheckWhatsApp pause and allows sending to resume
    try {
      await whatsappApiClient.cancelCheckSession();
    } catch (error) {
      console.error('Failed to cancel check session:', error);
    }
    activeCheckSessionsRef.current.clear();

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
      // Abort any ongoing batch validation requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }

      // Abort all per-patient validation requests
      patientAbortControllersRef.current.forEach((controller) => {
        controller.abort();
      });
      patientAbortControllersRef.current.clear();

      // Clear active check sessions
      activeCheckSessionsRef.current.clear();

      // Clear manual validation queue
      manualValidationQueueRef.current = [];

      // Reset all state variables
      abortValidationRef.current = false;
      setIsValidating(false);
      setShowCloseConfirmation(false);
      setValidationStatus({});
      setValidationProgress({ current: 0, total: 0 });
      setRemovedPatients([]);
      setIsSending(false);
      setValidationPaused(false);
      setShouldResumeValidation(false);

      // Refresh patient data in context when modal closes to ensure latest data
      // This ensures that any validation updates are reflected in the main patient list
      if (queueId) {
        refreshPatients(queueId).catch((error) => {
          console.error('Failed to refresh patients on modal close:', error);
        });
      }
    }
  }, [isOpen, queueId, refreshPatients]);

  // Resume validation after single patient retry completes
  useEffect(() => {
    if (shouldResumeValidation && !isValidating && !validationPaused) {
      setShouldResumeValidation(false);
      // Resume batch validation
      validateAllPatients();
    }
  }, [shouldResumeValidation, isValidating, validationPaused, validateAllPatients]);

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
                <span className="text-2xl font-bold">{previewPatientCount ?? 0}</span>
                <p className="text-sm">سيتم إرسال الرسالة لهم</p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col flex-1">
            {missingDefaultTemplate && (
              <div className="px-4 py-3 bg-yellow-50 border-b border-yellow-200 flex items-start gap-3 text-sm text-yellow-800">
                <i className="fas fa-exclamation-triangle mt-1"></i>
                <div>
                  <p className="font-medium">لا يوجد قالب افتراضي معرف لهذه العيادة.</p>
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
                    <th className="px-4 py-2 text-xs font-medium text-gray-600 text-center justify-center">الترتيب (المتبقي)</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-600">الاسم</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-600">الهاتف</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-600">الرسالة</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-600">الحالة</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-600">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(() => {
                    const filteredResolutions = resolutions.filter((res) => res.reason !== 'EXCLUDED');
                    if (filteredResolutions.length === 0) {
                      console.warn('[MessagePreview] No resolutions to display (all excluded or empty)');
                    } else {
                      console.log('[MessagePreview] Rendering table with resolutions:', {
                        total: filteredResolutions.length,
                        resolutions: filteredResolutions.map(r => ({
                          patientId: r.patientId,
                          patientName: r.patientName,
                          reason: r.reason,
                          hasResolvedTemplate: !!r.resolvedTemplate,
                          resolvedTemplateLength: r.resolvedTemplate?.length || 0,
                          resolvedTemplatePreview: r.resolvedTemplate ? r.resolvedTemplate.substring(0, 50) : 'MISSING',
                        })),
                      });
                    }
                    return filteredResolutions;
                  })().map((resolution) => {
                    const patient = previewPatients.find((p) => String(p.id) === resolution.patientId);
                    if (!patient) {
                      console.warn('[MessagePreview] Patient not found for resolution:', resolution.patientId);
                      return null;
                    }
                    const reasonBadge = getReasonBadge(resolution.reason);

                    return (
                      <tr key={resolution.patientId} className="hover:bg-gray-50">
                        <td className="px-4 py-2">
                          <div className="flex items-center justify-center gap-1">
                            <span className="font-medium text-gray-900">
                              {resolution.patientPosition}
                            </span>
                            <span className="text-xs text-gray-500 whitespace-nowrap">
                              ({resolution.offset > 0 ? '+' : ''}{resolution.offset})
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2">{resolution.patientName}</td>
                        <td className={`px-4 py-2 ${(() => {
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
                                // Currently being checked - show spinner (blue for batch, purple for manual)
                                if (status?.isChecking) {
                                  if (status.isManualCheck) {
                                    // Manual check - purple spinner with border
                                    return (
                                      <span className="inline-flex items-center justify-center w-4 h-4 border border-purple-400 rounded-full">
                                        <i className="fas fa-spinner fa-spin text-purple-600 text-xs" title="جاري التحقق يدوياً..."></i>
                                      </span>
                                    );
                                  }
                                  // Batch check - blue spinner
                                  return <i className="fas fa-spinner fa-spin text-blue-500 text-xs" title="جاري التحقق التلقائي..."></i>;
                                }
                                // Valid WhatsApp number - green check
                                if (status?.isValid === true) {
                                  return <i className="fas fa-check-circle text-green-500 text-xs" title="رقم واتساب صحيح"></i>;
                                }
                                // Invalid WhatsApp number (no account) - red X
                                if (status?.isValid === false) {
                                  return <i className="fas fa-times-circle text-red-500 text-xs" title="رقم واتساب غير صحيح أو غير مفعّل"></i>;
                                }
                                // Error during check - orange warning
                                if (status?.error) {
                                  const errorMsg = getValidationErrorMessage(status);
                                  return (
                                    <i
                                      className="fas fa-exclamation-triangle text-orange-500 text-xs cursor-help"
                                      title={errorMsg}
                                    ></i>
                                  );
                                }
                                // Queued for checking - gray clock (shows for both batch queued and manual queued)
                                if (status?.isQueued) {
                                  if (status.isManualCheck) {
                                    // Queued manual check - gray clock with text indicator
                                    return (
                                      <span className="inline-flex items-center gap-0.5" title="في انتظار التحقق اليدوي...">
                                        <i className="fas fa-clock text-gray-400 text-xs"></i>
                                        <span className="text-gray-400 text-xs">#</span>
                                      </span>
                                    );
                                  }
                                  return <i className="fas fa-clock text-gray-400 text-xs" title="في انتظار التحقق..."></i>;
                                }
                                // Not checked yet (no status at all) - gray question mark
                                if (!status || status.isValid === null) {
                                  return <i className="fas fa-question-circle text-gray-400 text-xs" title="لم يتم التحقق بعد"></i>;
                                }
                                return null;
                              })()}
                              {/* Always show retry button - goes DIRECTLY to WhatsApp (skips database) */}
                              <button
                                onClick={() => handleRetryValidation(String(resolution.patientId))}
                                disabled={(() => {
                                  const status = validationStatus[String(resolution.patientId)];
                                  // Disable when checking OR when queued for manual check
                                  return status?.isChecking === true || (status?.isQueued && status?.isManualCheck);
                                })()}
                                className={`text-xs underline disabled:opacity-50 disabled:cursor-not-allowed ${validationStatus[String(resolution.patientId)]?.isQueued && validationStatus[String(resolution.patientId)]?.isManualCheck
                                  ? 'text-gray-400'
                                  : 'text-blue-600 hover:text-blue-800'
                                  }`}
                                title={
                                  validationStatus[String(resolution.patientId)]?.isQueued && validationStatus[String(resolution.patientId)]?.isManualCheck
                                    ? 'في قائمة الانتظار للتحقق اليدوي'
                                    : 'تحقق مباشر من واتساب (بدون التحقق من قاعدة البيانات)'
                                }
                              >
                                <i className="fas fa-redo text-xs"></i>
                              </button>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-gray-600 max-w-xs">
                          {resolution.resolvedTemplate && resolution.resolvedTemplate.trim().length > 0 ? (
                            <span className="whitespace-pre-wrap break-words">{resolution.resolvedTemplate}</span>
                          ) : (
                            <span className="text-red-500 italic text-xs">
                              {resolution.reason === 'EXCLUDED'
                                ? 'مستبعد (موضع سابق)'
                                : resolution.reason === 'NO_MATCH'
                                  ? 'لا يوجد شرط مطابق'
                                  : `لا توجد رسالة (${resolution.reason})`}
                            </span>
                          )}
                        </td>
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
              title={isValidating ? 'جاري التحقق من أرقام الواتساب... يرجى الانتظار' : ''}
            >
              {isSending ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i>
                  جاري الإرسال...
                </>
              ) : isValidating ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i>
                  جاري التحقق... ({validationProgress.current + 1}/{validationProgress.total})
                </>
              ) : (
                <>
                  <i className="fab fa-whatsapp"></i>
                  {`تأكيد الإرسال (${previewPatientCount ?? 0})`}
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


