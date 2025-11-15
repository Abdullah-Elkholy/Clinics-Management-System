'use client';
/* Lines 2-11 omitted */
import { ConditionApplicationSection } from '../Common/ConditionApplicationSection';
import UsageGuideSection from '../Common/UsageGuideSection';

import { useModal } from '@/contexts/ModalContext';
import { useUI } from '@/contexts/UIContext';
import { useQueue } from '@/contexts/QueueContext';
import { validateName, validateTextareaRequired, ValidationError } from '@/utils/validation';
import { messageApiClient, type TemplateDto } from '@/services/api/messageApiClient';
import { templateDtoToModel } from '@/services/api/adapters';
import Modal from './Modal';
import ConfirmationModal from '@/components/Common/ConfirmationModal';
import { useState, useEffect } from 'react';
// Mock data removed - using API data instead

export default function EditTemplateModal() {
  const { openModals, closeModal, getModalData } = useModal();
  const { addToast } = useUI();
  const { selectedQueueId, updateMessageTemplate, messageTemplates, addMessageCondition, updateMessageCondition, messageConditions, refreshQueueData } = useQueue();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [errors, setErrors] = useState<ValidationError>({});
  const [isLoading, setIsLoading] = useState(false);
  const [selectedConditionId, setSelectedConditionId] = useState<string | null>(null);
  const [currentTemplate, setCurrentTemplate] = useState<any>(null);
  const [showDefaultWarning, setShowDefaultWarning] = useState(false);
  const [existingDefaultTemplate, setExistingDefaultTemplate] = useState<any>(null);
  const [touched, setTouched] = useState(false);

  // Condition choice states - for building actual condition data
  const [selectedOperator, setSelectedOperator] = useState<'EQUAL' | 'GREATER' | 'LESS' | 'RANGE' | 'DEFAULT' | null>(null);
  const [selectedValue, setSelectedValue] = useState<number | undefined>(undefined);
  const [selectedMinValue, setSelectedMinValue] = useState<number | undefined>(undefined);
  const [selectedMaxValue, setSelectedMaxValue] = useState<number | undefined>(undefined);

  const isOpen = openModals.has('editTemplate');
  const modalData = getModalData('editTemplate');
  const templateId = modalData?.templateId as string | undefined;

  const MAX_CONTENT_LENGTH = 1000;
  const [freshTemplateData, setFreshTemplateData] = useState<any>(null);

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
          console.error('Failed to fetch fresh template data:', err);
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
      // Find the condition for this template to get its condition ID
      const templateCondition = messageConditions.find((c) => c.templateId === freshTemplate.id);
      setSelectedConditionId(templateCondition?.id || null);
      
      // Set condition operator and values from the condition
      if (templateCondition) {
        setSelectedOperator(templateCondition.operator as any || null);
        setSelectedValue(templateCondition.value);
        setSelectedMinValue(templateCondition.minValue);
        setSelectedMaxValue(templateCondition.maxValue);
      }
      setErrors({});
      setTouched(false);
    }
  }, [isOpen, freshTemplate?.id, freshTemplate?.title, freshTemplate?.content, messageConditions]);

  // Handle condition selection
  const handleConditionChange = (conditionId: string | null) => {
    // If selecting a different default condition, check if one already exists elsewhere
    const currentTemplateCondition = messageConditions.find((c) => c.templateId === currentTemplate?.id);
    if (conditionId && conditionId.startsWith('DEFAULT_') && currentTemplateCondition?.id !== conditionId) {
      const existingDefaultCondition = messageConditions.find(
        (c) => c.queueId === currentTemplate?.queueId && 
               c.templateId !== currentTemplate?.id &&
               c.id?.startsWith('DEFAULT_')
      );
      if (existingDefaultCondition) {
        const existingTemplate = messageTemplates.find((t) => t.id === existingDefaultCondition.templateId);
        if (existingTemplate) {
          setExistingDefaultTemplate(existingTemplate);
          setShowDefaultWarning(true);
          return;
        }
      }
    }
    setSelectedConditionId(conditionId);
  };

  const confirmDefaultOverride = () => {
    setSelectedConditionId(selectedConditionId);
    setShowDefaultWarning(false);
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

  /**
   * Validate condition value - must be >= 1
   */
  const validateConditionValue = (value: number | undefined): boolean => {
    return value !== undefined && value > 0;
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
    setTouched(true);

    // Validate on change for better UX
    if (errors[fieldName]) {
      validateField(fieldName, value);
    }
  };

  const handleFieldBlur = (fieldName: string) => {
    setTouched(true);
    if (fieldName === 'title') {
      validateField(fieldName, title);
    } else if (fieldName === 'content') {
      validateField(fieldName, content);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);

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

    // Validate template exists before setting isLoading
    if (!currentTemplate) {
      addToast('لم يتم تحديد قالب', 'error');
      return;
    }

    // Validate queue ID
    const queueIdNum = Number(currentTemplate.queueId);
    if (isNaN(queueIdNum)) {
      addToast('معرّف الطابور غير صالح', 'error');
      return;
    }

    // Parse template ID as number (backend ID)
    const templateBackendId = Number(currentTemplate.id);
    if (isNaN(templateBackendId)) {
      addToast('معرّف القالب غير صالح', 'error');
      return;
    }

    try {
      setIsLoading(true);

      // Call API to update template
      await messageApiClient.updateTemplate(templateBackendId, {
        title,
        content,
      });

      // Update condition if operator or values changed
      const templateCondition = messageConditions.find((c) => c.templateId === currentTemplate.id);
      if (templateCondition && selectedOperator) {
        const conditionIdNum = Number(templateCondition.id);
        if (!isNaN(conditionIdNum)) {
          await messageApiClient.updateCondition(conditionIdNum, {
            operator: selectedOperator,
            value: (selectedOperator === 'EQUAL' || selectedOperator === 'GREATER' || selectedOperator === 'LESS') 
              ? selectedValue 
              : undefined,
            minValue: selectedOperator === 'RANGE' ? selectedMinValue : undefined,
            maxValue: selectedOperator === 'RANGE' ? selectedMaxValue : undefined,
          });
        }
      }

      addToast('تم تحديث قالب الرسالة والشرط بنجاح', 'success');
      
      // Refetch queue data to ensure UI is in sync with backend
      // Wait for refetch to complete before closing modal and dispatching event
      if (typeof refreshQueueData === 'function' && currentTemplate.queueId) {
        await refreshQueueData(String(currentTemplate.queueId));
      } else {
        // Fallback: update local state if refreshQueueData is not available
        // Note: updatedAt will be set by backend, but we provide default for test mocks
        updateMessageTemplate(currentTemplate.id, {
          title,
          content,
          updatedAt: new Date(), // Will be populated from backend response after API call
        });
      }
      
      // Clear form fields after successful update
      setTitle('');
      setContent('');
      setErrors({});
      setTouched(false);
      setSelectedConditionId(null);
      setSelectedOperator(null);
      setSelectedValue(undefined);
      setSelectedMinValue(undefined);
      setSelectedMaxValue(undefined);
      setCurrentTemplate(null);
      setFreshTemplateData(null);
      
      closeModal('editTemplate');
      
      // Trigger a custom event to notify other components to refetch
      // Dispatch after a small delay to ensure refreshQueueData has updated the state
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('templateDataUpdated'));
      }, 100);
    } catch (error) {
      addToast('حدث خطأ أثناء تحديث القالب', 'error');
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
        closeModal('editTemplate');
        setTitle('');
        setContent('');
        setErrors({});
        setTouched(false);
        setIsLoading(false);
        setSelectedConditionId(null);
        setSelectedOperator(null);
        setSelectedValue(undefined);
        setSelectedMinValue(undefined);
        setSelectedMaxValue(undefined);
        setCurrentTemplate(null);
        setFreshTemplateData(null);
      }}
      title="تحرير قالب رسالة"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
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
              setTouched(false);
              setIsLoading(false);
              setSelectedConditionId(null);
              setSelectedOperator(null);
              setSelectedValue(undefined);
              setSelectedMinValue(undefined);
              setSelectedMaxValue(undefined);
              setCurrentTemplate(null);
              setFreshTemplateData(null);
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
          setSelectedConditionId(currentTemplate?.conditionId || null);
          setExistingDefaultTemplate(null);
        }}
      />
    </Modal>
  );
}
