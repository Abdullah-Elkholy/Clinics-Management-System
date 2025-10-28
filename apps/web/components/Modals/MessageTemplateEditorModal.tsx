'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { MessageTemplate, MessageTemplateCategory } from '@/types/messageTemplate';
import { MessageCondition } from '@/components/Common/MessageConditionsForm';
import Modal from './Modal';

interface MessageTemplateEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (template: MessageTemplate, conditions?: MessageCondition[]) => Promise<void>;
  template?: MessageTemplate;
  queueId: string;
  queueName: string;
  conditions?: MessageCondition[];
  onConditionsChange?: (conditions: MessageCondition[]) => void;
}

/**
 * Available variables for template insertion
 */
const AVAILABLE_VARIABLES = [
  { code: '{PN}', label: 'اسم المريض', description: 'Patient Name' },
  { code: '{PQP}', label: 'ترتيب المريض', description: 'Patient Queue Position' },
  { code: '{CQP}', label: 'الموضع الحالي في الطابور', description: 'Current Queue Position' },
  { code: '{ETR}', label: 'الوقت المتبقي المقدر', description: 'Estimated Time Remaining' },
  { code: '{DIN}', label: 'اسم الطبيب', description: 'Doctor In Name' },
  { code: '{CIN}', label: 'اسم العيادة', description: 'Clinic Name' },
];

/**
 * Template categories for filtering/organizing
 */
const TEMPLATE_CATEGORIES: { value: MessageTemplateCategory; label: string; icon: string }[] = [
  { value: 'greeting', label: 'ترحيب', icon: 'fa-hand-wave' },
  { value: 'reminder', label: 'تذكير', icon: 'fa-bell' },
  { value: 'alert', label: 'تنبيه', icon: 'fa-exclamation' },
  { value: 'confirmation', label: 'تأكيد', icon: 'fa-check-circle' },
  { value: 'thank_you', label: 'شكر', icon: 'fa-heart' },
  { value: 'custom', label: 'مخصص', icon: 'fa-star' },
];

export default function MessageTemplateEditorModal({
  isOpen,
  onClose,
  onSave,
  template,
  queueId,
  queueName,
  conditions = [],
  onConditionsChange,
}: MessageTemplateEditorModalProps) {
  const isEditing = !!template;

  // Form state
  const [formData, setFormData] = useState<Partial<MessageTemplate>>({
    title: '',
    content: '',
    category: 'custom',
    isActive: true,
    priority: 0,
  });

  const [localConditions, setLocalConditions] = useState<MessageCondition[]>(conditions);
  const [showPreview, setShowPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form with existing template data
  useEffect(() => {
    if (isEditing && template) {
      setFormData({
        title: template.title,
        content: template.content,
        category: template.category || 'custom',
        isActive: template.isActive,
        priority: template.priority || 0,
      });
    } else {
      // Reset form for new template
      setFormData({
        title: '',
        content: '',
        category: 'custom',
        isActive: true,
        priority: 0,
      });
    }
    setError(null);
  }, [template, isEditing, isOpen]);

  /**
   * Extract variables from content
   */
  const extractedVariables = useMemo(() => {
    const variableRegex = /\{([A-Z]+)\}/g;
    const matches = formData.content?.match(variableRegex) || [];
    return [...new Set(matches)];
  }, [formData.content]);

  /**
   * Handle form field changes
   */
  const handleFieldChange = useCallback(
    (field: string, value: any) => {
      setFormData((prev) => ({
        ...prev,
        [field]: value,
      }));
      setError(null);
    },
    []
  );

  /**
   * Insert variable into content
   */
  const insertVariable = useCallback((variable: string) => {
    setFormData((prev) => ({
      ...prev,
      content: (prev.content || '') + variable,
    }));
  }, []);

  /**
   * Handle form submission
   */
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      // Validate required fields
      if (!formData.title?.trim()) {
        setError('العنوان مطلوب');
        return;
      }

      if (!formData.content?.trim()) {
        setError('محتوى الرسالة مطلوب');
        return;
      }

      // Create template object for validation
      const templateToSave: MessageTemplate = {
        id: template?.id || `template_${Date.now()}`,
        queueId,
        title: formData.title,
        content: formData.content,
        category: formData.category as MessageTemplateCategory,
        isActive: formData.isActive ?? true,
        priority: formData.priority ?? 0,
        createdBy: template?.createdBy || 'system',
        createdAt: template?.createdAt || new Date(),
        updatedAt: new Date(),
      };

      // Validate template - just check required fields
      if (!templateToSave.title.trim() || !templateToSave.content.trim()) {
        setError('العنوان والمحتوى مطلوبان');
        return;
      }

      try {
        setIsSaving(true);
        await onSave(templateToSave, localConditions);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'حدث خطأ أثناء حفظ الرسالة');
      } finally {
        setIsSaving(false);
      }
    },
    [formData, template, queueId, extractedVariables, localConditions, onSave, onClose]
  );

  /**
   * Generate preview text
   */
  const previewText = useMemo(() => {
    let preview = formData.content || '';
    preview = preview.replace('{PN}', 'أحمد محمد');
    preview = preview.replace('{PQP}', '5');
    preview = preview.replace('{CQP}', '3');
    preview = preview.replace('{ETR}', '15');
    preview = preview.replace('{DIN}', 'د. فاطمة أحمد');
    preview = preview.replace('{CIN}', queueName);
    return preview;
  }, [formData.content, queueName]);

  /**
   * Get category label
   */
  const getCategoryLabel = (category?: string) => {
    return TEMPLATE_CATEGORIES.find((c) => c.value === category)?.label || 'غير محدد';
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'تعديل قالب الرسالة' : 'إنشاء قالب رسالة جديد'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <i className="fas fa-exclamation-circle text-red-600 mt-1 flex-shrink-0"></i>
            <div>
              <h4 className="font-semibold text-red-900">خطأ</h4>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Success Info */}
        {!error && isEditing && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
            <i className="fas fa-info-circle text-blue-600 mt-1 flex-shrink-0"></i>
            <div>
              <p className="text-sm text-blue-700">تعديل قالب موجود - جميع التغييرات ستحل محل البيانات السابقة</p>
            </div>
          </div>
        )}

        {/* Queue Info */}
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">رمز الطابور</label>
              <p className="text-sm font-mono text-gray-900">{queueId}</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">اسم الطابور</label>
              <p className="text-sm text-gray-900">{queueName}</p>
            </div>
          </div>
        </div>

        {/* Title Field */}
        <div>
          <label htmlFor="title" className="block text-sm font-semibold text-gray-900 mb-2">
            العنوان <span className="text-red-600">*</span>
          </label>
          <input
            id="title"
            type="text"
            value={formData.title || ''}
            onChange={(e) => handleFieldChange('title', e.target.value)}
            placeholder="مثال: رسالة الترحيب"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          />
          <p className="text-xs text-gray-600 mt-1">اسم مختصر وواضح للقالب</p>
        </div>

        {/* Category Field */}
        <div>
          <label htmlFor="category" className="block text-sm font-semibold text-gray-900 mb-2">
            التصنيف
          </label>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {TEMPLATE_CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                type="button"
                onClick={() => handleFieldChange('category', cat.value)}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all ${
                  formData.category === cat.value
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                }`}
                title={cat.label}
              >
                <i className={`fas ${cat.icon} text-lg`}></i>
                <span className="text-xs text-center whitespace-normal">{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content Field with Variables */}
        <div>
          <label htmlFor="content" className="block text-sm font-semibold text-gray-900 mb-2">
            محتوى الرسالة <span className="text-red-600">*</span>
          </label>

          {/* Variable Insertion Buttons */}
          <div className="mb-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-xs font-semibold text-gray-700 mb-2 block">أدرج متغيراً:</p>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_VARIABLES.map((variable) => (
                <button
                  key={variable.code}
                  type="button"
                  onClick={() => insertVariable(variable.code)}
                  className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200 transition-colors font-medium"
                  title={variable.description}
                >
                  {variable.label} <span className="font-mono">{variable.code}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Text Area */}
          <textarea
            id="content"
            value={formData.content || ''}
            onChange={(e) => handleFieldChange('content', e.target.value)}
            placeholder="مثال: مرحباً {PN}, ترتيبك {PQP} والموضع الحالي {CQP}"
            rows={5}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-serif resize-none"
          />

          {/* Character Count and Warnings */}
          <div className="mt-2 flex items-center justify-between">
            <div className="text-xs text-gray-600">
              <span className={formData.content?.length ?? 0 > 160 ? 'text-orange-600 font-semibold' : ''}>
                {formData.content?.length || 0} / 160
              </span>
              {(formData.content?.length ?? 0) > 160 && (
                <span className="text-orange-600 ml-2 flex items-center gap-1">
                  <i className="fas fa-warning"></i>
                  قد تحتاج إلى رسائل متعددة
                </span>
              )}
            </div>
            {extractedVariables.length > 0 && (
              <div className="text-xs text-blue-600 font-medium">
                <i className="fas fa-tags ml-1"></i>
                {extractedVariables.length} متغير مكتشف
              </div>
            )}
          </div>
        </div>

        {/* Preview Section */}
        <div className="border-t pt-4">
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-2"
          >
            <i className={`fas fa-${showPreview ? 'chevron-up' : 'chevron-down'}`}></i>
            {showPreview ? 'إخفاء' : 'عرض'} المعاينة
          </button>

          {showPreview && (
            <div className="mt-3 p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border-2 border-green-200">
              <h4 className="text-xs font-semibold text-green-900 mb-2">📱 معاينة الرسالة</h4>
              <p className="text-sm text-gray-900 leading-relaxed font-serif">{previewText || '(الرسالة فارغة)'}</p>
            </div>
          )}
        </div>

        {/* Priority Field */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="priority" className="block text-sm font-semibold text-gray-900 mb-2">
              الأولوية
            </label>
            <input
              id="priority"
              type="number"
              min="0"
              max="100"
              value={formData.priority || 0}
              onChange={(e) => handleFieldChange('priority', parseInt(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
            <p className="text-xs text-gray-600 mt-1">قيمة أعلى = أولوية أعلى (0-100)</p>
          </div>

          {/* Status Toggle */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">الحالة</label>
            <button
              type="button"
              onClick={() => handleFieldChange('isActive', !formData.isActive)}
              className={`w-full px-4 py-2 rounded-lg font-medium transition-all border-2 flex items-center justify-center gap-2 ${
                formData.isActive
                  ? 'bg-green-100 border-green-300 text-green-800'
                  : 'bg-gray-100 border-gray-300 text-gray-600'
              }`}
            >
              <i className={`fas fa-${formData.isActive ? 'check-circle' : 'circle'}`}></i>
              {formData.isActive ? 'نشط' : 'معطّل'}
            </button>
          </div>
        </div>

        {/* Conditions Summary */}
        {localConditions.length > 0 && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-purple-900 mb-2">الشروط المرتبطة: {localConditions.length}</h4>
            <div className="space-y-1">
              {localConditions.slice(0, 3).map((cond, idx) => (
                <p key={idx} className="text-xs text-purple-700">
                  <i className="fas fa-check ml-1"></i>
                  {cond.type === 'queue_position' && `موضع الطابور ${cond.operator} ${cond.value}`}
                </p>
              ))}
              {localConditions.length > 3 && (
                <p className="text-xs text-purple-700 font-medium">
                  و {localConditions.length - 3} شرط آخر
                </p>
              )}
            </div>
          </div>
        )}

        {/* Form Actions */}
        <div className="flex gap-3 pt-4 border-t">
          <button
            type="submit"
            disabled={isSaving}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
          >
            <i className={`fas fa-${isSaving ? 'spinner fa-spin' : 'save'}`}></i>
            {isSaving ? 'جاري الحفظ...' : isEditing ? 'تحديث' : 'إنشاء'}
          </button>

          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="flex-1 bg-gray-300 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors disabled:opacity-50 font-medium"
          >
            إلغاء
          </button>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
          <h4 className="text-xs font-semibold text-blue-900 flex items-center gap-2">
            <i className="fas fa-lightbulb"></i>
            نصائح:
          </h4>
          <ul className="text-xs text-blue-800 space-y-1">
            <li>• استخدم المتغيرات لتخصيص الرسائل تلقائياً</li>
            <li>• الرسائل الأقصر أفضل للرسائل النصية</li>
            <li>• يمكنك إضافة شروط لإرسال الرسالة تلقائياً</li>
            <li>• استخدم الأولويات لتنظيم القوالب المتعددة</li>
          </ul>
        </div>
      </form>
    </Modal>
  );
}
