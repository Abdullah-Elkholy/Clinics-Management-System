'use client';

import { useModal } from '@/contexts/ModalContext';
import { useUI } from '@/contexts/UIContext';
import { useQueue } from '@/contexts/QueueContext';
import { validateName, validateTextarea, ValidationError } from '@/utils/validation';
import Modal from './Modal';
import ConfirmationModal from '@/components/Common/ConfirmationModal';
import { useState, useEffect } from 'react';
import { MOCK_MESSAGE_TEMPLATES, MOCK_QUEUE_MESSAGE_CONDITIONS } from '@/constants/mockData';

export default function EditTemplateModal() {
  const { openModals, closeModal, getModalData } = useModal();
  const { addToast } = useUI();
  const { selectedQueueId } = useQueue();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [errors, setErrors] = useState<ValidationError>({});
  const [isLoading, setIsLoading] = useState(false);
  const [selectedConditionId, setSelectedConditionId] = useState<string | null>(null);
  const [currentTemplate, setCurrentTemplate] = useState<any>(null);
  const [showDefaultWarning, setShowDefaultWarning] = useState(false);
  const [existingDefaultTemplate, setExistingDefaultTemplate] = useState<any>(null);

  const isOpen = openModals.has('editTemplate');
  const modalData = getModalData('editTemplate');
  const templateId = modalData?.templateId as string | undefined;

  const MAX_CONTENT_LENGTH = 1000;
  const MAX_DESCRIPTION_LENGTH = 200;

  // Load template data when modal opens
  useEffect(() => {
    if (isOpen && templateId) {
      const template = MOCK_MESSAGE_TEMPLATES.find((t) => t.id === templateId);
      if (template) {
        setCurrentTemplate(template);
        setTitle(template.title);
        setDescription(template.description || '');
        setContent(template.content);
        setSelectedConditionId(template.conditionId);
      }
    }
  }, [isOpen, templateId]);

  // Handle condition selection
  const handleConditionChange = (conditionId: string | null) => {
    // If selecting a different default condition, check if one already exists elsewhere
    if (conditionId && conditionId.startsWith('DEFAULT_') && currentTemplate?.conditionId !== conditionId) {
      const existingDefault = MOCK_MESSAGE_TEMPLATES.find(
        (t) => t.queueId === currentTemplate?.queueId && 
               t.id !== currentTemplate?.id &&
               t.conditionId?.startsWith('DEFAULT_')
      );
      if (existingDefault) {
        setExistingDefaultTemplate(existingDefault);
        setShowDefaultWarning(true);
        return;
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
        error = validateTextarea(value, 'محتوى الرسالة', MAX_CONTENT_LENGTH);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all fields
    const newErrors: ValidationError = {};

    if (validateName(title, 'عنوان القالب')) {
      newErrors.title = validateName(title, 'عنوان القالب') || '';
    }

    if (validateTextarea(content, 'محتوى الرسالة', MAX_CONTENT_LENGTH)) {
      newErrors.content = validateTextarea(content, 'محتوى الرسالة', MAX_CONTENT_LENGTH) || '';
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      addToast('يرجى تصحيح الأخطاء أعلاه', 'error');
      return;
    }

    try {
      setIsLoading(true);

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 500));

      // TODO: Update template through context or API
      addToast('تم تحديث قالب الرسالة بنجاح', 'success');
      setTitle('');
      setDescription('');
      setContent('');
      setErrors({});
      closeModal('editTemplate');
    } catch (error) {
      addToast('حدث خطأ أثناء تحديث القالب', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const isSubmitDisabled = Object.keys(errors).length > 0 || !title.trim() || !content.trim() || isLoading;

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        closeModal('editTemplate');
        setTitle('');
        setContent('');
        setErrors({});
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
          <label className="block text-sm font-medium text-gray-700 mb-2">
            عنوان القالب *
          </label>
          <input
            type="text"
            value={title}
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
          <label className="block text-sm font-medium text-gray-700 mb-2">
            الوصف (اختياري)
          </label>
          <textarea
            value={description}
            onChange={(e) => {
              if (e.target.value.length <= MAX_DESCRIPTION_LENGTH) {
                setDescription(e.target.value);
              } else {
                addToast(`الحد الأقصى ${MAX_DESCRIPTION_LENGTH} حرف`, 'error');
              }
            }}
            rows={2}
            placeholder="أدخل وصف القالب - مثال: رسالة ترحيب للمرضى الجدد"
            disabled={isLoading}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
          />
          <p className={`text-xs mt-1 ${
            description.length > MAX_DESCRIPTION_LENGTH * 0.9
              ? 'text-orange-600'
              : 'text-gray-500'
          }`}>
            {description.length} / {MAX_DESCRIPTION_LENGTH}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            محتوى الرسالة *
          </label>
          <textarea
            value={content}
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
            <h4 className="font-semibold text-blue-900 flex items-center gap-2">
              <i className="fas fa-code text-blue-600"></i>
              المتغيرات المتاحة:
            </h4>
            <span className="text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded-full">
              انقر لإدراج المتغير
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => insertVariable('{PN}')}
              disabled={isLoading}
              className="bg-white hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed border-2 border-blue-300 hover:border-blue-400 px-3 py-2 rounded-lg text-blue-700 font-mono text-sm text-left transition-all hover:shadow-md"
            >
              <span className="font-bold text-blue-600">{'{PN}'}</span>
              <br />
              <span className="text-xs text-gray-600">اسم المريض بالكامل</span>
            </button>
            <button
              type="button"
              onClick={() => insertVariable('{PQP}')}
              disabled={isLoading}
              className="bg-white hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed border-2 border-blue-300 hover:border-blue-400 px-3 py-2 rounded-lg text-blue-700 font-mono text-sm text-left transition-all hover:shadow-md"
            >
              <span className="font-bold text-blue-600">{'{PQP}'}</span>
              <br />
              <span className="text-xs text-gray-600">الموضع الحالي للمريض في الطابور</span>
            </button>
            <button
              type="button"
              onClick={() => insertVariable('{CQP}')}
              disabled={isLoading}
              className="bg-white hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed border-2 border-blue-300 hover:border-blue-400 px-3 py-2 rounded-lg text-blue-700 font-mono text-sm text-left transition-all hover:shadow-md"
            >
              <span className="font-bold text-blue-600">{'{CQP}'}</span>
              <br />
              <span className="text-xs text-gray-600">الموضع الحالي لمجمل الطابور</span>
            </button>
            <button
              type="button"
              onClick={() => insertVariable('{ETR}')}
              disabled={isLoading}
              className="bg-white hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed border-2 border-blue-300 hover:border-blue-400 px-3 py-2 rounded-lg text-blue-700 font-mono text-sm text-left transition-all hover:shadow-md"
            >
              <span className="font-bold text-blue-600">{'{ETR}'}</span>
              <br />
              <span className="text-xs text-gray-600">الوقت المتبقي بالدقائق</span>
            </button>
          </div>
        </div>

        {/* Condition Selection Section */}
        <div className="space-y-3 border border-gray-200 rounded-lg p-4 bg-gray-50">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              تطبيق الشرط (اختياري)
            </label>
            <select
              value={selectedConditionId || ''}
              onChange={(e) => handleConditionChange(e.target.value || null)}
              disabled={isLoading}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">لم يتم تحديده بعد - القالب الافتراضي</option>
              {currentTemplate && MOCK_QUEUE_MESSAGE_CONDITIONS.filter(
                (c) => c.queueId === currentTemplate.queueId && !c.id.startsWith('DEFAULT_')
              ).map((condition) => (
                <option key={condition.id} value={condition.id}>
                  {condition.name} ({condition.operator === 'GREATER' ? 'أكثر من' : condition.operator === 'LESS' ? 'أقل من' : 'يساوي'} {condition.value})
                </option>
              ))}
            </select>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-800">
            <p className="font-semibold mb-2 flex items-center gap-2">
              <i className="fas fa-info-circle"></i>
              معلومات مهمة:
            </p>
            <ul className="space-y-1 text-xs list-disc list-inside">
              <li>إذا لم تحدد شرط، سيصبح هذا القالب هو القالب الافتراضي للطابور</li>
              <li>يمكن استخدام القالب في الرسائل الآلية فقط بعد تحديد القالب الافتراضي</li>
              <li>كل طابور يجب أن يكون له قالب افتراضي واحد فقط</li>
            </ul>
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t">
          <button
            type="submit"
            disabled={isSubmitDisabled}
            className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-2 ${
              isSubmitDisabled
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
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
              setDescription('');
              setContent('');
              setErrors({});
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
