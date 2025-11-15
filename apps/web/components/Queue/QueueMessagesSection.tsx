'use client';

import React, { useState } from 'react';
import { useModal } from '@/contexts/ModalContext';
// Mock data imports removed - using API data from QueueContext

interface QueueMessagesSectionProps {
  queueId: string;
  queueName: string;
  onAdd?: () => void;
}

const QueueMessagesSection: React.FC<QueueMessagesSectionProps> = ({
  queueId,
  queueName,
  onAdd,
}) => {
  const { openModal } = useModal();
  
  // Get templates and conditions from context or props
  // Note: Templates should be loaded from QueueContext when selectedQueueId is set
  const templates: any[] = []; // TODO: Load from QueueContext
  const messageConditions: any[] = []; // TODO: Load from QueueContext
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Filter by isDeleted only (isActive removed)
  const activeTemplates = templates.filter((t) => !t.isDeleted);
  const inactiveTemplates: any[] = []; // No inactive templates - using isDeleted only

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
                onManageConditions={() => {
                  openModal('manageConditions', {
                    queueId,
                    queueName,
                    templates,
                    templateId: template.id,
                  });
                }}
                conditionsCount={messageConditions.filter(
                  (c) => c.template === template.id
                ).length}
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
                onManageConditions={() => {
                  openModal('manageConditions', {
                    queueId,
                    queueName,
                    templates,
                    templateId: template.id,
                  });
                }}
                conditionsCount={messageConditions.filter(
                  (c) => c.template === template.id
                ).length}
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
          conditions={messageConditions.filter((c) => c.template === selectedTemplate)}
        />
      )}
    </div>
  );
};

interface TemplateCardProps {
  template: any;
  isSelected: boolean;
  onSelect: () => void;
  onManageConditions: () => void;
  conditionsCount: number;
  disabled?: boolean;
}

const TemplateCard: React.FC<TemplateCardProps> = ({
  template,
  isSelected,
  onSelect,
  onManageConditions,
  conditionsCount,
  disabled = false,
}) => {
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
        </div>
        {!template.isDeleted && (
          <span className="inline-block px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
            مفعلة
          </span>
        )}
      </div>

      {/* Template Content Preview */}
      <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded mb-3 line-clamp-2">
        {template.content}
      </p>

      {/* Category Badge */}
      {template.category && (
        <div className="flex gap-2 mb-3">
          <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
            {template.category}
          </span>
          {conditionsCount > 0 && (
            <span className="inline-block px-2 py-1 bg-amber-100 text-amber-800 text-xs rounded">
              {conditionsCount} شرط
            </span>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onManageConditions}
          disabled={disabled}
          className="flex-1 px-3 py-2 text-xs bg-amber-100 text-amber-700 rounded hover:bg-amber-200 transition disabled:opacity-50"
          title="إدارة الشروط"
        >
          ⚙️ إدارة الشروط
        </button>
      </div>
    </div>
  );
};

interface TemplatePreviewModalProps {
  template: any;
  onClose: () => void;
  conditions: any[];
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
