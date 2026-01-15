'use client';
/* Lines 2-11 omitted */
import { ConditionApplicationSection } from '../Common/ConditionApplicationSection';
import UsageGuideSection from '../Common/UsageGuideSection';

import { useModal } from '@/contexts/ModalContext';
import { useUI } from '@/contexts/UIContext';
import { useQueue } from '@/contexts/QueueContext';
import { useConfirmDialog } from '@/contexts/ConfirmationContext';
import { messageApiClient } from '@/services/api/messageApiClient';
import { validateName, validateTextareaRequired, ValidationError } from '@/utils/validation';
import { getConditionRange, conditionsOverlap } from '@/utils/moderatorAggregation';
import logger from '@/utils/logger';
import type { MessageTemplate } from '@/types/messageTemplate';
// Use QueueContext to perform API calls for templates
import Modal from './Modal';
import ConfirmationModal from '@/components/Common/ConfirmationModal';
import { useState, useEffect, useRef, type FormEvent } from 'react';
import { useFormKeyboardNavigation } from '@/hooks/useFormKeyboardNavigation';
// Mock data removed - using API data instead

type AddTemplateModalData = {
  queueId?: string | number;
};

export default function AddTemplateModal() {
  const { openModals, closeModal, getModalData } = useModal();
  const { addToast } = useUI();
  const { confirm } = useConfirmDialog();
  const {
    selectedQueueId,
    messageTemplates,
    messageConditions,
    refreshQueueData,
  } = useQueue();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [errors, setErrors] = useState<ValidationError>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showDefaultWarning, setShowDefaultWarning] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [existingDefaultTemplate, setExistingDefaultTemplate] = useState<MessageTemplate | null>(null);
  const [hasConfirmedDefaultOverride, setHasConfirmedDefaultOverride] = useState(false);

  // Condition choice states - for building actual condition data
  const [selectedOperator, setSelectedOperator] = useState<'EQUAL' | 'GREATER' | 'LESS' | 'RANGE' | 'DEFAULT' | null>(null);
  const [selectedValue, setSelectedValue] = useState<number | undefined>(undefined);
  const [selectedMinValue, setSelectedMinValue] = useState<number | undefined>(undefined);
  const [selectedMaxValue, setSelectedMaxValue] = useState<number | undefined>(undefined);

  const isOpen = openModals.has('addTemplate');
  const modalData = getModalData('addTemplate') as AddTemplateModalData | undefined;
  const queueId = modalData?.queueId || selectedQueueId;

  const MAX_CONTENT_LENGTH = 1000;

  // Reset all state when modal opens to ensure clean state
  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setContent('');
      setErrors({});
      setIsLoading(false);
      setSelectedOperator(null);
      setSelectedValue(undefined);
      setSelectedMinValue(undefined);
      setSelectedMaxValue(undefined);
      setShowDefaultWarning(false);
      setExistingDefaultTemplate(null);
      setHasConfirmedDefaultOverride(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!queueId) {
      setShowDefaultWarning(false);
      setExistingDefaultTemplate(null);
      setHasConfirmedDefaultOverride(false);
      return;
    }

    if (selectedOperator !== 'DEFAULT') {
      setShowDefaultWarning(false);
      setExistingDefaultTemplate(null);
      setHasConfirmedDefaultOverride(false);
      return;
    }

    if (hasConfirmedDefaultOverride) {
      return;
    }

    const existingDefaultCondition = messageConditions.find(
      (condition) =>
        condition.queueId === String(queueId) && condition.operator === 'DEFAULT'
    );

    if (!existingDefaultCondition) {
      setShowDefaultWarning(false);
      setExistingDefaultTemplate(null);
      return;
    }

    const defaultTemplate = messageTemplates.find(
      (template) => template.id === existingDefaultCondition.templateId
    );

    if (defaultTemplate) {
      setExistingDefaultTemplate(defaultTemplate);
      setShowDefaultWarning(true);
    }
  }, [
    selectedOperator,
    queueId,
    hasConfirmedDefaultOverride,
    messageConditions,
    messageTemplates,
  ]);

  const confirmDefaultOverride = () => {
    setShowDefaultWarning(false);
    setHasConfirmedDefaultOverride(true);
  };

  const insertVariable = (variable: string) => {
    if (content.length + variable.length <= MAX_CONTENT_LENGTH) {
      setContent(content + variable);
      // Clear error if there was one
      if (errors.content) {
        setErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors.content;
          return newErrors;
        });
      }
    } else {
      addToast(`تم تجاوز الحد الأقصى للأحرف (${MAX_CONTENT_LENGTH})`, 'error');
    }
  };

  const validateField = (fieldName: string, value: string) => {
    let error: string | null = null;

    switch (fieldName) {
      case 'title':
        error = validateName(value, 'عنوان القالب');
        break;
      case 'content':
        error = validateTextareaRequired(value, 'محتوى الرسالة', MAX_CONTENT_LENGTH);
        break;
      default:
        break;
    }

    if (error) {
      setErrors((prev) => ({ ...prev, [fieldName]: error }));
    } else {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
    }
  };

  const handleFieldChange = (fieldName: string, value: string) => {
    if (fieldName === 'title') {
      setTitle(value);
    } else if (fieldName === 'content') {
      if (value.length <= MAX_CONTENT_LENGTH) {
        setContent(value);
      } else {
        addToast(`الحد الأقصى ${MAX_CONTENT_LENGTH} حرف`, 'error');
        return;
      }
    }
    // Validate on change for better UX
    if (errors[fieldName]) {
      validateField(fieldName, value);
    }
  };

  const handleFieldBlur = (fieldName: string) => {
    if (fieldName === 'title') {
      validateField(fieldName, title);
    } else if (fieldName === 'content') {
      validateField(fieldName, content);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // Validate all fields
    const newErrors: ValidationError = {};

    if (validateName(title, 'عنوان القالب')) {
      newErrors.title = validateName(title, 'عنوان القالب') || '';
    }

    if (validateTextareaRequired(content, 'محتوى الرسالة', MAX_CONTENT_LENGTH)) {
      newErrors.content = validateTextareaRequired(content, 'محتوى الرسالة', MAX_CONTENT_LENGTH) || '';
    }
    // Enforce backend minimum length (10 chars) explicitly to prevent 400
    if (content.trim().length < 10) {
      newErrors.content = 'المحتوى يجب أن يكون 10 أحرف على الأقل';
    }

    // Validate condition if operator is selected (but not DEFAULT)
    if (selectedOperator && selectedOperator !== 'DEFAULT') {
      if (selectedOperator === 'RANGE') {
        if (!selectedMinValue || selectedMinValue <= 0) {
          newErrors.minValue = 'الحد الأدنى مطلوب ويجب أن يكون > 0';
        }
        if (!selectedMaxValue || selectedMaxValue <= 0) {
          newErrors.maxValue = 'الحد الأقصى مطلوب ويجب أن يكون > 0';
        }
        if (selectedMinValue && selectedMaxValue && selectedMinValue >= selectedMaxValue) {
          newErrors.range = 'الحد الأدنى يجب أن يكون أقل من الحد الأقصى';
        }
      } else {
        if (!selectedValue || selectedValue <= 0) {
          newErrors.value = 'القيمة مطلوبة ويجب أن تكون > 0';
        }
      }
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      // Don't set isLoading to true if validation fails
      return;
    }

    // Validate queue ID before setting isLoading
    if (!queueId) {
      addToast('يجب تحديد عيادة', 'error');
      return;
    }

    // Validate queue ID is a valid number
    const queueIdNum = Number(queueId);
    if (isNaN(queueIdNum)) {
      addToast('معرّف العيادة غير صالح', 'error');
      return;
    }

    // Check for duplicate template title in same queue
    const existingTemplate = messageTemplates.find(
      (t) => t.queueId === String(queueIdNum) && t.title.toLowerCase() === title.toLowerCase()
    );
    if (existingTemplate) {
      addToast(`قالب بعنوان "${title}" موجود بالفعل في هذه العيادة`, 'error');
      return;
    }

    // Determine the operator: if no operator selected, use UNCONDITIONED
    const conditionOperator = selectedOperator || 'UNCONDITIONED';

    // Check for conflicts with existing conditions (only for non-UNCONDITIONED and non-DEFAULT operators)
    if (conditionOperator !== 'UNCONDITIONED' && conditionOperator !== 'DEFAULT') {
      const newCondition = {
        operator: conditionOperator,
        value: (conditionOperator === 'EQUAL' || conditionOperator === 'GREATER' || conditionOperator === 'LESS')
          ? selectedValue
          : undefined,
        minValue: conditionOperator === 'RANGE' ? selectedMinValue : undefined,
        maxValue: conditionOperator === 'RANGE' ? selectedMaxValue : undefined,
      };

      // Find conflicting conditions in the same queue
      const conflictingConditions = messageConditions
        .filter(c => {
          // Only check conditions in the same queue
          const conditionQueueId = c.queueId?.toString();
          if (conditionQueueId !== String(queueIdNum)) return false;

          // Skip UNCONDITIONED and DEFAULT conditions (they don't conflict)
          if (c.operator === 'UNCONDITIONED' || c.operator === 'DEFAULT') return false;

          // Check if conditions overlap
          const newRange = getConditionRange(newCondition);
          const existingRange = getConditionRange(c);

          if (!newRange || !existingRange) return false;

          return conditionsOverlap(newCondition, c);
        })
        .map(c => {
          const template = messageTemplates.find(t => t.id === c.templateId);
          return {
            condition: c,
            templateTitle: template?.title || 'غير معروف',
          };
        });

      if (conflictingConditions.length > 0) {
        // Show confirmation dialog
        const conflictDetails = conflictingConditions
          .map(c => `- ${c.templateTitle} (${c.condition.operator} ${c.condition.value || `${c.condition.minValue}-${c.condition.maxValue}`})`)
          .join('\n');

        const shouldProceed = await confirm({
          title: 'تعارض في الشروط',
          message: `هناك تعارض مع الشروط التالية:\n\n${conflictDetails}\n\nهل تريد المتابعة على أي حال؟`,
          confirmText: 'نعم، المتابعة',
          cancelText: 'إلغاء',
        });

        if (!shouldProceed) {
          return; // User cancelled
        }
      }
    }

    try {
      setIsLoading(true);

      // Prepare request payload
      const requestPayload = {
        title,
        content,
        queueId: queueIdNum,
        conditionOperator: conditionOperator,
        conditionValue: (conditionOperator === 'EQUAL' || conditionOperator === 'GREATER' || conditionOperator === 'LESS')
          ? selectedValue
          : conditionOperator === 'RANGE' || conditionOperator === 'UNCONDITIONED'
            ? null
            : undefined,
        conditionMinValue: conditionOperator === 'RANGE' ? selectedMinValue : undefined,
        conditionMaxValue: conditionOperator === 'RANGE' ? selectedMaxValue : undefined,
      };

      // Debug: log the request payload
      logger.debug('CreateTemplate Request Payload:', requestPayload);

      // Create the template with condition in one call (backend handles one-to-one relationship)
      let createdTemplate;
      try {
        createdTemplate = await messageApiClient.createTemplate(requestPayload);
      } catch (createError: any) {
        // Check if error is about default template already existing
        const errorMessage = createError?.message || '';
        if (errorMessage.includes('A default template already exists') || errorMessage.includes('default template already exists')) {
          // Show confirmation dialog to override existing default
          const shouldOverride = await confirm({
            title: 'قالب افتراضي موجود بالفعل',
            message: 'يوجد قالب افتراضي آخر في هذه العيادة. هل تريد جعل هذا القالب هو الافتراضي وتغيير القالب الآخر إلى "بدون قالب"؟',
            confirmText: 'نعم، تغيير',
            cancelText: 'إلغاء',
          });

          if (!shouldOverride) {
            setIsLoading(false);
            return; // User cancelled
          }

          // Override: First set existing default to UNCONDITIONED, then create new default
          // We need to find the existing default template and update it
          const existingDefaultCondition = messageConditions.find(
            (c) => c.queueId === String(queueIdNum) && c.operator === 'DEFAULT'
          );

          if (existingDefaultCondition) {
            // Update existing default condition to UNCONDITIONED
            const existingConditionId = Number(existingDefaultCondition.id);
            if (!isNaN(existingConditionId)) {
              await messageApiClient.updateCondition(existingConditionId, {
                operator: 'UNCONDITIONED',
                value: null,
                minValue: null,
                maxValue: null,
              });
            }
          }

          // Now create the new template with DEFAULT operator
          createdTemplate = await messageApiClient.createTemplate(requestPayload);
        } else {
          // Re-throw other errors
          throw createError;
        }
      }

      // Refetch queue data to get the latest state from backend (includes new template + condition)
      if (typeof refreshQueueData === 'function' && queueId) {
        await refreshQueueData(String(queueId));
      }

      // Show appropriate success message based on operator
      if (conditionOperator === 'UNCONDITIONED') {
        addToast('تم إضافة قالب الرسالة بنجاح (بدون شرط)', 'success');
      } else {
        addToast('تم إضافة قالب الرسالة والشرط بنجاح', 'success');
      }

      // Dispatch events with queueId for targeted refresh in MessagesPanel
      window.dispatchEvent(new CustomEvent('templateDataUpdated', { detail: { queueId } }));
      window.dispatchEvent(new CustomEvent('conditionDataUpdated', { detail: { queueId } }));

      // Clear form fields after successful creation
      setTitle('');
      setContent('');
      setErrors({});
      setSelectedOperator(null);
      setSelectedValue(undefined);
      setSelectedMinValue(undefined);
      setSelectedMaxValue(undefined);

      closeModal('addTemplate');
    } catch (error) {
      // Attempt to extract structured validation errors (problem+json)
      let userMessage = 'حدث خطأ أثناء إضافة القالب';
      let errorDetails: unknown = null;
      let statusCode: unknown = undefined;

      if (error && typeof error === 'object') {
        if ('statusCode' in error) statusCode = (error as any).statusCode;
        if ('message' in error) errorDetails = (error as any).message;
        // If message contains problem+json payload, try parse
        if (typeof errorDetails === 'string') {
          try {
            const parsed = JSON.parse(errorDetails);
            if (parsed && parsed.errors) {
              const contentErrors = parsed.errors.Content || parsed.errors.content;
              if (Array.isArray(contentErrors) && contentErrors.length > 0) {
                userMessage = contentErrors[0];
              }
            }
          } catch (_) {
            // ignore JSON parse fail
          }
        }
        // Check if it's a simple message string
        if (typeof errorDetails === 'string' && errorDetails) {
          userMessage = errorDetails;
        }
      }

      logger.error('Failed to add template:', {
        statusCode,
        errorDetails,
        fullError: error,
      });

      addToast(userMessage, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Setup keyboard navigation (after handleSubmit is defined)
  useFormKeyboardNavigation({
    formRef,
    onEnterSubmit: () => {
      const fakeEvent = { preventDefault: () => { } } as FormEvent<HTMLFormElement>;
      handleSubmit(fakeEvent);
    },
    enableEnterSubmit: true,
    disabled: isLoading,
  });

  // Validation errors check
  const hasValidationErrors = Object.keys(errors).length > 0 || !title.trim() || !content.trim();

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        closeModal('addTemplate');
        setTitle('');
        setContent('');
        setErrors({});
        setIsLoading(false);
        setSelectedOperator(null);
        setSelectedValue(undefined);
        setSelectedMinValue(undefined);
        setSelectedMaxValue(undefined);
        setShowDefaultWarning(false);
        setExistingDefaultTemplate(null);
        setHasConfirmedDefaultOverride(false);
      }}
      title="إضافة قالب رسالة جديد"
      size="lg"
    >
      <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
        {/* Required Fields Disclaimer */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
          <p className="flex items-center gap-2">
            <i className="fas fa-info-circle"></i>
            <span>الحقول المرمزة بـ * مطلوبة</span>
          </p>
        </div>

        <div>
          <label htmlFor="addTemplate-title" className="block text-sm font-medium text-gray-700 mb-2">
            عنوان القالب *
          </label>
          <input
            id="addTemplate-title"
            name="title"
            type="text"
            value={title ?? ''}
            onChange={(e) => handleFieldChange('title', e.target.value)}
            onBlur={() => handleFieldBlur('title')}
            placeholder="أدخل عنوان القالب"
            disabled={isLoading}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent transition-all ${errors.title
              ? 'border-red-500 focus:ring-red-500'
              : 'border-gray-300 focus:ring-blue-500'
              }`}
          />
          {errors.title && (
            <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
              <i className="fas fa-exclamation-circle"></i>
              {errors.title}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="addTemplate-content" className="block text-sm font-medium text-gray-700 mb-2">
            محتوى الرسالة *
          </label>
          <textarea
            id="addTemplate-content"
            name="content"
            value={content ?? ''}
            onChange={(e) => handleFieldChange('content', e.target.value)}
            onBlur={() => handleFieldBlur('content')}
            rows={4}
            placeholder="أدخل محتوى الرسالة"
            disabled={isLoading}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent transition-all resize-none ${errors.content
              ? 'border-red-500 focus:ring-red-500'
              : 'border-gray-300 focus:ring-blue-500'
              }`}
          />
          <div className="flex items-center justify-between mt-1">
            {errors.content && (
              <p className="text-sm text-red-600 flex items-center gap-1">
                <i className="fas fa-exclamation-circle"></i>
                {errors.content}
              </p>
            )}
            <p className={`text-xs ml-auto ${content.length > MAX_CONTENT_LENGTH * 0.9
              ? 'text-orange-600'
              : 'text-gray-500'
              }`}>
              {content.length} / {MAX_CONTENT_LENGTH}
            </p>
          </div>
        </div>

        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border-2 border-blue-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-lg text-blue-900 flex items-center gap-2">
              <i className="fas fa-code text-blue-600"></i>
              المتغيرات المتاحة:
            </h4>
            <span className="text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded-full font-medium">
              انقر لإدراج المتغير في محتوى الرسالة
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => insertVariable('{PN}')}
              disabled={isLoading}
              className="bg-white hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed border-2 border-blue-300 hover:border-blue-400 px-3 py-2 rounded-lg text-blue-700 font-mono text-sm text-left transition-all hover:shadow-md"
            >
              <span className="font-bold text-lg text-blue-600">{'{PN}'}</span>
              <br />
              <span className="text-sm font-medium text-gray-700">اسم المريض بالكامل</span>
            </button>
            <button
              type="button"
              onClick={() => insertVariable('{PQP}')}
              disabled={isLoading}
              className="bg-white hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed border-2 border-blue-300 hover:border-blue-400 px-3 py-2 rounded-lg text-blue-700 font-mono text-sm text-left transition-all hover:shadow-md"
            >
              <span className="font-bold text-lg text-blue-600">{'{PQP}'}</span>
              <br />
              <span className="text-sm font-medium text-gray-700">الموضع الحالي للمريض في العيادة</span>
            </button>
            <button
              type="button"
              onClick={() => insertVariable('{CQP}')}
              disabled={isLoading}
              className="bg-white hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed border-2 border-blue-300 hover:border-blue-400 px-3 py-2 rounded-lg text-blue-700 font-mono text-sm text-left transition-all hover:shadow-md"
            >
              <span className="font-bold text-lg text-blue-600">{'{CQP}'}</span>
              <br />
              <span className="text-sm font-medium text-gray-700">الموضع الحالي لمجمل العيادة</span>
            </button>
            <button
              type="button"
              onClick={() => insertVariable('{ETR}')}
              disabled={isLoading}
              className="bg-white hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed border-2 border-blue-300 hover:border-blue-400 px-3 py-2 rounded-lg text-blue-700 font-mono text-sm text-left transition-all hover:shadow-md"
            >
              <span className="font-bold text-lg text-blue-600">{'{ETR}'}</span>
              <br />
              <span className="text-sm font-medium text-gray-700">الوقت المتبقي بالدقائق</span>
            </button>
          </div>
        </div>

        {/* Condition Application Section */}
        <ConditionApplicationSection
          operator={selectedOperator}
          value={selectedValue}
          minValue={selectedMinValue}
          maxValue={selectedMaxValue}
          onOperatorChange={setSelectedOperator}
          onValueChange={setSelectedValue}
          onMinValueChange={setSelectedMinValue}
          onMaxValueChange={setSelectedMaxValue}
          onAddToast={addToast}
          isLoading={isLoading}
          errors={errors}
          hideInfo={false}
        />

        {/* Usage Guide Section */}
        <UsageGuideSection
          items={[
            {
              title: 'بدون شرط',
              description: 'عند اختيار هذا الخيار، ستُرسل الرسالة لجميع المرضى بدون استثناء'
            },
            {
              title: 'قالب افتراضي',
              description: 'يمكنك تعيين قالب واحد فقط كقالب افتراضي لكل عيادة. سيتم إرسال هذا القالب عندما لا ينطبق أي شرط آخر'
            },
            {
              title: 'جميع القيم يجب أن تكون أكبر من صفر (≥1)',
              description: 'تأكد من إدخال قيم صحيحة عند تحديد أي شرط. يجب أن تكون جميع الأرقام موجبة'
            }
          ]}
        />

        <div className="flex gap-3 pt-4 border-t">
          <button
            type="submit"
            disabled={isLoading || hasValidationErrors}
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
                إضافة القالب
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              closeModal('addTemplate');
              setTitle('');
              setContent('');
              setErrors({});
              setIsLoading(false);
              setSelectedOperator(null);
              setSelectedValue(undefined);
              setSelectedMinValue(undefined);
              setSelectedMaxValue(undefined);
              setShowDefaultWarning(false);
              setExistingDefaultTemplate(null);
              setHasConfirmedDefaultOverride(false);
            }}
            disabled={isLoading}
            className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            إلغاء
          </button>
        </div>
      </form>

      {/* Default Template Override Confirmation */}
      <ConfirmationModal
        isOpen={showDefaultWarning}
        title="تحذير: تغيير القالب الافتراضي"
        message={
          <div className="space-y-3">
            <p>
              القالب الافتراضي الحالي للعيادة هو: <strong className="text-blue-600">{existingDefaultTemplate?.title}</strong>
            </p>
            <p>
              هل تريد استبدال القالب الافتراضي الحالي بهذا القالب الجديد؟
            </p>
            <div className="bg-amber-50 border border-amber-200 p-3 rounded text-sm text-amber-800">
              <p className="font-semibold mb-1">⚠️ تنبيه:</p>
              <p>هذا سيجعل القالب السابق غير فعال كقالب افتراضي، لكنه سيبقى محفوظاً في النظام</p>
            </div>
          </div>
        }
        confirmText="نعم، استبدل القالب الافتراضي"
        cancelText="لا، إلغاء"
        confirmButtonVariant="warning"
        isDangerous={true}
        icon="fa-exclamation-triangle"
        onConfirm={confirmDefaultOverride}
        onCancel={() => {
          setShowDefaultWarning(false);
          setExistingDefaultTemplate(null);
          setHasConfirmedDefaultOverride(false);
          setSelectedOperator(null);
          setSelectedValue(undefined);
          setSelectedMinValue(undefined);
          setSelectedMaxValue(undefined);
        }}
      />
    </Modal>
  );
}


