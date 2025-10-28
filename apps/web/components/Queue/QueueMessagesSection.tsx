/**
 * Queue Messages Section Component
 * File: apps/web/components/Queue/QueueMessagesSection.tsx
 * 
 * Displays message templates and conditions for a specific queue
 * Features:
 * - Grouped templates display
 * - Add/Edit/Delete buttons for templates
 * - Template conditions display
 * - Template preview
 * - Active/Inactive status toggle
 */

'use client';

import React, { useState, useCallback } from 'react';
import { useQueueMessageTemplates } from '@/hooks/useQueueMessageTemplates';
import { useQueueMessageConfig } from '@/hooks/useQueueMessageConfig';
import { MessageTemplate } from '@/services/messageTemplateService';
import { MessageCondition } from '@/types/messageCondition';

interface QueueMessagesSectionProps {
  queueId: string;
  queueName: string;
  conditions?: MessageCondition[];
  onEdit?: (template: MessageTemplate) => void;
  onDelete?: (templateId: string) => void;
  onAdd?: () => void;
}

const QueueMessagesSection: React.FC<QueueMessagesSectionProps> = ({
  queueId,
  queueName,
  conditions = [],
  onEdit,
  onDelete,
  onAdd,
}) => {
  const { templates, loading, error, toggleStatus, duplicate } = useQueueMessageTemplates({
    queueId,
    queueName,
    autoLoad: true,
  });

  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const activeTemplates = templates.filter((t) => t.isActive);
  const inactiveTemplates = templates.filter((t) => !t.isActive);

  const handleToggleStatus = useCallback(
    async (templateId: string) => {
      await toggleStatus(templateId);
    },
    [toggleStatus]
  );

  const handleDuplicate = useCallback(
    async (templateId: string) => {
      const template = templates.find((t) => t.id === templateId);
      if (template) {
        await duplicate(templateId, `${template.title} (نسخة)`);
      }
    },
    [templates, duplicate]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-800">{error}</p>
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="p-8 bg-gray-50 border border-gray-200 rounded-lg text-center">
        <p className="text-gray-600 mb-4">لا توجد رسائل محفوظة لهذا الطابور</p>
        <button
          onClick={onAdd}
          className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <span className="mr-2">+</span>
          إضافة رسالة
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Add Button */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">رسائل الطابور ({templates.length})</h3>
        <button
          onClick={onAdd}
          className="inline-flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm"
        >
          <span className="ml-2">+</span>
          إضافة رسالة
        </button>
      </div>

      {/* Active Templates Section */}
      {activeTemplates.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
            <span className="inline-block w-3 h-3 bg-green-500 rounded-full ml-2"></span>
            الرسائل المفعلة ({activeTemplates.length})
          </h4>
          <div className="grid grid-cols-1 gap-3">
            {activeTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                isSelected={selectedTemplate === template.id}
                onSelect={() => setSelectedTemplate(template.id)}
                onEdit={() => onEdit?.(template)}
                onDelete={() => onDelete?.(template.id)}
                onToggleStatus={() => handleToggleStatus(template.id)}
                onDuplicate={() => handleDuplicate(template.id)}
                onPreview={() => {
                  setSelectedTemplate(template.id);
                  setShowPreview(true);
                }}
                conditionsCount={conditions.filter((c) => c.template === template.id).length}
              />
            ))}
          </div>
        </div>
      )}

      {/* Inactive Templates Section */}
      {inactiveTemplates.length > 0 && (
        <div className="opacity-60">
          <h4 className="text-sm font-semibold text-gray-600 mb-3 flex items-center">
            <span className="inline-block w-3 h-3 bg-gray-400 rounded-full ml-2"></span>
            الرسائل المعطلة ({inactiveTemplates.length})
          </h4>
          <div className="grid grid-cols-1 gap-3">
            {inactiveTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                isSelected={selectedTemplate === template.id}
                onSelect={() => setSelectedTemplate(template.id)}
                onEdit={() => onEdit?.(template)}
                onDelete={() => onDelete?.(template.id)}
                onToggleStatus={() => handleToggleStatus(template.id)}
                onDuplicate={() => handleDuplicate(template.id)}
                onPreview={() => {
                  setSelectedTemplate(template.id);
                  setShowPreview(true);
                }}
                conditionsCount={conditions.filter((c) => c.template === template.id).length}
                disabled
              />
            ))}
          </div>
        </div>
      )}

      {/* Template Preview Modal */}
      {showPreview && selectedTemplate && (
        <TemplatePreviewModal
          template={templates.find((t) => t.id === selectedTemplate)!}
          onClose={() => setShowPreview(false)}
          conditions={conditions}
        />
      )}
    </div>
  );
};

interface TemplateCardProps {
  template: MessageTemplate;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleStatus: () => void;
  onDuplicate: () => void;
  onPreview: () => void;
  conditionsCount: number;
  disabled?: boolean;
}

const TemplateCard: React.FC<TemplateCardProps> = ({
  template,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  onToggleStatus,
  onDuplicate,
  onPreview,
  conditionsCount,
  disabled = false,
}) => {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  return (
    <div
      onClick={onSelect}
      className={`p-4 border-2 rounded-lg cursor-pointer transition ${
        isSelected
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-200 bg-white hover:border-blue-300'
      } ${disabled ? 'opacity-50' : ''}`}
    >
      {/* Template Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <h5 className="font-semibold text-gray-800">{template.title}</h5>
          {template.description && (
            <p className="text-xs text-gray-500 mt-1">{template.description}</p>
          )}
        </div>
        {template.isActive && (
          <span className="inline-block px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
            مفعلة
          </span>
        )}
      </div>

      {/* Template Content Preview */}
      <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded mb-3 line-clamp-2">
        {template.content}
      </p>

      {/* Metadata */}
      <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
        <div className="flex gap-4">
          <span>
            {template.createdAt && (
              new Date(template.createdAt).toLocaleDateString('ar-SA')
            )}
          </span>
          {conditionsCount > 0 && (
            <span className="text-blue-600 font-medium">
              {conditionsCount} شرط{conditionsCount > 1 ? 'ة' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onPreview}
          className="flex-1 px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition"
          title="معاينة"
        >
          👁️ معاينة
        </button>
        <button
          onClick={onEdit}
          disabled={disabled}
          className="flex-1 px-3 py-1 text-xs bg-amber-100 text-amber-700 rounded hover:bg-amber-200 transition disabled:opacity-50"
          title="تعديل"
        >
          ✏️ تعديل
        </button>
        <button
          onClick={onDuplicate}
          disabled={disabled}
          className="flex-1 px-3 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition disabled:opacity-50"
          title="نسخ"
        >
          📋 نسخ
        </button>
        <button
          onClick={onToggleStatus}
          className={`flex-1 px-3 py-1 text-xs rounded transition ${
            template.isActive
              ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              : 'bg-green-100 text-green-700 hover:bg-green-200'
          }`}
          title={template.isActive ? 'تعطيل' : 'تفعيل'}
        >
          {template.isActive ? '⊘ تعطيل' : '✓ تفعيل'}
        </button>
        <button
          onClick={() => setShowConfirmDelete(true)}
          disabled={disabled}
          className="flex-1 px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition disabled:opacity-50"
          title="حذف"
        >
          🗑️ حذف
        </button>
      </div>

      {/* Delete Confirmation */}
      {showConfirmDelete && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
          <p className="text-sm text-red-800 mb-2">هل أنت متأكد من حذف هذه الرسالة؟</p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                onDelete();
                setShowConfirmDelete(false);
              }}
              className="flex-1 px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
            >
              نعم، احذفها
            </button>
            <button
              onClick={() => setShowConfirmDelete(false)}
              className="flex-1 px-3 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

interface TemplatePreviewModalProps {
  template: MessageTemplate;
  onClose: () => void;
  conditions: MessageCondition[];
}

const TemplatePreviewModal: React.FC<TemplatePreviewModalProps> = ({
  template,
  onClose,
  conditions,
}) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">{template.title}</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="space-y-4">
          {template.description && (
            <div>
              <p className="text-xs text-gray-600 mb-1">الوصف</p>
              <p className="text-sm text-gray-700">{template.description}</p>
            </div>
          )}

          <div>
            <p className="text-xs text-gray-600 mb-1">محتوى الرسالة</p>
            <p className="text-sm bg-blue-50 p-3 rounded text-gray-800 leading-relaxed">
              {template.content}
            </p>
          </div>

          <div>
            <p className="text-xs text-gray-600 mb-2">الشروط المرتبطة</p>
            {conditions.length > 0 ? (
              <div className="space-y-2">
                {conditions.map((cond, idx) => (
                  <div
                    key={idx}
                    className="text-xs bg-amber-50 p-2 rounded text-gray-700"
                  >
                    شرط {idx + 1}: {cond.operator} {cond.value || `${cond.minValue}-${cond.maxValue}`}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500">لا توجد شروط</p>
            )}
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full mt-6 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          إغلاق
        </button>
      </div>
    </div>
  );
};

export default QueueMessagesSection;
