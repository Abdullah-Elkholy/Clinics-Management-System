/**
 * Manage Conditions Modal Component
 * File: apps/web/components/Modals/ManageConditionsModal.tsx
 * 
 * Allows managing message conditions for a specific template
 * Features:
 * - View all conditions for a template
 * - Add new conditions
 * - Edit existing conditions
 * - Delete conditions
 * - Specify which template each condition applies to
 */

'use client';

import { useModal } from '@/contexts/ModalContext';
import { useUI } from '@/contexts/UIContext';
import { useState, useCallback, useMemo } from 'react';
import Modal from './Modal';

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

interface ModalData {
  templateId: string;
  queueId: string;
  queueName: string;
  currentConditions?: QueueMessageCondition[];
  allConditions?: QueueMessageCondition[];
  allTemplates?: Array<{ id: string; title: string }>;
  onSave?: (conditions: QueueMessageCondition[]) => void;
}

export default function ManageConditionsModal() {
  const { openModals, closeModal, getModalData } = useModal();
  const { addToast } = useUI();

  const isOpen = openModals.has('manageConditions');
  const data = getModalData('manageConditions') as ModalData | undefined;

  const [conditions, setConditions] = useState<QueueMessageCondition[]>(
    data?.currentConditions || []
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState<Partial<QueueMessageCondition>>({
    name: '',
    priority: 1,
    enabled: true,
    operator: 'EQUAL',
    value: undefined,
    minValue: undefined,
    maxValue: undefined,
    template: data?.templateId || '',
  });

  const handleAddCondition = useCallback(() => {
    setShowAddForm(true);
    setFormData({
      name: '',
      priority: Math.max(...conditions.map((c) => c.priority), 0) + 1,
      enabled: true,
      operator: 'EQUAL',
      value: undefined,
      minValue: undefined,
      maxValue: undefined,
      template: data?.templateId || '',
    });
  }, [conditions, data?.templateId]);

  const handleEditCondition = useCallback((condition: QueueMessageCondition) => {
    setEditingId(condition.id);
    setFormData(condition);
    setShowAddForm(true);
  }, []);

  const handleSaveCondition = useCallback(() => {
    // Validate form data
    if (!formData.name?.trim()) {
      addToast('الرجاء إدخال اسم الشرط', 'error');
      return;
    }

    if (formData.operator === 'RANGE') {
      if (!formData.minValue || !formData.maxValue) {
        addToast('الرجاء إدخال الحد الأدنى والأقصى للنطاق', 'error');
        return;
      }
      if (formData.minValue >= formData.maxValue) {
        addToast('الحد الأدنى يجب أن يكون أقل من الحد الأقصى', 'error');
        return;
      }
    } else {
      if (!formData.value && formData.value !== 0) {
        addToast('الرجاء إدخال القيمة', 'error');
        return;
      }
    }

    if (editingId) {
      // Update existing condition
      setConditions((prev) =>
        prev.map((c) =>
          c.id === editingId
            ? {
                ...c,
                ...formData,
              }
            : c
        )
      );
      addToast('تم تحديث الشرط بنجاح', 'success');
    } else {
      // Add new condition
      const newCondition: QueueMessageCondition = {
        id: `cond-${Date.now()}`,
        ...(formData as QueueMessageCondition),
      };
      setConditions((prev) => [...prev, newCondition]);
      addToast('تم إضافة الشرط بنجاح', 'success');
    }

    setShowAddForm(false);
    setEditingId(null);
    setFormData({
      name: '',
      priority: 1,
      enabled: true,
      operator: 'EQUAL',
      value: undefined,
      minValue: undefined,
      maxValue: undefined,
      template: data?.templateId || '',
    });
  }, [formData, editingId, data?.templateId, addToast]);

  const handleDeleteCondition = useCallback((id: string) => {
    const ok = window.confirm('هل أنت متأكد من حذف هذا الشرط؟');
    if (ok) {
      setConditions((prev) => prev.filter((c) => c.id !== id));
      addToast('تم حذف الشرط بنجاح', 'success');
    }
  }, [addToast]);

  const handleCancel = useCallback(() => {
    setShowAddForm(false);
    setEditingId(null);
    setFormData({
      name: '',
      priority: 1,
      enabled: true,
      operator: 'EQUAL',
      value: undefined,
      minValue: undefined,
      maxValue: undefined,
      template: data?.templateId || '',
    });
  }, [data?.templateId]);

  const handleSave = useCallback(async () => {
    try {
      setIsLoading(true);
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 500));
      data?.onSave?.(conditions);
      closeModal('manageConditions');
    } finally {
      setIsLoading(false);
    }
  }, [conditions, data, closeModal]);

  const operatorOptions = [
    { value: 'EQUAL', label: 'يساوي' },
    { value: 'GREATER', label: 'أكبر من' },
    { value: 'LESS', label: 'أقل من' },
    { value: 'RANGE', label: 'نطاق' },
  ];

  if (!isOpen || !data) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => closeModal('manageConditions')}
      title={`إدارة شروط الرسالة - ${data.queueName}`}
      size="2xl"
    >
      <div className="flex flex-col h-full space-y-4">
        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs text-blue-800">
            <span className="font-semibold">الشروط المطبقة على هذا القالب:</span> حدد الشروط
            التي تحدد متى يتم استخدام هذا القالب للمرضى المختلفين.
          </p>
        </div>

        {/* Conditions List */}
        <div className="flex-1 overflow-y-auto space-y-3">
          {conditions.length > 0 ? (
            conditions.map((condition) => (
              <div
                key={condition.id}
                className="p-3 border rounded-lg bg-white hover:bg-gray-50 transition"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h4 className="font-semibold text-sm text-gray-800">
                      {condition.name}
                    </h4>
                    <p className="text-xs text-gray-600 mt-1">
                      <span className="font-semibold">المعامل:</span> {condition.operator}
                      {condition.operator === 'RANGE' ? (
                        <span>
                          {' '}
                          (من {condition.minValue} إلى {condition.maxValue})
                        </span>
                      ) : (
                        <span> ({condition.value})</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-600">
                      <span className="font-semibold">الأولوية:</span> {condition.priority}
                    </p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleEditCondition(condition)}
                      disabled={isLoading}
                      className="p-1.5 text-amber-600 bg-amber-50 hover:bg-amber-100 rounded transition disabled:opacity-50"
                      title="تعديل"
                    >
                      <i className="fas fa-edit text-xs"></i>
                    </button>
                    <button
                      onClick={() => handleDeleteCondition(condition.id)}
                      disabled={isLoading}
                      className="p-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded transition disabled:opacity-50"
                      title="حذف"
                    >
                      <i className="fas fa-trash text-xs"></i>
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-gray-500">
              <i className="fas fa-circle-minus text-2xl mb-2 block"></i>
              <p className="text-sm">لا توجد شروط مطبقة على هذا القالب</p>
            </div>
          )}
        </div>

        {/* Add/Edit Form */}
        {showAddForm && (
          <div className="border-t pt-4 space-y-3">
            <h4 className="font-semibold text-sm text-gray-800">
              {editingId ? 'تعديل الشرط' : 'إضافة شرط جديد'}
            </h4>

            {/* Name */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                اسم الشرط *
              </label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="مثال: مرضى الأولوية"
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Template Selection */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                تطبيق الشرط على القالب *
              </label>
              <select
                value={formData.template || ''}
                onChange={(e) =>
                  setFormData({ ...formData, template: e.target.value })
                }
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">اختر قالب</option>
                {data.allTemplates?.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.title}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-600 mt-1">
                <i className="fas fa-info-circle ml-1"></i>
                حدد القالب الذي سيتم استخدامه عند تطبق هذا الشرط
              </p>
            </div>

            {/* Operator */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                المعامل *
              </label>
              <select
                value={formData.operator || 'EQUAL'}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    operator: e.target.value as any,
                    value: undefined,
                    minValue: undefined,
                    maxValue: undefined,
                  })
                }
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {operatorOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Value Inputs */}
            {formData.operator === 'RANGE' ? (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    الحد الأدنى *
                  </label>
                  <input
                    type="number"
                    value={formData.minValue || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        minValue: parseInt(e.target.value) || undefined,
                      })
                    }
                    placeholder="0"
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    الحد الأقصى *
                  </label>
                  <input
                    type="number"
                    value={formData.maxValue || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        maxValue: parseInt(e.target.value) || undefined,
                      })
                    }
                    placeholder="100"
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  القيمة *
                </label>
                <input
                  type="number"
                  value={formData.value || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      value: parseInt(e.target.value) || undefined,
                    })
                  }
                  placeholder="أدخل القيمة"
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            )}

            {/* Priority */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                الأولوية (1 = أعلى أولوية) *
              </label>
              <input
                type="number"
                value={formData.priority || 1}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    priority: parseInt(e.target.value) || 1,
                  })
                }
                min="1"
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Form Buttons */}
            <div className="flex gap-2 pt-2 border-t">
              <button
                onClick={handleSaveCondition}
                disabled={isLoading}
                className="flex-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition disabled:opacity-50 font-medium"
              >
                <i className="fas fa-check ml-1"></i>
                {editingId ? 'تحديث' : 'إضافة'}
              </button>
              <button
                onClick={handleCancel}
                disabled={isLoading}
                className="flex-1 px-3 py-1.5 bg-gray-300 text-gray-700 text-sm rounded hover:bg-gray-400 transition disabled:opacity-50 font-medium"
              >
                إلغاء
              </button>
            </div>
          </div>
        )}

        {/* Add Button */}
        {!showAddForm && (
          <button
            onClick={handleAddCondition}
            disabled={isLoading}
            className="w-full px-3 py-2 bg-blue-50 border-2 border-dashed border-blue-300 text-blue-700 rounded-lg hover:bg-blue-100 transition disabled:opacity-50 font-medium text-sm"
          >
            <i className="fas fa-plus ml-1"></i>
            إضافة شرط جديد
          </button>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t flex-shrink-0">
          <button
            onClick={handleSave}
            disabled={isLoading}
            className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 font-medium disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <i className="fas fa-spinner fa-spin"></i>
                جاري الحفظ...
              </>
            ) : (
              <>
                <i className="fas fa-check"></i>
                حفظ الشروط
              </>
            )}
          </button>
          <button
            onClick={() => closeModal('manageConditions')}
            disabled={isLoading}
            className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400 transition-colors font-medium disabled:opacity-50"
          >
            إلغاء
          </button>
        </div>
      </div>
    </Modal>
  );
}
