/**
 * Enhanced Queue Messages Section Component
 * File: apps/web/components/Queue/EnhancedQueueMessagesSection.tsx
 *
 * Advanced template management with:
 * - Sorting (date, title, usage)
 * - Filtering (active/inactive)
 * - Search
 * - Bulk operations
 */

'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useQueueMessageTemplates } from '@/hooks/useQueueMessageTemplates';
import { useConfirmDialog } from '@/contexts/ConfirmationContext';
import { createDeleteConfirmation } from '@/utils/confirmationHelpers';
import { MessageTemplate } from '@/types/messageTemplate';
import MessageTemplateEditorModalEnhanced from '@/components/Modals/MessageTemplateEditorModalEnhanced';

interface EnhancedQueueMessagesSectionProps {
  queueId: string;
  queueName: string;
  searchTerm?: string;
  filterStatus?: 'all' | 'active' | 'inactive';
  sortBy?: 'date' | 'title' | 'usage';
  onTemplateAdded?: () => void;
  onTemplateUpdated?: () => void;
  onTemplateDeleted?: () => void;
}

const EnhancedQueueMessagesSection: React.FC<EnhancedQueueMessagesSectionProps> = ({
  queueId,
  queueName,
  searchTerm = '',
  filterStatus = 'all',
  sortBy = 'date',
  onTemplateAdded,
  onTemplateUpdated,
  onTemplateDeleted,
}) => {
  const { templates, loading, error, toggleStatus, duplicate, delete: deleteTemplate, createNew, update } =
    useQueueMessageTemplates({
      queueId,
      queueName,
      autoLoad: true,
    });
  const { confirm } = useConfirmDialog();

  // Modal states
  const [showEditorModal, setShowEditorModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);

  // Bulk operation states
  const [selectedTemplates, setSelectedTemplates] = useState<Set<string>>(new Set());
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [bulkAction, setBulkAction] = useState<'delete' | 'activate' | 'deactivate' | null>(null);

  // Filter and sort templates
  const filteredAndSortedTemplates = useMemo(() => {
    let result = [...templates];

    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(term) ||
          t.content.toLowerCase().includes(term)
      );
    }

    // Filter by status
    if (filterStatus !== 'all') {
      result = result.filter((t) => (filterStatus === 'active' ? t.isActive : !t.isActive));
    }

    // Sort
    if (sortBy === 'date') {
      result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sortBy === 'title') {
      result.sort((a, b) => a.title.localeCompare(b.title, 'ar'));
    }

    return result;
  }, [templates, searchTerm, filterStatus, sortBy]);

  // Separate active and inactive templates
  const activeTemplates = filteredAndSortedTemplates.filter((t) => t.isActive);
  const inactiveTemplates = filteredAndSortedTemplates.filter((t) => !t.isActive);

  const handleToggleTemplate = useCallback(
    (templateId: string) => {
      if (selectedTemplates.has(templateId)) {
        selectedTemplates.delete(templateId);
      } else {
        selectedTemplates.add(templateId);
      }
      setSelectedTemplates(new Set(selectedTemplates));
    },
    [selectedTemplates]
  );

  const handleEditTemplate = useCallback((template: MessageTemplate) => {
    setEditingTemplate(template);
    setShowEditorModal(true);
  }, []);

  const handleDeleteTemplate = useCallback(
    async (templateId: string) => {
      const confirmed = await confirm(createDeleteConfirmation('القالب'));
      if (confirmed) {
        await deleteTemplate(templateId);
        onTemplateDeleted?.();
      }
    },
    [deleteTemplate, onTemplateDeleted, confirm]
  );

  const handleDuplicateTemplate = useCallback(
    async (templateId: string) => {
      const template = templates.find((t) => t.id === templateId);
      if (template) {
        await duplicate(templateId, `${template.title} (نسخة)`);
        onTemplateAdded?.();
      }
    },
    [templates, duplicate, onTemplateAdded]
  );

  const handleToggleStatus = useCallback(
    async (templateId: string) => {
      await toggleStatus(templateId);
    },
    [toggleStatus]
  );

  const handleBulkAction = useCallback(async () => {
    const selectedIds = Array.from(selectedTemplates);

    if (bulkAction === 'delete') {
      for (const id of selectedIds) {
        await deleteTemplate(id);
      }
      onTemplateDeleted?.();
    } else if (bulkAction === 'activate' || bulkAction === 'deactivate') {
      for (const id of selectedIds) {
        const template = templates.find((t) => t.id === id);
        if (template && template.isActive !== (bulkAction === 'activate')) {
          await toggleStatus(id);
        }
      }
      onTemplateUpdated?.();
    }

    setSelectedTemplates(new Set());
    setShowBulkDeleteModal(false);
    setBulkAction(null);
  }, [selectedTemplates, bulkAction, templates, deleteTemplate, toggleStatus, onTemplateDeleted, onTemplateUpdated]);

  const handleSaveTemplate = useCallback(
    async (formData: any) => {
      if (editingTemplate) {
        await update(editingTemplate.id, formData);
        onTemplateUpdated?.();
      } else {
        await createNew(formData);
        onTemplateAdded?.();
      }
      setShowEditorModal(false);
      setEditingTemplate(null);
    },
    [editingTemplate, update, createNew, onTemplateUpdated, onTemplateAdded]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-sm text-gray-600">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-800 text-sm flex items-center gap-2">
          <i className="fas fa-exclamation-circle"></i>
          {error}
        </p>
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="p-6 bg-gray-50 border border-gray-200 rounded-lg text-center">
        <i className="fas fa-inbox text-4xl text-gray-400 mb-3"></i>
        <p className="text-gray-600 mb-4">لا توجد قوالب رسائل لهذا الطابور</p>
        <button
          onClick={() => {
            setEditingTemplate(null);
            setShowEditorModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <i className="fas fa-plus"></i>
          إضافة قالب جديد
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          onClick={() => {
            setEditingTemplate(null);
            setShowEditorModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <i className="fas fa-plus"></i>
          إضافة قالب
        </button>

        {selectedTemplates.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">تم تحديد {selectedTemplates.size}</span>
            <button
              onClick={() => {
                setBulkAction('activate');
                setShowBulkDeleteModal(true);
              }}
              className="px-3 py-1 bg-green-100 text-green-800 rounded text-sm hover:bg-green-200 transition-colors flex items-center gap-1"
            >
              <i className="fas fa-check-circle"></i>
              تفعيل
            </button>
            <button
              onClick={() => {
                setBulkAction('deactivate');
                setShowBulkDeleteModal(true);
              }}
              className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded text-sm hover:bg-yellow-200 transition-colors flex items-center gap-1"
            >
              <i className="fas fa-ban"></i>
              تعطيل
            </button>
            <button
              onClick={() => {
                setBulkAction('delete');
                setShowBulkDeleteModal(true);
              }}
              className="px-3 py-1 bg-red-100 text-red-800 rounded text-sm hover:bg-red-200 transition-colors flex items-center gap-1"
            >
              <i className="fas fa-trash"></i>
              حذف
            </button>
            <button
              onClick={() => setSelectedTemplates(new Set())}
              className="px-3 py-1 bg-gray-100 text-gray-800 rounded text-sm hover:bg-gray-200 transition-colors"
            >
              إلغاء
            </button>
          </div>
        )}
      </div>

      {/* Active Templates Section */}
      {activeTemplates.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <h4 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
              <i className="fas fa-check-circle text-green-600"></i>
              الرسائل النشطة ({activeTemplates.length})
            </h4>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {activeTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                isSelected={selectedTemplates.has(template.id)}
                onToggleSelect={() => handleToggleTemplate(template.id)}
                onEdit={() => handleEditTemplate(template)}
                onDelete={() => handleDeleteTemplate(template.id)}
                onDuplicate={() => handleDuplicateTemplate(template.id)}
                onToggleStatus={() => handleToggleStatus(template.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Inactive Templates Section */}
      {inactiveTemplates.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <h4 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
              <i className="fas fa-circle-xmark text-gray-400"></i>
              الرسائل المعطلة ({inactiveTemplates.length})
            </h4>
          </div>

          <div className="grid grid-cols-1 gap-3 opacity-75">
            {inactiveTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                isSelected={selectedTemplates.has(template.id)}
                onToggleSelect={() => handleToggleTemplate(template.id)}
                onEdit={() => handleEditTemplate(template)}
                onDelete={() => handleDeleteTemplate(template.id)}
                onDuplicate={() => handleDuplicateTemplate(template.id)}
                onToggleStatus={() => handleToggleStatus(template.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* No Results Message */}
      {filteredAndSortedTemplates.length === 0 && (
        <div className="p-6 bg-gray-50 border border-gray-200 rounded-lg text-center">
          <i className="fas fa-search text-3xl text-gray-400 mb-3"></i>
          <p className="text-gray-600">لا توجد نتائج مطابقة لمعايير البحث</p>
        </div>
      )}

      {/* Modals */}
      {showEditorModal && (
        <MessageTemplateEditorModalEnhanced
          template={editingTemplate || undefined}
          queueId={queueId}
          queueName={queueName}
          onClose={() => {
            setShowEditorModal(false);
            setEditingTemplate(null);
          }}
          onSave={handleSaveTemplate}
        />
      )}

      {/* Bulk Action Confirmation Modal */}
      {showBulkDeleteModal && bulkAction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              {bulkAction === 'delete' && 'تأكيد الحذف'}
              {bulkAction === 'activate' && 'تفعيل الرسائل'}
              {bulkAction === 'deactivate' && 'تعطيل الرسائل'}
            </h3>
            <p className="text-gray-700 mb-6">
              {bulkAction === 'delete' &&
                `هل أنت متأكد من حذف ${selectedTemplates.size} قالب رسالة؟ لا يمكن التراجع عن هذا الإجراء.`}
              {bulkAction === 'activate' &&
                `هل تريد تفعيل ${selectedTemplates.size} قالب رسالة؟`}
              {bulkAction === 'deactivate' &&
                `هل تريد تعطيل ${selectedTemplates.size} قالب رسالة؟`}
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleBulkAction}
                className={`flex-1 px-4 py-2 rounded-lg text-white font-medium transition-colors ${
                  bulkAction === 'delete'
                    ? 'bg-red-600 hover:bg-red-700'
                    : bulkAction === 'activate'
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-yellow-600 hover:bg-yellow-700'
                }`}
              >
                تأكيد
              </button>
              <button
                onClick={() => {
                  setShowBulkDeleteModal(false);
                  setBulkAction(null);
                }}
                className="flex-1 px-4 py-2 rounded-lg bg-gray-200 text-gray-800 font-medium hover:bg-gray-300 transition-colors"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Template Card Component
 */
interface TemplateCardProps {
  template: MessageTemplate;
  isSelected: boolean;
  onToggleSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onToggleStatus: () => void;
}

const TemplateCard: React.FC<TemplateCardProps> = ({
  template,
  isSelected,
  onToggleSelect,
  onEdit,
  onDelete,
  onDuplicate,
  onToggleStatus,
}) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelect}
          className="rounded cursor-pointer mt-1"
        />

        {/* Card Content */}
        <div className="flex-1 min-w-0">
          {/* Title and Status */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1">
              <h5 className="font-semibold text-gray-900 truncate">{template.title}</h5>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {/* Status Badge */}
                <span
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                    template.isActive
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  <i
                    className={`fas fa-circle text-xs ${
                      template.isActive ? 'text-green-600' : 'text-gray-600'
                    }`}
                  ></i>
                  {template.isActive ? 'نشط' : 'معطل'}
                </span>
              </div>
            </div>
          </div>

          {/* Content Preview */}
          <p className="text-sm text-gray-600 line-clamp-2 mb-3">{template.content}</p>

          {/* Stats */}
          <div className="flex items-center gap-4 text-xs text-gray-600 mb-3">
            <div className="flex items-center gap-1">
              <i className="fas fa-calendar"></i>
              {new Date(template.createdAt).toLocaleDateString('ar-EG')}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={onEdit}
              title="تعديل"
              className="p-2 text-green-600 hover:bg-green-50 rounded transition-colors"
            >
              <i className="fas fa-edit text-sm"></i>
            </button>
            <button
              onClick={onDuplicate}
              title="نسخ"
              className="p-2 text-purple-600 hover:bg-purple-50 rounded transition-colors"
            >
              <i className="fas fa-copy text-sm"></i>
            </button>
            <button
              onClick={onToggleStatus}
              title={template.isActive ? 'تعطيل' : 'تفعيل'}
              className={`p-2 rounded transition-colors ${
                template.isActive
                  ? 'text-yellow-600 hover:bg-yellow-50'
                  : 'text-green-600 hover:bg-green-50'
              }`}
            >
              <i className={`fas ${template.isActive ? 'fa-ban' : 'fa-check'} text-sm`}></i>
            </button>
            <button
              onClick={onDelete}
              title="حذف"
              className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
            >
              <i className="fas fa-trash text-sm"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedQueueMessagesSection;
