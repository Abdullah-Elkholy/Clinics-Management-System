'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useMessageTemplates } from '@/hooks/useMessageTemplates';
import { useCanAccess, useIsAdmin } from '@/hooks/useAuthz';
import { Feature, UserRole } from '@/types/roles';
import RequireFeature from '@/components/Common/RequireFeature';
import { MessageTemplate } from '@/services/messageTemplateService';
import { PanelWrapper } from '@/components/Common/PanelWrapper';
import { PanelHeader } from '@/components/Common/PanelHeader';
import { EmptyState } from '@/components/Common/EmptyState';
import { ResponsiveTable } from '@/components/Common/ResponsiveTable';
import { FormSection, FormField, TextInput, TextArea } from '@/components/Common/FormComponents';
import { Badge, Button } from '@/components/Common/ResponsiveUI';

/**
 * Mock message templates for demonstration/development
 */
const MOCK_MESSAGE_TEMPLATES: MessageTemplate[] = [
  {
    id: '1',
    title: 'رسالة الترحيب',
    content: 'مرحباً {PN}، أهلاً وسهلاً في عيادتنا. ترتيبك {PQP}',
    variables: ['PN', 'PQP'],
    createdBy: 'سيف الدين',
    createdAt: new Date('2025-01-15'),
    updatedAt: new Date('2025-01-20'),
  },
  {
    id: '2',
    title: 'تنبيه دوري المريض',
    content: 'السلام عليكم {PN}، تبقى لك {ETR} دقيقة. الموضع الحالي: {CQP}',
    variables: ['PN', 'ETR', 'CQP'],
    createdBy: 'أحمد علي',
    createdAt: new Date('2025-01-10'),
    updatedAt: new Date('2025-01-22'),
  },
  {
    id: '3',
    title: 'إخطار انتظار المريض',
    content: '{PN} جاهز للفحص. يرجى الحضور إلى العيادة',
    variables: ['PN'],
    createdBy: 'فاطمة محمد',
    createdAt: new Date('2025-01-12'),
    updatedAt: new Date('2025-01-23'),
  },
  {
    id: '4',
    title: 'رسالة الشكر',
    content: 'شكراً لك {PN} على اختيارك عيادتنا. نتطلع لرؤيتك قريباً',
    variables: ['PN'],
    createdBy: 'سيف الدين',
    createdAt: new Date('2025-01-05'),
    updatedAt: new Date('2025-01-25'),
  },
];

/**
 * Messages Panel - Main component for message template management
 * SOLID: Single Responsibility - Orchestrates message template UI
 * SOLID: Open/Closed - Extensible for new message features
 * Enhanced with responsive components and improved UX
 */
export default function MessagesPanel() {
  const [state, actions] = useMessageTemplates();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
  });

  const canCreate = useCanAccess(Feature.CREATE_MESSAGE_TEMPLATE);
  const canEdit = useCanAccess(Feature.EDIT_MESSAGE_TEMPLATE);
  const canDelete = useCanAccess(Feature.DELETE_MESSAGE_TEMPLATE);
  const isAdmin = useIsAdmin();

  // Use mock data if there's an error or no templates
  const displayTemplates = state.error || state.templates.length === 0 ? MOCK_MESSAGE_TEMPLATES : state.templates;

  /**
   * Handle submit form - memoized for optimization
   */
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingId) {
      await actions.updateTemplate(editingId, {
        title: formData.title,
        content: formData.content,
      });
      setEditingId(null);
    } else {
      await actions.createTemplate({
        title: formData.title,
        content: formData.content,
        variables: [],
        createdBy: 'current_user',
      });
    }

    setFormData({ title: '', content: '' });
    setShowCreateForm(false);
  }, [editingId, formData, actions]);

  /**
   * Handle edit button click - memoized
   */
  const handleEdit = useCallback((template: MessageTemplate) => {
    setFormData({ title: template.title, content: template.content });
    setEditingId(template.id);
    setShowCreateForm(true);
  }, []);

  /**
   * Handle delete button click - memoized
   */
  const handleDelete = useCallback(async (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذه الرسالة؟')) {
      await actions.deleteTemplate(id);
    }
  }, [actions]);

  /**
   * Handle cancel - memoized
   */
  const handleCancel = useCallback(() => {
    setShowCreateForm(false);
    setEditingId(null);
    setFormData({ title: '', content: '' });
  }, []);

  /**
   * Memoize table columns configuration
   */
  const tableColumns = useMemo(() => [
    { key: 'title', label: 'العنوان', width: '30%' },
    { key: 'content', label: 'المحتوى', width: '40%' },
    { key: 'createdBy', label: 'بواسطة', width: '15%' },
    { key: 'actions', label: 'الإجراءات', width: '15%' },
  ], []);

  /**
   * Memoize table data rows
   */
  const tableRows = useMemo(() => 
    displayTemplates.map(template => ({
      id: template.id,
      title: template.title,
      content: template.content,
      createdBy: template.createdBy,
      createdAt: template.createdAt instanceof Date 
        ? template.createdAt.toLocaleDateString('ar-EG')
        : new Date(template.createdAt).toLocaleDateString('ar-EG'),
    })), [displayTemplates]
  );

  /**
   * Render row actions for table
   */
  const renderRowActions = useCallback((row: any) => (
    <div className="flex gap-2 justify-center">
      <RequireFeature feature={Feature.EDIT_MESSAGE_TEMPLATE}>
        <button
          onClick={() => {
            const template = displayTemplates.find(t => t.id === row.id);
            if (template) handleEdit(template);
          }}
          className="text-blue-600 hover:text-blue-800 p-2 transition-colors"
          title="تعديل"
        >
          <i className="fas fa-edit"></i>
        </button>
      </RequireFeature>
      <RequireFeature feature={Feature.DELETE_MESSAGE_TEMPLATE}>
        <button
          onClick={() => handleDelete(row.id)}
          className="text-red-600 hover:text-red-800 p-2 transition-colors"
          title="حذف"
        >
          <i className="fas fa-trash"></i>
        </button>
      </RequireFeature>
    </div>
  ), [displayTemplates]);

  return (
    <PanelWrapper isLoading={state.loading && !showCreateForm}>
      <PanelHeader
        title="إدارة الرسائل"
        icon="fa-envelope"
        description="قم بإنشاء وتعديل وحذف قوالب الرسائل المخصصة"
        stats={[
          { label: 'إجمالي الرسائل', value: displayTemplates.length.toString(), color: 'blue' },
        ]}
        actions={
          canCreate ? [
            {
              label: 'إضافة رسالة جديدة',
              icon: 'fa-plus',
              onClick: () => setShowCreateForm(true),
              variant: 'primary',
            },
          ] : []
        }
      />

      {/* Error Alert */}
      {state.error && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <i className="fas fa-info-circle"></i>
            <span>{state.error} - عرض البيانات التجريبية</span>
          </div>
          <button 
            onClick={actions.clearError} 
            className="text-blue-700 hover:text-blue-900 transition-colors"
          >
            ✕
          </button>
        </div>
      )}

      {/* Create/Edit Form */}
      {showCreateForm && (
        <FormSection title={editingId ? 'تعديل الرسالة' : 'إنشاء رسالة جديدة'}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField label="العنوان" required>
              <TextInput
                value={formData.title}
                onChange={(value) => setFormData({ ...formData, title: value })}
                placeholder="مثال: الترحيب بالمريض"
                icon="fa-heading"
              />
            </FormField>

            <FormField
              label="محتوى الرسالة"
              required
              hint="استخدم المتغيرات: {PN} المريض، {PQP} ترتيب، {CQP} الموضع الحالي، {ETR} الوقت"
            >
              <TextArea
                value={formData.content}
                onChange={(value) => setFormData({ ...formData, content: value })}
                placeholder="مثال: مرحباً {PN}، ترتيبك {PQP} والموضع الحالي {CQP}"
                rows={4}
              />
            </FormField>

            <div className="flex gap-2 pt-4">
              <button
                type="submit"
                disabled={state.loading}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <i className="fas fa-save"></i>
                {state.loading ? 'جاري...' : editingId ? 'تحديث' : 'إنشاء'}
              </button>
              <button
                type="button"
                onClick={() => handleCancel()}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors"
              >
                إلغاء
              </button>
            </div>
          </form>
        </FormSection>
      )}

      {/* Empty State */}
      {!state.loading && displayTemplates.length === 0 && !showCreateForm && (
        <EmptyState
          icon="fa-envelope"
          title="لا توجد رسائل مخزنة"
          message="ابدأ بإنشاء قالب رسالة جديد لإرسال الرسائل"
          actionLabel={canCreate ? 'إنشاء رسالة أولى' : undefined}
          onAction={canCreate ? () => setShowCreateForm(true) : undefined}
        />
      )}

      {/* Templates Table */}
      {!state.loading && displayTemplates.length > 0 && !showCreateForm && (
        <ResponsiveTable
          columns={tableColumns}
          data={tableRows}
          keyField="id"
          rowActions={(row) => renderRowActions(row)}
          emptyMessage="لا توجد رسائل"
        />
      )}

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
        <h4 className="font-semibold text-blue-900 flex items-center gap-2">
          <i className="fas fa-info-circle"></i>
          نصائح:
        </h4>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>استخدم المتغيرات لجعل الرسائل ديناميكية وشخصية</li>
          <li>يمكنك إنشاء شروط للرسائل لإرسالها تلقائياً في حالات معينة</li>
          <li>الرسائل ستظهر للمشرفين والمستخدمين عند الحاجة</li>
        </ul>
      </div>
    </PanelWrapper>
  );
}

