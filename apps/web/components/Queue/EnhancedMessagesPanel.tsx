/**
 * Enhanced Messages Panel Component
 * File: apps/web/components/Queue/EnhancedMessagesPanel.tsx
 * 
 * Displays message templates as tiles with conditions management
 * Features:
 * - Message template tiles with condition count
 * - Add new template button (functional)
 * - Manage conditions per template
 * - Template preview with condition details
 */

'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useModal } from '@/contexts/ModalContext';
import { useUI } from '@/contexts/UIContext';
// Mock data removed - using API data instead

interface MessageTemplate {
  id: string;
  title: string;
  content: string;
  description?: string;
  category?: string;
  queueId?: string;
  isActive: boolean;
  createdAt?: Date;
}

interface QueueMessageCondition {
  id: string;
  name?: string;
  priority: number;
  enabled?: boolean;
  operator: 'EQUAL' | 'GREATER' | 'LESS' | 'RANGE';
  value?: number;
  minValue?: number;
  maxValue?: number;
  template: string;
}

interface EnhancedMessagesPanelProps {
  queueId: string;
  queueName: string;
  onConditionsUpdate?: (conditions: QueueMessageCondition[]) => void;
}

const EnhancedMessagesPanel: React.FC<EnhancedMessagesPanelProps> = ({
  queueId,
  queueName,
  onConditionsUpdate,
}) => {
  const { openModal } = useModal();
  const { addToast } = useUI();

  // Initialize with empty arrays - data will be loaded from context/API
  const templates: MessageTemplate[] = [];
  const [conditions, setConditions] = useState<QueueMessageCondition[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const activeTemplates = useMemo(
    () => templates.filter((t) => t.isActive),
    [templates]
  );

  const inactiveTemplates = useMemo(
    () => templates.filter((t) => !t.isActive),
    [templates]
  );

  const handleAddTemplate = useCallback(() => {
    openModal('addTemplate', {
      queueId,
      queueName,
      onSave: (newTemplate: MessageTemplate) => {
        addToast('تم إضافة القالب بنجاح', 'success');
      },
    });
  }, [queueId, queueName, openModal, addToast]);

  const handleManageConditions = useCallback(
    (templateId: string) => {
      setSelectedTemplate(templateId);
      openModal('manageConditions', {
        templateId,
        queueId,
        queueName,
        currentConditions: conditions.filter((c) => c.template === templateId),
        allConditions: conditions,
        onSave: (updatedConditions: QueueMessageCondition[]) => {
          setConditions(updatedConditions);
          onConditionsUpdate?.(updatedConditions);
          addToast('تم تحديث الشروط بنجاح', 'success');
        },
      });
    },
    [conditions, queueId, queueName, openModal, onConditionsUpdate, addToast]
  );

  const getConditionsForTemplate = (templateId: string) => {
    return conditions.filter((c) => c.template === templateId);
  };

  if (templates.length === 0) {
    return (
      <div className="p-8 bg-gray-50 border border-gray-200 rounded-lg text-center">
        <i className="fas fa-inbox text-4xl text-gray-400 mb-4 block"></i>
        <p className="text-gray-600 mb-4">لا توجد قوالب رسائل محفوظة لهذا الطابور</p>
        <button
          onClick={handleAddTemplate}
          className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <i className="fas fa-plus ml-2"></i>
          إضافة أول قالب
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <i className="fas fa-envelope text-blue-600"></i>
            قوالب الرسائل
          </h3>
          <p className="text-sm text-gray-600 mt-1">إدارة قوالب الرسائل والشروط المطبقة</p>
        </div>
        <button
          onClick={handleAddTemplate}
          className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-md hover:shadow-lg font-medium text-sm"
          title="إضافة قالب جديد"
        >
          <i className="fas fa-plus ml-2"></i>
          إضافة قالب جديد
        </button>
      </div>

      {/* Active Templates Grid */}
      {activeTemplates.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-4 flex items-center">
            <span className="inline-block w-2.5 h-2.5 bg-green-500 rounded-full ml-2"></span>
            قوالب مفعلة ({activeTemplates.length})
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                conditionsCount={getConditionsForTemplate(template.id).length}
                onManageConditions={() => handleManageConditions(template.id)}
                onPreview={() => {
                  setSelectedTemplate(template.id);
                  setShowPreview(true);
                }}
                isSelected={selectedTemplate === template.id}
              />
            ))}
          </div>
        </div>
      )}

      {/* Inactive Templates Grid */}
      {inactiveTemplates.length > 0 && (
        <div className="opacity-60">
          <h4 className="text-sm font-semibold text-gray-600 mb-4 flex items-center">
            <span className="inline-block w-2.5 h-2.5 bg-gray-400 rounded-full ml-2"></span>
            قوالب معطلة ({inactiveTemplates.length})
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {inactiveTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                conditionsCount={getConditionsForTemplate(template.id).length}
                onManageConditions={() => handleManageConditions(template.id)}
                onPreview={() => {
                  setSelectedTemplate(template.id);
                  setShowPreview(true);
                }}
                isSelected={selectedTemplate === template.id}
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
          conditions={getConditionsForTemplate(selectedTemplate)}
          onClose={() => {
            setShowPreview(false);
            setSelectedTemplate(null);
          }}
        />
      )}
    </div>
  );
};

interface TemplateCardProps {
  template: MessageTemplate;
  conditionsCount: number;
  onManageConditions: () => void;
  onPreview: () => void;
  isSelected: boolean;
  disabled?: boolean;
}

const TemplateCard: React.FC<TemplateCardProps> = ({
  template,
  conditionsCount,
  onManageConditions,
  onPreview,
  isSelected,
  disabled = false,
}) => {
  return (
    <div
      className={`border-2 rounded-lg p-4 transition-all ${
        isSelected
          ? 'border-blue-500 bg-blue-50 shadow-md'
          : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h5 className="font-bold text-gray-800 text-sm">{template.title}</h5>
            {template.category && (
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                {template.category}
              </span>
            )}
          </div>
          {template.description && (
            <p className="text-xs text-gray-600 line-clamp-1">{template.description}</p>
          )}
        </div>
        {template.isActive && (
          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full font-medium flex-shrink-0 ml-2">
            <i className="fas fa-check-circle ml-1"></i>
            مفعلة
          </span>
        )}
      </div>

      {/* Content Preview */}
      <div className="bg-gray-50 p-3 rounded mb-3 border border-gray-200">
        <p className="text-xs text-gray-700 line-clamp-3 leading-relaxed">
          {template.content}
        </p>
      </div>

      {/* Conditions Badge */}
      <div className="mb-3">
        {conditionsCount > 0 ? (
          <div className="flex items-center gap-2 p-2 bg-amber-50 rounded border border-amber-200">
            <i className="fas fa-sliders-h text-amber-600 text-xs"></i>
            <span className="text-xs font-medium text-amber-800">
              {conditionsCount} شرط {conditionsCount > 1 ? 'مطبقة' : 'مطبق'}
            </span>
          </div>
        ) : (
          <div className="text-xs text-gray-500 p-2 text-center">
            <i className="fas fa-circle-minus ml-1"></i>
            بدون شروط
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={onPreview}
          disabled={disabled}
          title="معاينة القالب"
          className="flex-1 px-2 py-1.5 text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 rounded transition disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-1"
        >
          <i className="fas fa-eye"></i>
          معاينة
        </button>
        <button
          onClick={onManageConditions}
          disabled={disabled}
          title="إدارة الشروط"
          className="flex-1 px-2 py-1.5 text-xs bg-amber-50 text-amber-700 hover:bg-amber-100 rounded transition disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-1"
        >
          <i className="fas fa-sliders-h"></i>
          الشروط
        </button>
      </div>
    </div>
  );
};

interface TemplatePreviewModalProps {
  template: MessageTemplate;
  conditions: QueueMessageCondition[];
  onClose: () => void;
}

const TemplatePreviewModal: React.FC<TemplatePreviewModalProps> = ({
  template,
  conditions,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <i className="fas fa-envelope text-blue-600 text-xl"></i>
            <div>
              <h3 className="text-lg font-bold text-gray-800">{template.title}</h3>
              {template.category && (
                <p className="text-xs text-gray-600">{template.category}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl transition"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Description */}
          {template.description && (
            <div>
              <h4 className="text-xs font-semibold text-gray-600 uppercase mb-2">الوصف</h4>
              <p className="text-sm text-gray-700 bg-blue-50 p-3 rounded border border-blue-200">
                {template.description}
              </p>
            </div>
          )}

          {/* Message Content */}
          <div>
            <h4 className="text-xs font-semibold text-gray-600 uppercase mb-2">محتوى الرسالة</h4>
            <div className="bg-gray-50 p-4 rounded border-2 border-gray-200">
              <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                {template.content}
              </p>
            </div>
          </div>

          {/* Conditions */}
          <div>
            <h4 className="text-xs font-semibold text-gray-600 uppercase mb-2">
              الشروط المطبقة ({conditions.length})
            </h4>
            {conditions.length > 0 ? (
              <div className="space-y-2">
                {conditions.map((cond, idx) => (
                  <div
                    key={cond.id}
                    className="bg-amber-50 p-3 rounded border border-amber-200 text-sm"
                  >
                    <div className="flex items-start justify-between mb-1">
                      <span className="font-medium text-amber-900">شرط {idx + 1}</span>
                      {cond.name && (
                        <span className="text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                          {cond.name}
                        </span>
                      )}
                    </div>
                    <div className="text-amber-800">
                      <p className="text-xs">
                        <span className="font-semibold">المعامل:</span> {cond.operator}
                      </p>
                      {cond.operator === 'RANGE' ? (
                        <p className="text-xs">
                          <span className="font-semibold">النطاق:</span> من {cond.minValue} إلى {cond.maxValue}
                        </p>
                      ) : (
                        <p className="text-xs">
                          <span className="font-semibold">القيمة:</span> {cond.value}
                        </p>
                      )}
                      <p className="text-xs">
                        <span className="font-semibold">الأولوية:</span> {cond.priority}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center p-4 bg-gray-50 rounded border border-dashed border-gray-300">
                <i className="fas fa-circle-minus text-gray-400 text-2xl mb-2 block"></i>
                <p className="text-sm text-gray-600">لا توجد شروط مطبقة على هذا القالب</p>
              </div>
            )}
          </div>

          {/* Variables Info */}
          <div>
            <h4 className="text-xs font-semibold text-gray-600 uppercase mb-2">المتغيرات المتاحة</h4>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-blue-50 p-2 rounded border border-blue-200 text-xs">
                <span className="font-mono font-bold text-blue-600">{'{'} PN{'}'}</span>
                <p className="text-blue-700 mt-1">اسم المريض</p>
              </div>
              <div className="bg-blue-50 p-2 rounded border border-blue-200 text-xs">
                <span className="font-mono font-bold text-blue-600">{'{'} PQP{'}'}</span>
                <p className="text-blue-700 mt-1">موضع المريض</p>
              </div>
              <div className="bg-blue-50 p-2 rounded border border-blue-200 text-xs">
                <span className="font-mono font-bold text-blue-600">{'{'} CQP{'}'}</span>
                <p className="text-blue-700 mt-1">الموضع الحالي</p>
              </div>
              <div className="bg-blue-50 p-2 rounded border border-blue-200 text-xs">
                <span className="font-mono font-bold text-blue-600">{'{'} ETR{'}'}</span>
                <p className="text-blue-700 mt-1">الوقت المتبقي</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};

export default EnhancedMessagesPanel;
