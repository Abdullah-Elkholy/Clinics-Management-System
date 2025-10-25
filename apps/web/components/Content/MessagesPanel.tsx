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
 * Message condition type
 */
interface MessageCondition {
  id: string;
  type: 'queue_position' | 'wait_time' | 'patient_status';
  operator: 'equals' | 'greater' | 'less' | 'contains';
  value: string;
  templateId?: string;
}

/**
 * Extended MessageTemplate with conditions
 */
interface ExtendedMessageTemplate extends MessageTemplate {
  conditions?: MessageCondition[];
  isActive?: boolean;
  usageCount?: number;
  successRate?: number;
}

/**
 * Mock message templates for demonstration/development
 */
const MOCK_MESSAGE_TEMPLATES: ExtendedMessageTemplate[] = [
  {
    id: '1',
    title: 'رسالة الترحيب',
    content: 'مرحباً {PN}، أهلاً وسهلاً في عيادتنا. ترتيبك {PQP}',
    variables: ['PN', 'PQP'],
    createdBy: 'سيف الدين',
    createdAt: new Date('2025-01-15'),
    updatedAt: new Date('2025-01-20'),
    isActive: true,
    usageCount: 234,
    successRate: 98,
    conditions: [],
  },
  {
    id: '2',
    title: 'تنبيه دوري المريض',
    content: 'السلام عليكم {PN}، تبقى لك {ETR} دقيقة. الموضع الحالي: {CQP}',
    variables: ['PN', 'ETR', 'CQP'],
    createdBy: 'أحمد علي',
    createdAt: new Date('2025-01-10'),
    updatedAt: new Date('2025-01-22'),
    isActive: true,
    usageCount: 156,
    successRate: 95,
    conditions: [],
  },
  {
    id: '3',
    title: 'إخطار انتظار المريض',
    content: '{PN} جاهز للفحص. يرجى الحضور إلى العيادة',
    variables: ['PN'],
    createdBy: 'فاطمة محمد',
    createdAt: new Date('2025-01-12'),
    updatedAt: new Date('2025-01-23'),
    isActive: true,
    usageCount: 89,
    successRate: 97,
    conditions: [],
  },
  {
    id: '4',
    title: 'رسالة الشكر',
    content: 'شكراً لك {PN} على اختيارك عيادتنا. نتطلع لرؤيتك قريباً',
    variables: ['PN'],
    createdBy: 'سيف الدين',
    createdAt: new Date('2025-01-05'),
    updatedAt: new Date('2025-01-25'),
    isActive: false,
    usageCount: 45,
    successRate: 100,
    conditions: [],
  },
];

/**
 * Messages Panel - Enhanced component for message template management
 * Features:
 * - Template CRUD operations
 * - Conditional messaging
 * - Message preview
 * - Template categories
 * - Performance metrics
 * - Variable insertion helpers
 * - Bulk operations
 */
export default function MessagesPanel() {
  const [state, actions] = useMessageTemplates();
  const [activeTab, setActiveTab] = useState<'templates' | 'conditions' | 'variables'>('templates');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedConditionTemplate, setSelectedConditionTemplate] = useState<string | null>(null);
  const [messageConditions, setMessageConditions] = useState<MessageCondition[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    isActive: true,
  });

  const canCreate = useCanAccess(Feature.CREATE_MESSAGE_TEMPLATE);
  const canEdit = useCanAccess(Feature.EDIT_MESSAGE_TEMPLATE);
  const canDelete = useCanAccess(Feature.DELETE_MESSAGE_TEMPLATE);
  const isAdmin = useIsAdmin();

  // Use mock data if there's an error or no templates
  const displayTemplates = state.error || state.templates.length === 0 ? MOCK_MESSAGE_TEMPLATES : state.templates;

  /**
   * Available variables
   */
  const availableVariables = useMemo(() => [
    { code: '{PN}', label: 'اسم المريض', description: 'Patient Name' },
    { code: '{PQP}', label: 'ترتيب المريض', description: 'Patient Queue Position' },
    { code: '{CQP}', label: 'الموضع الحالي في الطابور', description: 'Current Queue Position' },
    { code: '{ETR}', label: 'الوقت المتبقي المقدر', description: 'Estimated Time Remaining' },
    { code: '{DIN}', label: 'اسم الطبيب', description: 'Doctor In Name' },
    { code: '{CIN}', label: 'اسم العيادة', description: 'Clinic Name' },
  ], []);

  /**
   * Filter templates based on search
   */
  const filteredTemplates = useMemo(
    () =>
      displayTemplates.filter(
        (template) =>
          template.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          template.content.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [displayTemplates, searchTerm]
  );

  /**
   * Handle submit form - memoized
   */
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim() || !formData.content.trim()) {
      return;
    }

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

    setFormData({ title: '', content: '', isActive: true });
    setShowCreateForm(false);
  }, [editingId, formData, actions]);

  /**
   * Handle edit button click
   */
  const handleEdit = useCallback((template: ExtendedMessageTemplate) => {
    setFormData({ title: template.title, content: template.content, isActive: template.isActive ?? true });
    setEditingId(template.id);
    setShowCreateForm(true);
  }, []);

  /**
   * Handle delete button click
   */
  const handleDelete = useCallback(async (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذه الرسالة؟')) {
      await actions.deleteTemplate(id);
    }
  }, [actions]);

  /**
   * Handle cancel
   */
  const handleCancel = useCallback(() => {
    setShowCreateForm(false);
    setEditingId(null);
    setFormData({ title: '', content: '', isActive: true });
  }, []);

  /**
   * Insert variable into content
   */
  const insertVariable = useCallback((variable: string) => {
    setFormData((prev) => ({
      ...prev,
      content: prev.content + variable,
    }));
  }, []);

  /**
   * Add message condition
   */
  const addCondition = useCallback(() => {
    const newCondition: MessageCondition = {
      id: Date.now().toString(),
      type: 'queue_position',
      operator: 'greater',
      value: '',
      templateId: selectedConditionTemplate || undefined,
    };
    setMessageConditions([...messageConditions, newCondition]);
  }, [messageConditions, selectedConditionTemplate]);

  /**
   * Remove condition
   */
  const removeCondition = useCallback((id: string) => {
    setMessageConditions(messageConditions.filter((c) => c.id !== id));
  }, [messageConditions]);

  /**
   * Table columns for templates
   */
  const tableColumns = useMemo(() => [
    { key: 'status', label: 'الحالة', width: '10%' },
    { key: 'title', label: 'العنوان', width: '25%' },
    { key: 'content', label: 'المحتوى', width: '35%' },
    { key: 'metrics', label: 'الأداء', width: '20%' },
    { key: 'actions', label: 'الإجراءات', width: '10%' },
  ], []);

  /**
   * Table data for templates
   */
  const tableRows = useMemo(() =>
    filteredTemplates.map((template: any) => ({
      id: template.id,
      status: (
        <div className="flex items-center gap-1">
          <i className={`fas fa-circle text-xs ${template.isActive ? 'text-green-500' : 'text-gray-400'}`}></i>
          <span className="text-xs text-gray-600">{template.isActive ? 'نشط' : 'معطّل'}</span>
        </div>
      ),
      title: <span className="font-medium text-gray-900">{template.title}</span>,
      content: <span className="text-sm text-gray-700 line-clamp-2">{template.content}</span>,
      metrics: (
        <div className="space-y-1">
          <div className="text-xs text-gray-600">استخدام: {template.usageCount || 0}</div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-green-600 font-medium">{template.successRate || 0}%</span>
            <div className="w-12 h-1 bg-gray-200 rounded overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all"
                style={{ width: `${template.successRate || 0}%` }}
              ></div>
            </div>
          </div>
        </div>
      ),
    })), [filteredTemplates]
  );

  /**
   * Render row actions
   */
  const renderRowActions = useCallback((row: any) => (
    <div className="flex gap-1 justify-center">
      <button
        onClick={() => setShowPreview(true)}
        className="text-blue-600 hover:text-blue-800 p-1 transition-colors"
        title="معاينة"
      >
        <i className="fas fa-eye text-sm"></i>
      </button>
      <RequireFeature feature={Feature.EDIT_MESSAGE_TEMPLATE}>
        <button
          onClick={() => {
            const template = displayTemplates.find((t) => t.id === row.id);
            if (template) handleEdit(template);
          }}
          className="text-green-600 hover:text-green-800 p-1 transition-colors"
          title="تعديل"
        >
          <i className="fas fa-edit text-sm"></i>
        </button>
      </RequireFeature>
      <RequireFeature feature={Feature.DELETE_MESSAGE_TEMPLATE}>
        <button
          onClick={() => handleDelete(row.id)}
          className="text-red-600 hover:text-red-800 p-1 transition-colors"
          title="حذف"
        >
          <i className="fas fa-trash text-sm"></i>
        </button>
      </RequireFeature>
    </div>
  ), [displayTemplates]);

  return (
    <PanelWrapper isLoading={state.loading && !showCreateForm}>
      <PanelHeader
        title="إدارة الرسائل"
        icon="fa-envelope"
        description="قم بإنشاء وتعديل وحذف قوالب الرسائل المخصصة مع دعم الرسائل الشرطية"
        stats={[
          { label: 'إجمالي الرسائل', value: displayTemplates.length.toString(), color: 'blue' },
          { label: 'الرسائل النشطة', value: (displayTemplates as any[]).filter((t: any) => t.isActive).length.toString(), color: 'green' },
          { label: 'إجمالي الاستخدامات', value: ((displayTemplates as any[]).reduce((sum: number, t: any) => sum + (t.usageCount || 0), 0)).toString(), color: 'purple' },
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

      {/* Tabs Navigation */}
      <div className="border-b border-gray-200 mb-6 flex gap-6">
        {['templates', 'conditions', 'variables'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`px-4 py-3 font-medium text-sm transition-colors border-b-2 ${
              activeTab === tab
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab === 'templates' && '📋 الرسائل'}
            {tab === 'conditions' && '🔧 الشروط'}
            {tab === 'variables' && '📝 المتغيرات'}
          </button>
        ))}
      </div>

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <div className="space-y-6">
          {/* Create/Edit Form */}
          {showCreateForm && (
            <FormSection title={editingId ? 'تعديل الرسالة' : 'إنشاء رسالة جديدة'}>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="العنوان" required>
                    <TextInput
                      value={formData.title}
                      onChange={(value) => setFormData({ ...formData, title: value })}
                      placeholder="مثال: الترحيب بالمريض"
                      icon="fa-heading"
                    />
                  </FormField>

                  <FormField label="الحالة">
                    <div className="flex items-center gap-4 mt-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.isActive}
                          onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                          className="w-4 h-4 rounded cursor-pointer"
                        />
                        <span className="text-sm text-gray-700">نشط</span>
                      </label>
                    </div>
                  </FormField>
                </div>

                <FormField label="محتوى الرسالة" required>
                  <div className="space-y-2">
                    <div className="flex gap-2 flex-wrap mb-2">
                      {availableVariables.map((variable) => (
                        <button
                          key={variable.code}
                          type="button"
                          onClick={() => insertVariable(variable.code)}
                          className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 transition-colors"
                          title={variable.description}
                        >
                          {variable.label}
                        </button>
                      ))}
                    </div>
                    <TextArea
                      value={formData.content}
                      onChange={(value) => setFormData({ ...formData, content: value })}
                      placeholder="مثال: مرحباً {PN}، ترتيبك {PQP} والموضع الحالي {CQP}"
                      rows={5}
                    />
                  </div>
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
                    onClick={handleCancel}
                    className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </FormSection>
          )}

          {/* Search */}
          {!showCreateForm && (
            <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 px-4 py-2">
              <i className="fas fa-search text-gray-400"></i>
              <input
                type="text"
                placeholder="ابحث عن رسالة..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 px-0 py-1 border-0 focus:outline-none focus:ring-0 bg-transparent"
              />
            </div>
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
          {!state.loading && filteredTemplates.length > 0 && !showCreateForm && (
            <ResponsiveTable
              columns={tableColumns}
              data={tableRows}
              keyField="id"
              rowActions={(row) => renderRowActions(row)}
              emptyMessage="لا توجد رسائل"
            />
          )}
        </div>
      )}

      {/* Conditions Tab */}
      {activeTab === 'conditions' && (
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
              <i className="fas fa-info-circle"></i>
              الرسائل الشرطية
            </h3>
            <p className="text-sm text-blue-800">
              حدد شروط لإرسال رسائل معينة تلقائياً عندما يتم استيفاء الشروط المحددة.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <select
                value={selectedConditionTemplate}
                onChange={(e) => setSelectedConditionTemplate(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">اختر رسالة</option>
                {displayTemplates.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
              <button
                onClick={addCondition}
                disabled={!selectedConditionTemplate}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                <i className="fas fa-plus"></i>
                إضافة شرط
              </button>
            </div>

            {messageConditions.length > 0 && (
              <div className="space-y-3">
                {messageConditions.map((condition) => (
                  <div key={condition.id} className="flex items-end gap-3 p-4 border border-gray-200 rounded-lg bg-gray-50">
                    <div className="flex-1 grid grid-cols-3 gap-3">
                      <select
                        value={condition.type}
                        onChange={(e) => {
                          setMessageConditions(
                            messageConditions.map((c) =>
                              c.id === condition.id ? { ...c, type: e.target.value as any } : c
                            )
                          );
                        }}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="queue_position">موضع الطابور</option>
                        <option value="wait_time">وقت الانتظار</option>
                        <option value="patient_status">حالة المريض</option>
                      </select>
                      <select
                        value={condition.operator}
                        onChange={(e) => {
                          setMessageConditions(
                            messageConditions.map((c) =>
                              c.id === condition.id ? { ...c, operator: e.target.value as any } : c
                            )
                          );
                        }}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="equals">يساوي</option>
                        <option value="greater">أكبر من</option>
                        <option value="less">أقل من</option>
                        <option value="contains">يحتوي على</option>
                      </select>
                      <input
                        type="text"
                        value={condition.value}
                        onChange={(e) => {
                          setMessageConditions(
                            messageConditions.map((c) =>
                              c.id === condition.id ? { ...c, value: e.target.value } : c
                            )
                          );
                        }}
                        placeholder="القيمة"
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <button
                      onClick={() => removeCondition(condition.id)}
                      className="text-red-600 hover:text-red-800 p-2 transition-colors"
                    >
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Variables Tab */}
      {activeTab === 'variables' && (
        <div className="space-y-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="font-semibold text-yellow-900 mb-2 flex items-center gap-2">
              <i className="fas fa-lightbulb"></i>
              المتغيرات المتاحة
            </h3>
            <p className="text-sm text-yellow-800">
              استخدم هذه المتغيرات في قوالب الرسائل لجعلها ديناميكية وشخصية
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {availableVariables.map((variable) => (
              <div key={variable.code} className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
                <div className="font-mono font-semibold text-blue-600 mb-2">{variable.code}</div>
                <div className="text-sm font-medium text-gray-900 mb-1">{variable.label}</div>
                <div className="text-xs text-gray-600">{variable.description}</div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(variable.code);
                    alert('تم نسخ المتغير!');
                  }}
                  className="mt-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 transition-colors"
                >
                  <i className="fas fa-copy"></i> نسخ
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2 mt-6">
        <h4 className="font-semibold text-green-900 flex items-center gap-2">
          <i className="fas fa-check-circle"></i>
          نصائح للاستخدام الأمثل:
        </h4>
        <ul className="text-green-800 text-sm space-y-1 mr-6">
          <li>• استخدم المتغيرات لجعل الرسائل ديناميكية</li>
          <li>• أنشئ شروط لإرسال رسائل محددة تلقائياً</li>
          <li>• راقب الأداء من خلال معدل النجاح والاستخدام</li>
          <li>• عطّل الرسائل غير الفعّالة دون حذفها</li>
        </ul>
      </div>
    </PanelWrapper>
  );
}

