'use client';

import { formatLocalDateTime } from '@/utils/dateTimeUtils';

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { MessageTemplate } from '@/types/messageTemplate';

interface MessageTemplateEditorModalProps {
  template?: MessageTemplate;
  queueId: string;
  queueName: string;
  onClose: () => void;
  onSave: (formData: any) => Promise<void>;
}

/**
 * Available variables for template insertion
 */
const AVAILABLE_VARIABLES = [
  { code: '{PN}', label: 'اسم المريض', description: 'Patient Name', example: 'أحمد محمد' },
  {
    code: '{PQP}',
    label: 'ترتيب المريض',
    description: 'Patient Queue Position',
    example: '5',
  },
  {
    code: '{CQP}',
    label: 'الموضع الحالي في العيادة',
    description: 'Current Queue Position',
    example: '3',
  },
  {
    code: '{ETR}',
    label: 'الوقت المتبقي المقدر',
    description: 'Estimated Time Remaining',
    example: '15 دقيقة',
  },
  {
    code: '{CN}',
    label: 'اسم العيادة',
    description: 'Clinic Name',
    example: 'عيادة الأسنان',
  },
];
/**
 * Variable Validation Rules
 */
const VARIABLE_VALIDATION_RULES: Record<string, any> = {
  '{PN}': { context: 'Personalization' },
  '{PQP}': { context: 'Queue Info' },
  '{CQP}': { context: 'Queue Info' },
  '{ETR}': { context: 'Timing' },
  '{CN}': { context: 'Clinic Info' },
};

export default function MessageTemplateEditorModal({
  template,
  queueId,
  queueName,
  onClose,
  onSave,
}: MessageTemplateEditorModalProps) {
  const isEditing = !!template;
  const MAX_CONTENT_LENGTH = 1000;

  // Form state
  const [formData, setFormData] = useState<Partial<MessageTemplate>>({
    title: '',
    content: '',
    isActive: true,
    priority: 0,
  });

  const [showPreview, setShowPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showVariableHelp, setShowVariableHelp] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [versionHistory, setVersionHistory] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const contentRef = useRef<HTMLTextAreaElement | null>(null);
  const [selection, setSelection] = useState({ start: 0, end: 0 });

  // Initialize form with existing template data
  useEffect(() => {
    if (isEditing && template) {
      setFormData({
        title: template.title,
        content: template.content,
        isActive: template.isActive,
        priority: template.priority || 0,
      });

      // Add to version history
      setVersionHistory([
        {
          id: template.id,
          title: template.title,
          content: template.content,
          createdAt: template.updatedAt,
          version: 'Aktif',
        },
      ]);
    } else {
      // Reset form for new template
      setFormData({
        title: '',
        content: '',
        isActive: true,
        priority: 0,
      });
      setVersionHistory([]);
    }
    setError(null);
  }, [template, isEditing]);

  /**
   * Extract and validate variables from content
   */
  const variableAnalysis = useMemo(() => {
    const variableRegex = /\{([A-Z]+)\}/g;
    const content = formData.content || '';
    const matches = content.match(variableRegex) || [];
    const count: Record<string, number> = {};

    matches.forEach((match) => {
      count[match] = (count[match] || 0) + 1;
    });

    // Validate usage
    const issues: Array<{ variable: string; issue: string; severity: 'warn' | 'error' }> = [];

    // Check for invalid variables
    const invalidVars = Object.keys(count).filter((v) => !VARIABLE_VALIDATION_RULES[v]);
    if (invalidVars.length > 0) {
      issues.push({
        variable: invalidVars.join(', '),
        issue: 'متغيرات غير معروفة',
        severity: 'error',
      });
    }

    return {
      used: Object.keys(count),
      count,
      issues,
      isValid: issues.every((i) => i.severity !== 'error'),
    };
  }, [formData.content]);

  /**
   * Handle form field changes
   */
  const handleFieldChange = useCallback((field: string, value: any) => {
    if (field === 'content') {
      if (value.length <= MAX_CONTENT_LENGTH) {
        setFormData((prev) => ({
          ...prev,
          [field]: value,
        }));
        if (error) {
          setError(null);
        }
      } else {
        setError(`الحد الأقصى ${MAX_CONTENT_LENGTH} حرف`);
      }
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    setError(null);
  }, [error]);

  const updateSelection = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    setSelection({ start: el.selectionStart ?? 0, end: el.selectionEnd ?? 0 });
  }, []);

  /**
   * Insert variable into content
   */
  const insertVariable = useCallback((variable: string) => {
    const content = formData.content || '';
    const el = contentRef.current;
    const start = el ? (el.selectionStart ?? content.length) : selection.start;
    const end = el ? (el.selectionEnd ?? content.length) : selection.end;
    const safeStart = Math.min(start, content.length);
    const safeEnd = Math.min(end, content.length);
    const nextContent = content.slice(0, safeStart) + variable + content.slice(safeEnd);
    if (nextContent.length > MAX_CONTENT_LENGTH) {
      setError(`الحد الأقصى ${MAX_CONTENT_LENGTH} حرف`);
      return;
    }

    setFormData((prev) => ({
      ...prev,
      content: nextContent,
    }));
    if (error) {
      setError(null);
    }

    const nextCaret = safeStart + variable.length;
    requestAnimationFrame(() => {
      const nextEl = contentRef.current;
      if (!nextEl) return;
      nextEl.focus();
      nextEl.setSelectionRange(nextCaret, nextCaret);
      setSelection({ start: nextCaret, end: nextCaret });
    });
  }, [formData.content, selection.start, selection.end, error]);

  /**
   * Generate preview text with mock data
   */
  const previewText = useMemo(() => {
    let preview = formData.content || '';
    const mockData: Record<string, string> = {
      '{PN}': 'أحمد محمد',
      '{PQP}': '5',
      '{CQP}': '3',
      '{ETR}': '15 دقيقة',
      '{CN}': queueName,
    };

    Object.entries(mockData).forEach(([key, value]) => {
      preview = preview.replace(new RegExp(key, 'g'), value);
    });

    return preview;
  }, [formData.content, queueName]);

  /**
   * Load previous version
   */
  const loadVersion = useCallback((versionId: string) => {
    const version = versionHistory.find((v) => v.id === versionId);
    if (version) {
      setFormData({
        title: version.title,
        content: version.content,
        isActive: formData.isActive,
        priority: formData.priority,
      });
      setSelectedTemplate(null);
    }
  }, [versionHistory, formData]);

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

      // Validate variables
      if (!variableAnalysis.isValid) {
        setError('تحتوي الرسالة على متغيرات غير صحيحة');
        return;
      }

      try {
        setIsSaving(true);
        await onSave({
          title: formData.title,
          content: formData.content,
          isActive: formData.isActive,
          priority: formData.priority,
        });
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'حدث خطأ أثناء حفظ الرسالة');
      } finally {
        setIsSaving(false);
      }
    },
    [formData, variableAnalysis, onSave, onClose]
  );

  /**
   * Duplicate template with modification
   */
  const duplicateWithModification = useCallback(() => {
    setFormData((prev) => ({
      ...prev,
      title: `${prev.title} (نسخة)`,
      id: undefined,
    }));
  }, []);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-800 text-white px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">
              {isEditing ? '✏️ تعديل قالب الرسالة' : '📝 إنشاء قالب رسالة جديد'}
            </h2>
            <p className="text-sm text-blue-100 mt-1">{queueName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-blue-700 rounded-full p-2 transition-colors"
          >
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 p-6">
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

          {/* Title Field */}
          <div>
            <label htmlFor="templateEditor-title" className="block text-sm font-semibold text-gray-900 mb-2">
              العنوان <span className="text-red-600">*</span>
            </label>
            <input
              id="templateEditor-title"
              name="title"
              type="text"
              value={formData.title || ''}
              onChange={(e) => handleFieldChange('title', e.target.value)}
              placeholder="مثال: رسالة الترحيب"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-600 mt-1">اسم مختصر وواضح للقالب</p>
          </div>

          {/* Content Field with Advanced Variables */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="templateEditor-content" className="block text-sm font-semibold text-gray-900">
                محتوى الرسالة <span className="text-red-600">*</span>
              </label>
              <button
                type="button"
                onClick={() => setShowVariableHelp(!showVariableHelp)}
                className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <i className="fas fa-question-circle"></i>
                {showVariableHelp ? 'إخفاء' : 'المتغيرات'}
              </button>
            </div>

            {/* Variable Help */}
            {showVariableHelp && (
              <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-xs font-semibold text-blue-900 mb-2">المتغيرات المتاحة:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {AVAILABLE_VARIABLES.map((variable) => (
                    <div
                      key={variable.code}
                      className="flex items-start justify-between p-2 bg-white rounded border border-blue-100 hover:border-blue-300 transition-colors"
                    >
                      <div className="flex-1">
                        <p className="text-xs font-mono text-blue-700">{variable.code}</p>
                        <p className="text-xs text-gray-700">{variable.label}</p>
                        <p className="text-xs text-gray-500 italic">مثال: {variable.example}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => insertVariable(variable.code)}
                        className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 ml-1"
                      >
                        إدراج
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Insert Buttons */}
            <div className="mb-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-xs font-semibold text-gray-700 mb-2">إدراج سريع:</p>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_VARIABLES.map((variable) => (
                  <button
                    key={variable.code}
                    type="button"
                    onClick={() => insertVariable(variable.code)}
                    className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200 transition-colors font-medium"
                    title={variable.description}
                  >
                    {variable.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Text Area */}
            <textarea
              id="templateEditor-content"
              name="content"
              value={formData.content || ''}
              onChange={(e) => {
                handleFieldChange('content', e.target.value);
                updateSelection();
              }}
              onSelect={updateSelection}
              onClick={updateSelection}
              onKeyUp={updateSelection}
              placeholder="مثال: مرحباً {PN}, ترتيبك {PQP} والموضع الحالي {CQP}"
              rows={5}
              ref={contentRef}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-serif resize-none"
            />

            {/* Variable Validation Warnings */}
            {variableAnalysis.issues.length > 0 && (
              <div className="mt-3 space-y-2">
                {variableAnalysis.issues.map((issue, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg flex items-start gap-2 ${
                      issue.severity === 'error'
                        ? 'bg-red-50 border border-red-200'
                        : 'bg-yellow-50 border border-yellow-200'
                    }`}
                  >
                    <i
                      className={`fas mt-1 flex-shrink-0 ${
                        issue.severity === 'error'
                          ? 'fa-exclamation-circle text-red-600'
                          : 'fa-warning text-yellow-600'
                      }`}
                    ></i>
                    <p
                      className={`text-sm ${
                        issue.severity === 'error' ? 'text-red-700' : 'text-yellow-700'
                      }`}
                    >
                      {issue.issue}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Character Count */}
            <div className="mt-2 flex items-center justify-between">
              <div className="text-xs text-gray-600">
                <span
                  className={
                    (formData.content?.length ?? 0) > 500 ? 'text-orange-600 font-semibold' : ''
                  }
                >
                  {formData.content?.length || 0} / {MAX_CONTENT_LENGTH}
                </span>
              </div>
              {variableAnalysis.used.length > 0 && (
                <div className="text-xs text-blue-600 font-medium">
                  <i className="fas fa-tags ml-1"></i>
                  {variableAnalysis.used.length} متغير
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
                <p className="text-sm text-gray-900 leading-relaxed font-serif">
                  {previewText || '(الرسالة فارغة)'}
                </p>
              </div>
            )}
          </div>

          {/* Priority and Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="templateEditor-priority" className="block text-sm font-semibold text-gray-900 mb-2">الأولوية</label>
              <input
                id="templateEditor-priority"
                name="priority"
                type="number"
                min="0"
                max="100"
                value={formData.priority || 0}
                onChange={(e) => handleFieldChange('priority', parseInt(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-600 mt-1">0-100</p>
            </div>

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

          {/* Version History - if editing */}
          {isEditing && versionHistory.length > 1 && (
            <div>
              <button
                type="button"
                onClick={() => setShowVersionHistory(!showVersionHistory)}
                className="text-sm text-purple-600 hover:text-purple-800 font-medium flex items-center gap-2"
              >
                <i className={`fas fa-${showVersionHistory ? 'chevron-up' : 'chevron-down'}`}></i>
                سجل الإصدارات ({versionHistory.length})
              </button>

              {showVersionHistory && (
                <div className="mt-3 space-y-2 p-3 bg-purple-50 rounded-lg border border-purple-200">
                  {versionHistory.map((version) => (
                    <button
                      key={version.id}
                      type="button"
                      onClick={() => loadVersion(version.id)}
                      className={`w-full text-left p-2 rounded transition-colors ${
                        selectedTemplate === version.id
                          ? 'bg-purple-200 border-l-4 border-purple-600'
                          : 'bg-white hover:bg-purple-100'
                      }`}
                    >
                      <p className="text-xs font-semibold text-gray-900">{version.title}</p>
                      <p className="text-xs text-gray-600 mt-1 line-clamp-1">{version.content}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatLocalDateTime(version.createdAt)}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Form Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 font-medium flex items-center justify-center gap-2"
            >
              <i className={`fas fa-${isSaving ? 'spinner fa-spin' : 'save'}`}></i>
              {isSaving ? 'جاري الحفظ...' : isEditing ? 'تحديث' : 'إنشاء'}
            </button>

            {isEditing && (
              <button
                type="button"
                onClick={duplicateWithModification}
                className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors font-medium flex items-center justify-center gap-2"
              >
                <i className="fas fa-copy"></i>
                نسخ للتعديل
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 bg-gray-300 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors font-medium"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

