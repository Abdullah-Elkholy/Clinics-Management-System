'use client';
/* Lines 2-11 omitted */
import { ConditionApplicationSection } from '../Common/ConditionApplicationSection';
import UsageGuideSection from '../Common/UsageGuideSection';

import { useModal } from '@/contexts/ModalContext';
import { useUI } from '@/contexts/UIContext';
import { useQueue } from '@/contexts/QueueContext';
import { messageApiClient } from '@/services/api/messageApiClient';
import { validateName, validateTextareaRequired, ValidationError } from '@/utils/validation';
import logger from '@/utils/logger';
import type { MessageTemplate } from '@/types/messageTemplate';
// Use QueueContext to perform API calls for templates
import Modal from './Modal';
import ConfirmationModal from '@/components/Common/ConfirmationModal';
import { useState, useEffect, type FormEvent } from 'react';
// Mock data removed - using API data instead

type AddTemplateModalData = {
  queueId?: string | number;
};

export default function AddTemplateModal() {
  const { openModals, closeModal, getModalData } = useModal();
  const { addToast } = useUI();
  const {
    selectedQueueId,
    addMessageTemplate,
    addMessageCondition,
    messageTemplates,
    messageConditions,
    refreshQueueData,
  } = useQueue();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [errors, setErrors] = useState<ValidationError>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showDefaultWarning, setShowDefaultWarning] = useState(false);
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

    // Validate condition if operator is selected
    if (selectedOperator) {
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
      addToast('يجب تحديد طابور', 'error');
      return;
    }
    
    // Validate queue ID is a valid number
    const queueIdNum = Number(queueId);
    if (isNaN(queueIdNum)) {
      addToast('معرّف الطابور غير صالح', 'error');
      return;
    }
    
    // Check for duplicate template title in same queue
    const existingTemplate = messageTemplates.find(
      (t) => t.queueId === String(queueIdNum) && t.title.toLowerCase() === title.toLowerCase()
    );
    if (existingTemplate) {
      addToast(`قالب بعنوان "${title}" موجود بالفعل في هذا الطابور`, 'error');
      return;
    }

    try {
      setIsLoading(true);

      // Determine the operator: if no operator selected, use UNCONDITIONED
      const conditionOperator = selectedOperator || 'UNCONDITIONED';
      
      // Create the template with condition in one call (backend handles one-to-one relationship)
      const createdTemplate = await messageApiClient.createTemplate({
        title,
        content,
        queueId: queueIdNum,
        conditionOperator: conditionOperator,
        conditionValue: (conditionOperator === 'EQUAL' || conditionOperator === 'GREATER' || conditionOperator === 'LESS') 
          ? selectedValue 
          : undefined,
        conditionMinValue: conditionOperator === 'RANGE' ? selectedMinValue : undefined,
        conditionMaxValue: conditionOperator === 'RANGE' ? selectedMaxValue : undefined,
      });

      // If DEFAULT operator was selected, set the template as default
      // (Backend creates the condition, but we need to call setTemplateAsDefault for DEFAULT)
      if (conditionOperator === 'DEFAULT') {
        await messageApiClient.setTemplateAsDefault(createdTemplate.id);
      }

      addToast('تم إضافة قالب الرسالة والشرط بنجاح', 'success');
      
      // Always refetch full data to reflect server truth
      // Wait for refetch to complete before closing modal and dispatching event
      if (typeof refreshQueueData === 'function' && queueId) {
        await refreshQueueData(String(queueId));
      } else {
        // Fallback: update via context helper (in tests, this is usually a mock and won't hit API)
        // Note: createdBy and createdAt will be set by backend, but we provide defaults for test mocks
        await addMessageTemplate({
          title,
          content,
          queueId: String(queueId),
          variables: [],
          createdBy: '', // Will be populated from backend response after API call
          createdAt: new Date(), // Will be populated from backend response after API call
        });

        if (queueId) {
          const queueIdStr = String(queueId);
          const priority =
            messageConditions.filter((condition) => condition.queueId === queueIdStr).length + 1;

          await addMessageCondition({
            queueId: queueIdStr,
            templateId: String(createdTemplate.id),
            name: `${title} شرط`,
            priority,
            enabled: true,
            operator: conditionOperator,
            value:
              conditionOperator === 'RANGE' || conditionOperator === 'DEFAULT'
                ? undefined
                : selectedValue,
            minValue: conditionOperator === 'RANGE' ? selectedMinValue : undefined,
            maxValue: conditionOperator === 'RANGE' ? selectedMaxValue : undefined,
            template: content,
          });
        }
      }
      
      // Clear form fields after successful creation
      setTitle('');
      setContent('');
      setErrors({});
      setSelectedOperator(null);
      setSelectedValue(undefined);
      setSelectedMinValue(undefined);
      setSelectedMaxValue(undefined);
      
      closeModal('addTemplate');
      
      // Trigger a custom event to notify other components to refetch
      // Dispatch after a small delay to ensure refreshQueueData has updated the state
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('templateDataUpdated'));
      }, 100);
    } catch (error) {
      logger.error('Failed to add template:', error);
      addToast('حدث خطأ أثناء إضافة القالب', 'error');
    } finally {
      setIsLoading(false);
    }
  };

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
      <form onSubmit={handleSubmit} className="space-y-4">
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
              <span className="text-sm font-medium text-gray-700">الموضع الحالي للمريض في الطابور</span>
            </button>
            <button
              type="button"
              onClick={() => insertVariable('{CQP}')}
              disabled={isLoading}
              className="bg-white hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed border-2 border-blue-300 hover:border-blue-400 px-3 py-2 rounded-lg text-blue-700 font-mono text-sm text-left transition-all hover:shadow-md"
            >
              <span className="font-bold text-lg text-blue-600">{'{CQP}'}</span>
              <br />
              <span className="text-sm font-medium text-gray-700">الموضع الحالي لمجمل الطابور</span>
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
              description: 'يمكنك تعيين قالب واحد فقط كقالب افتراضي لكل طابور. سيتم إرسال هذا القالب عندما لا ينطبق أي شرط آخر'
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
              القالب الافتراضي الحالي للطابور هو: <strong className="text-blue-600">{existingDefaultTemplate?.title}</strong>
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
