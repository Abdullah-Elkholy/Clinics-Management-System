'use client';
/* Lines 2-11 omitted */
import { ConditionApplicationSection } from '../Common/ConditionApplicationSection';
import UsageGuideSection from '../Common/UsageGuideSection';

import { useModal } from '@/contexts/ModalContext';
import { useUI } from '@/contexts/UIContext';
import { useQueue } from '@/contexts/QueueContext';
import { useConfirmDialog } from '@/contexts/ConfirmationContext';
import { validateName, validateTextareaRequired, ValidationError } from '@/utils/validation';
import { getConditionRange, conditionsOverlap } from '@/utils/moderatorAggregation';
import { detectOverlappingConditions } from '@/utils/conditionConflictDetector';
import { messageApiClient, type TemplateDto } from '@/services/api/messageApiClient';
import { templateDtoToModel, conditionDtoToModel } from '@/services/api/adapters';
import logger from '@/utils/logger';
import Modal from './Modal';
import { useFormKeyboardNavigation } from '@/hooks/useFormKeyboardNavigation';
import ConfirmationModal from '@/components/Common/ConfirmationModal';
import { useState, useEffect, useMemo, useRef, type FormEvent } from 'react';
import type { MessageTemplate } from '@/types/messageTemplate';
import type { ConditionOperator } from '@/types/messageCondition';

export default function EditTemplateModal() {
  const { openModals, closeModal, getModalData } = useModal();
  const { addToast } = useUI();
  const { confirm } = useConfirmDialog();
  const { updateMessageTemplate, messageTemplates, addMessageCondition, updateMessageCondition, messageConditions, setMessageConditions, setMessageTemplates, refreshQueueData } = useQueue();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [errors, setErrors] = useState<ValidationError>({});
  const [isLoading, setIsLoading] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState<MessageTemplate | null>(null);
  const [showDefaultWarning, setShowDefaultWarning] = useState(false);
  const [existingDefaultTemplate, setExistingDefaultTemplate] = useState<MessageTemplate | null>(null);
  const [hasConfirmedDefaultOverride, setHasConfirmedDefaultOverride] = useState(false);

  // Condition choice states - for building actual condition data
  const [selectedOperator, setSelectedOperator] = useState<'EQUAL' | 'GREATER' | 'LESS' | 'RANGE' | 'DEFAULT' | null>(null);
  const [selectedValue, setSelectedValue] = useState<number | undefined>(undefined);
  const [selectedMinValue, setSelectedMinValue] = useState<number | undefined>(undefined);
  const [selectedMaxValue, setSelectedMaxValue] = useState<number | undefined>(undefined);
  const formRef = useRef<HTMLFormElement>(null);

  const isOpen = openModals.has('editTemplate');
  const modalData = getModalData('editTemplate');
  const templateId = modalData?.templateId as string | undefined;

  const MAX_CONTENT_LENGTH = 1000;
  const [freshTemplateData, setFreshTemplateData] = useState<MessageTemplate | null>(null);

  // Fetch fresh template data when modal opens
  useEffect(() => {
    if (!isOpen || !templateId) return;
    
    const fetchFreshTemplateData = async () => {
      try {
        const templateIdNum = Number(templateId);
        if (!isNaN(templateIdNum)) {
          const freshTemplateDto: TemplateDto = await messageApiClient.getTemplate(templateIdNum);
          if (freshTemplateDto) {
            // Convert backend DTO to frontend format
            const freshTemplate = templateDtoToModel(freshTemplateDto, templateId);
            setFreshTemplateData(freshTemplate);
          }
        }
      } catch (err) {
        // If fresh data fetch fails, fall back to existing data
        if (process.env.NODE_ENV === 'development') {
          logger.error('Failed to fetch fresh template data:', err);
        }
        setFreshTemplateData(null);
      }
    };
    
    // Always refetch when modal opens to ensure fresh data
    fetchFreshTemplateData();
  }, [isOpen, templateId]);

  // Get fresh template data - prioritize freshTemplateData, then messageTemplates array, then null
  const freshTemplate = freshTemplateData 
    || (templateId 
      ? messageTemplates.find((t) => t.id === templateId)
      : null);

  // Load template data when modal opens - use fresh data
  useEffect(() => {
    if (!isOpen) return;
    
    if (freshTemplate) {
      setCurrentTemplate(freshTemplate);
      setTitle(freshTemplate.title || '');
      setContent(freshTemplate.content || '');

      // Find condition from messageConditions array
      // IMPORTANT: Filter by queueId first to ensure we only match conditions for this template's queue
      const templateConditionForTemplate =
        messageConditions.find((condition) => {
          // First ensure condition belongs to this template's queue
          if (freshTemplate.queueId && String(condition.queueId) !== String(freshTemplate.queueId)) {
            return false;
          }
          // Then match by templateId using simple equality
          return condition.templateId === freshTemplate.id;
        }) ??
        freshTemplate.condition ??
        null;

      if (templateConditionForTemplate) {
        const nextOperator =
          templateConditionForTemplate.operator === 'UNCONDITIONED'
            ? null
            : (templateConditionForTemplate.operator as 'EQUAL' | 'GREATER' | 'LESS' | 'RANGE' | 'DEFAULT');
        setSelectedOperator(nextOperator);
        setSelectedValue(templateConditionForTemplate.value);
        setSelectedMinValue(templateConditionForTemplate.minValue);
        setSelectedMaxValue(templateConditionForTemplate.maxValue);
      } else {
        setSelectedOperator(null);
        setSelectedValue(undefined);
        setSelectedMinValue(undefined);
        setSelectedMaxValue(undefined);
      }

      setErrors({});
      setShowDefaultWarning(false);
      setExistingDefaultTemplate(null);
      setHasConfirmedDefaultOverride(false);
    }
  }, [isOpen, freshTemplate, messageConditions]);

  const templateCondition = useMemo(() => {
    if (!currentTemplate) return null;
    // Find condition from messageConditions array
    // IMPORTANT: Filter by queueId first to ensure we only match conditions for this template's queue
    return (
      messageConditions.find((condition) => {
        // First ensure condition belongs to this template's queue
        if (currentTemplate.queueId && String(condition.queueId) !== String(currentTemplate.queueId)) {
          return false;
        }
        // Then match by templateId using simple equality
        return condition.templateId === currentTemplate.id;
      }) ??
      currentTemplate.condition ??
      null
    );
  }, [currentTemplate, messageConditions]);

  useEffect(() => {
    if (!currentTemplate?.queueId) {
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

    const queueIdStr = String(currentTemplate.queueId);
    const existingDefaultCondition = messageConditions.find(
      (condition) =>
        String(condition.queueId) === queueIdStr &&
        condition.operator === 'DEFAULT' &&
        condition.templateId !== currentTemplate.id
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
    } else {
      setShowDefaultWarning(false);
      setExistingDefaultTemplate(null);
    }
  }, [
    selectedOperator,
    currentTemplate?.queueId,
    currentTemplate?.id,
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

    const titleError = validateName(title, 'عنوان القالب');
    if (titleError) {
      newErrors.title = titleError;
    }

    const contentError = validateTextareaRequired(content, 'محتوى الرسالة', MAX_CONTENT_LENGTH);
    if (contentError) {
      newErrors.content = contentError;
    }

    // Validate condition if operator is selected (but not DEFAULT or null)
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
      } else if (!selectedValue || selectedValue <= 0) {
        newErrors.value = 'القيمة مطلوبة ويجب أن تكون > 0';
      }
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      // Don't set isLoading to true if validation fails
      return;
    }

    // Validate template exists before setting isLoading
    if (!currentTemplate) {
      addToast('لم يتم تحديد قالب', 'error');
      return;
    }

    // Validate queue ID
    const queueIdNum = Number(currentTemplate.queueId);
    if (isNaN(queueIdNum)) {
      addToast('معرّف العيادة غير صالح', 'error');
      return;
    }

    // Parse template ID as number (backend ID)
    const templateBackendId = Number(currentTemplate.id);
    if (isNaN(templateBackendId)) {
      addToast('معرّف القالب غير صالح', 'error');
      return;
    }

    const conditionOperator = (
      selectedOperator ?? templateCondition?.operator ?? 'UNCONDITIONED'
    ) as ConditionOperator;

    const normalizedValue =
      conditionOperator === 'EQUAL' ||
      conditionOperator === 'GREATER' ||
      conditionOperator === 'LESS'
        ? selectedValue
        : undefined;
    const normalizedMinValue = conditionOperator === 'RANGE' ? selectedMinValue : undefined;
    const normalizedMaxValue = conditionOperator === 'RANGE' ? selectedMaxValue : undefined;

    // Check for conflicts with existing conditions (only for non-UNCONDITIONED and non-DEFAULT operators)
    if (conditionOperator !== 'UNCONDITIONED' && conditionOperator !== 'DEFAULT') {
      const newCondition = {
        operator: conditionOperator,
        value: normalizedValue,
        minValue: normalizedMinValue,
        maxValue: normalizedMaxValue,
      };

      // Find conflicting conditions in the same queue (excluding the current condition being edited)
      const conflictingConditions = messageConditions
        .filter(c => {
          // Only check conditions in the same queue
          const conditionQueueId = c.queueId?.toString();
          if (conditionQueueId !== String(queueIdNum)) return false;
          
          // Skip the current condition being edited
          if (templateCondition && c.id === templateCondition.id) return false;
          
          // Skip UNCONDITIONED and DEFAULT conditions (they don't conflict)
          if (c.operator === 'UNCONDITIONED' || c.operator === 'DEFAULT') return false;
          
          // Check if conditions overlap
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
          .map(c => {
            const cond = c.condition;
            let condDesc = '';
            if (cond.operator === 'RANGE') {
              condDesc = `${cond.operator} ${cond.minValue}-${cond.maxValue}`;
            } else {
              condDesc = `${cond.operator} ${cond.value}`;
            }
            return `- ${c.templateTitle} (${condDesc})`;
          })
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

      // STEP 1: Handle condition update/create FIRST (before template update)
      // This ensures condition is in correct state before template loads it
      if (conditionOperator === 'DEFAULT') {
        // For DEFAULT operator, use dedicated endpoint
        // But first check if there's an existing default and handle override
        try {
          await messageApiClient.setTemplateAsDefault(templateBackendId);
        } catch (error: any) {
          const errorMessage = error?.message || '';
          // If there's an existing default, show confirmation dialog
          if (errorMessage.includes('A default template already exists') || errorMessage.includes('default template already exists')) {
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

            // Override: Find existing default and set it to UNCONDITIONED, then set this one as default
            const existingDefaultCondition = messageConditions.find(
              (c) => c.queueId === String(queueIdNum) && c.operator === 'DEFAULT' && c.templateId !== currentTemplate.id
            );

            if (existingDefaultCondition) {
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

            // Now set this template as default
            await messageApiClient.setTemplateAsDefault(templateBackendId);
          } else {
            // Re-throw other errors
            throw error;
          }
        }
      } else {
        // For other operators, update or create condition
        if (templateCondition) {
          // Update existing condition
          const conditionIdNum = Number(templateCondition.id);
          if (!isNaN(conditionIdNum)) {
            // Build update request
            // Backend now automatically clears fields based on operator type:
            // - RANGE: clears Value, sets MinValue/MaxValue
            // - EQUAL/GREATER/LESS: sets Value, clears MinValue/MaxValue
            // - UNCONDITIONED/DEFAULT: clears all values
            const updateRequest: any = {
              operator: conditionOperator,
            };
            
            // Include values that should be set (backend will clear the others based on operator)
            if (conditionOperator === 'RANGE') {
              updateRequest.minValue = normalizedMinValue;
              updateRequest.maxValue = normalizedMaxValue;
            } else if (conditionOperator === 'EQUAL' || conditionOperator === 'GREATER' || conditionOperator === 'LESS') {
              updateRequest.value = normalizedValue;
            }
            // For UNCONDITIONED or DEFAULT, we don't need to send any values
            // Backend will clear them automatically
            
            await messageApiClient.updateCondition(conditionIdNum, updateRequest);
          }
        } else {
          // Create new condition
          await messageApiClient.createCondition({
            templateId: templateBackendId,
            queueId: queueIdNum,
            operator: conditionOperator,
            value: normalizedValue,
            minValue: normalizedMinValue,
            maxValue: normalizedMaxValue,
          });
        }
      }

      // STEP 2: Update template (backend will load the updated condition)
      const updatedTemplate = await messageApiClient.updateTemplate(templateBackendId, {
        title,
        content,
      });

      // STEP 3: Refetch all queue data to ensure consistency
      // This ensures we get the latest state from backend, especially for condition updates
      if (typeof refreshQueueData === 'function' && currentTemplate.queueId) {
        try {
          await refreshQueueData(String(currentTemplate.queueId));
        } catch (refreshError) {
          // Log but don't fail the update if refetch fails
          logger.error('Failed to refresh queue data after condition update:', refreshError);
        }
      }

      // Trigger custom events to notify other components to refetch (immediate, no delay)
      // Dispatch these events BEFORE closing modal to ensure components receive them
      window.dispatchEvent(new CustomEvent('templateDataUpdated'));
      window.dispatchEvent(new CustomEvent('conditionDataUpdated'));

      // Clear form fields after successful update
      setTitle('');
      setContent('');
      setErrors({});
      setSelectedOperator(null);
      setSelectedValue(undefined);
      setSelectedMinValue(undefined);
      setSelectedMaxValue(undefined);
      setCurrentTemplate(null);
      setFreshTemplateData(null);
      setExistingDefaultTemplate(null);
      setShowDefaultWarning(false);
      setHasConfirmedDefaultOverride(false);

      // Show appropriate success message based on operator
      if (conditionOperator === 'UNCONDITIONED') {
        addToast('تم تحديث قالب الرسالة بنجاح (بدون شرط)', 'success');
      } else {
        addToast('تم تحديث قالب الرسالة والشرط بنجاح', 'success');
      }
      
      // Close modal after dispatching events and showing toast to ensure UI updates
      closeModal('editTemplate');
    } catch (error) {
      // Extract detailed error information
      let errorMessage = 'Unknown error';
      let statusCode: number | undefined;
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (error && typeof error === 'object') {
        if ('message' in error) {
          errorMessage = String((error as { message?: unknown }).message || 'Unknown error');
        }
        if ('statusCode' in error) {
          statusCode = Number((error as { statusCode?: unknown }).statusCode);
        }
        // Check for API error response structure
        if ('error' in error && typeof (error as { error?: unknown }).error === 'string') {
          errorMessage = (error as { error: string }).error;
        }
      }
      
      logger.error('Failed to update template:', {
        error: errorMessage,
        statusCode: statusCode,
        fullError: error,
        conditionOperator: conditionOperator,
        normalizedValue: normalizedValue,
        normalizedMinValue: normalizedMinValue,
        normalizedMaxValue: normalizedMaxValue,
      });
      
      // Show more detailed error message to user
      const userFriendlyMessage = errorMessage.includes('overlap') || errorMessage.includes('تضارب')
        ? 'هناك تضارب في الشروط. يرجى التحقق من الشروط المطبقة.'
        : errorMessage.includes('validation') || errorMessage.includes('validation')
        ? 'خطأ في التحقق من البيانات. يرجى التحقق من القيم المدخلة.'
        : 'حدث خطأ أثناء تحديث القالب';
      
      addToast(userFriendlyMessage, 'error');
    } finally {
      // Always reset loading state, even if an error occurred
      setIsLoading(false);
    }
  };

  // Setup keyboard navigation (after handleSubmit is defined)
  useFormKeyboardNavigation({
    formRef,
    onEnterSubmit: () => {
      const fakeEvent = { preventDefault: () => {} } as FormEvent<HTMLFormElement>;
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
        closeModal('editTemplate');
        setTitle('');
        setContent('');
        setErrors({});
        setIsLoading(false);
        setSelectedOperator(null);
        setSelectedValue(undefined);
        setSelectedMinValue(undefined);
        setSelectedMaxValue(undefined);
        setCurrentTemplate(null);
        setFreshTemplateData(null);
        setExistingDefaultTemplate(null);
        setShowDefaultWarning(false);
        setHasConfirmedDefaultOverride(false);
      }}
      title="تحرير قالب رسالة"
      size="lg"
    >
      <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
        {/* Required Fields Disclaimer */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          <p className="flex items-center gap-2">
            <i className="fas fa-info-circle"></i>
            <span>الحقول المرمزة بـ <span className="font-bold text-red-600">*</span> مطلوبة</span>
          </p>
        </div>

        <div>
          <label htmlFor="editTemplate-title" className="block text-sm font-medium text-gray-700 mb-2">
            عنوان القالب *
          </label>
          <input
            id="editTemplate-title"
            name="title"
            type="text"
            value={title ?? ''}
            onChange={(e) => handleFieldChange('title', e.target.value)}
            onBlur={() => handleFieldBlur('title')}
            placeholder="أدخل عنوان القالب"
            disabled={isLoading}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent transition-all ${
              errors.title
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
          <label htmlFor="editTemplate-content" className="block text-sm font-medium text-gray-700 mb-2">
            محتوى الرسالة *
          </label>
          <textarea
            id="editTemplate-content"
            name="content"
            value={content ?? ''}
            onChange={(e) => handleFieldChange('content', e.target.value)}
            onBlur={() => handleFieldBlur('content')}
            rows={4}
            placeholder="أدخل محتوى الرسالة"
            disabled={isLoading}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent transition-all resize-none ${
              errors.content
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
            <p className={`text-xs ml-auto ${
              content.length > MAX_CONTENT_LENGTH * 0.9
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

        {/* Applied Conditions Section - Show existing conditions for this queue */}
        {currentTemplate?.queueId && messageConditions.length > 0 && (
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-lg p-4 space-y-3">
            <h5 className="text-sm font-bold text-purple-900 mb-3 flex items-center gap-2">
              <i className="fas fa-list-check text-purple-600"></i>
              الشروط المطبقة:
            </h5>
            <div className="space-y-2">
              {(() => {
                // Get all conditions for this queue, sorted: DEFAULT first, then others
                const queueConditions = messageConditions
                  .filter(c => String(c.queueId) === String(currentTemplate.queueId))
                  .sort((a, b) => {
                    // DEFAULT always comes first
                    if (a.operator === 'DEFAULT' && b.operator !== 'DEFAULT') return -1;
                    if (a.operator !== 'DEFAULT' && b.operator === 'DEFAULT') return 1;
                    return 0;
                  });
                
                // Detect conflicts
                const activeConditions = queueConditions.filter(c => 
                  c.operator && c.operator !== 'DEFAULT' && c.operator !== 'UNCONDITIONED'
                );
                const overlappingConditions = detectOverlappingConditions(activeConditions as any);
                const conflictingIds = new Set<string>();
                overlappingConditions.forEach(overlap => {
                  // Each overlap is an object with id1 and id2 properties
                  if (overlap.id1) conflictingIds.add(overlap.id1);
                  if (overlap.id2) conflictingIds.add(overlap.id2);
                });
                
                return queueConditions.map((condition) => {
                  const template = messageTemplates.find(t => t.id === condition.templateId);
                  const isInConflict = condition.id && conflictingIds.has(condition.id);
                  const isCurrentTemplate = condition.templateId === currentTemplate.id;
                  
                  let conditionText = '';
                  if (condition.operator === 'DEFAULT') {
                    conditionText = 'افتراضي';
                  } else if (condition.operator === 'UNCONDITIONED') {
                    conditionText = 'بدون شرط';
                  } else if (condition.operator === 'RANGE') {
                    conditionText = `نطاق: ${condition.minValue} - ${condition.maxValue}`;
                  } else {
                    const operatorLabels: Record<string, string> = {
                      'EQUAL': 'يساوي',
                      'GREATER': 'أكبر من',
                      'LESS': 'أقل من',
                    };
                    conditionText = `${operatorLabels[condition.operator] || condition.operator}: ${condition.value}`;
                  }
                  
                  return (
                    <div
                      key={condition.id}
                      className={`p-3 rounded-lg border-2 transition ${
                        isInConflict
                          ? 'bg-red-100 border-red-400'
                          : isCurrentTemplate
                          ? 'bg-blue-100 border-blue-400'
                          : condition.operator === 'DEFAULT'
                          ? 'bg-green-100 border-green-300'
                          : 'bg-white border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className={`text-sm font-semibold ${
                            isInConflict ? 'text-red-900' : isCurrentTemplate ? 'text-blue-900' : 'text-gray-900'
                          }`}>
                            {template?.title || 'غير معروف'}
                            {isCurrentTemplate && (
                              <span className="ml-2 text-xs text-blue-600">(هذا القالب)</span>
                            )}
                          </p>
                          <p className={`text-xs mt-1 ${
                            isInConflict ? 'text-red-700' : 'text-gray-600'
                          }`}>
                            {conditionText}
                          </p>
                        </div>
                        {isInConflict && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-600 text-white rounded text-xs font-bold">
                            <i className="fas fa-exclamation-triangle"></i>
                            تضارب!
                          </span>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}

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
                جاري التحديث...
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
              closeModal('editTemplate');
              setTitle('');
              setContent('');
              setErrors({});
              setIsLoading(false);
              setSelectedOperator(null);
              setSelectedValue(undefined);
              setSelectedMinValue(undefined);
              setSelectedMaxValue(undefined);
              setCurrentTemplate(null);
              setFreshTemplateData(null);
              setExistingDefaultTemplate(null);
              setShowDefaultWarning(false);
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
              هل تريد استبدال القالب الافتراضي الحالي بهذا القالب؟
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

          if (templateCondition) {
            const revertOperator =
              templateCondition.operator === 'UNCONDITIONED'
                ? null
                : (templateCondition.operator as 'EQUAL' | 'GREATER' | 'LESS' | 'RANGE' | 'DEFAULT');
            setSelectedOperator(revertOperator);
            setSelectedValue(templateCondition.value);
            setSelectedMinValue(templateCondition.minValue);
            setSelectedMaxValue(templateCondition.maxValue);
          } else {
            setSelectedOperator(null);
            setSelectedValue(undefined);
            setSelectedMinValue(undefined);
            setSelectedMaxValue(undefined);
          }
        }}
      />
    </Modal>
  );
}


