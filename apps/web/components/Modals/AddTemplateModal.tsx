'use client';

import { useModal } from '@/contexts/ModalContext';
import { useUI } from '@/contexts/UIContext';
import { useQueue } from '@/contexts/QueueContext';
import { validateName, validateTextarea, ValidationError } from '@/utils/validation';
import Modal from './Modal';
import { useState } from 'react';

export default function AddTemplateModal() {
  const { openModals, closeModal } = useModal();
  const { addToast } = useUI();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [errors, setErrors] = useState<ValidationError>({});
  const [isLoading, setIsLoading] = useState(false);

  const isOpen = openModals.has('addTemplate');

  const MAX_CONTENT_LENGTH = 1000;

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
      
      // TODO: Add template through context
      addToast('تم إضافة قالب الرسالة بنجاح', 'success');
      setTitle('');
      setContent('');
      setErrors({});
      closeModal('addTemplate');
    } catch (error) {
      addToast('حدث خطأ أثناء إضافة القالب', 'error');
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
        closeModal('addTemplate');
        setTitle('');
        setContent('');
        setErrors({});
      }}
      title="إضافة قالب رسالة جديد"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
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

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <h4 className="font-medium text-blue-800 mb-2 text-sm">المتغيرات المتاحة:</h4>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => insertVariable('{PN}')}
              disabled={isLoading}
              className="bg-blue-200 hover:bg-blue-300 disabled:opacity-50 disabled:cursor-not-allowed px-2 py-1 rounded text-blue-800 font-mono text-xs text-left"
            >
              <span className="font-bold">{'{PN}'}</span> - اسم المريض
            </button>
            <button
              type="button"
              onClick={() => insertVariable('{PQP}')}
              disabled={isLoading}
              className="bg-blue-200 hover:bg-blue-300 disabled:opacity-50 disabled:cursor-not-allowed px-2 py-1 rounded text-blue-800 font-mono text-xs text-left"
            >
              <span className="font-bold">{'{PQP}'}</span> - موضع المريض
            </button>
            <button
              type="button"
              onClick={() => insertVariable('{CQP}')}
              disabled={isLoading}
              className="bg-blue-200 hover:bg-blue-300 disabled:opacity-50 disabled:cursor-not-allowed px-2 py-1 rounded text-blue-800 font-mono text-xs text-left"
            >
              <span className="font-bold">{'{CQP}'}</span> - الموضع الحالي
            </button>
            <button
              type="button"
              onClick={() => insertVariable('{ETR}')}
              disabled={isLoading}
              className="bg-blue-200 hover:bg-blue-300 disabled:opacity-50 disabled:cursor-not-allowed px-2 py-1 rounded text-blue-800 font-mono text-xs text-left"
            >
              <span className="font-bold">{'{ETR}'}</span> - الوقت المتبقي
            </button>
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t">
          <button
            type="submit"
            disabled={isSubmitDisabled}
            className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-2 ${
              isSubmitDisabled
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
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
            }}
            disabled={isLoading}
            className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            إلغاء
          </button>
        </div>
      </form>
    </Modal>
  );
}
