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
import { useQueue } from '@/contexts/QueueContext';
import { useState, useCallback, useMemo, useEffect } from 'react';
import Modal from './Modal';
import { ValidationError } from '@/utils/validation';
import { ConditionApplicationSection } from '../Common/ConditionApplicationSection';
import { detectOverlappingConditions } from '@/utils/conditionConflictDetector';
import { MOCK_QUEUE_MESSAGE_CONDITIONS, MOCK_MESSAGE_TEMPLATES } from '@/constants/mockData';

interface QueueMessageCondition {
  id: string;
  name?: string;
  priority: number;
  enabled?: boolean;
  operator: 'EQUAL' | 'GREATER' | 'LESS' | 'RANGE' | 'DEFAULT';
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
  const { queues } = useQueue();

  const isOpen = openModals.has('manageConditions');
  const data = getModalData('manageConditions') as ModalData | undefined;

  // Get queue and template information from mock data
  const queueId = data?.queueId;
  const queue = queues.find(q => q.id === queueId);
  
  // Filter conditions for this queue from mock data
  const queueConditions = useMemo(() => {
    return MOCK_QUEUE_MESSAGE_CONDITIONS.filter(c => c.queueId === queueId);
  }, [queueId]);
  
  // Get templates for this queue from mock data
  const queueTemplates = useMemo(() => {
    return MOCK_MESSAGE_TEMPLATES.filter(t => t.queueId === queueId).map(t => ({
      id: t.id,
      title: t.title
    }));
  }, [queueId]);

  const [conditions, setConditions] = useState<QueueMessageCondition[]>(
    queueConditions ? [...queueConditions].sort((a, b) => a.priority - b.priority) : []
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<ValidationError>({});

  // Sync conditions when queue changes
  useEffect(() => {
    if (queueConditions) {
      setConditions([...queueConditions].sort((a, b) => a.priority - b.priority));
    }
  }, [queueConditions, isOpen]);

  const [formData, setFormData] = useState<Partial<QueueMessageCondition>>({
    name: '',
    priority: 1,
    enabled: true,
    operator: 'EQUAL',
    value: undefined,
    minValue: undefined,
    maxValue: undefined,
    template: '',
  });

  const validateFormData = useCallback((): ValidationError => {
    const errors: ValidationError = {};

    // If operator is selected, value/range is required
    if (formData.operator) {
      if (formData.operator === 'RANGE') {
        if (formData.minValue === undefined || formData.minValue <= 0) {
          errors.minValue = 'الحد الأدنى مطلوب ويجب أن يكون > 0';
        }
        if (formData.maxValue === undefined || formData.maxValue <= 0) {
          errors.maxValue = 'الحد الأقصى مطلوب ويجب أن يكون > 0';
        }
        if (formData.minValue !== undefined && formData.maxValue !== undefined && formData.minValue >= formData.maxValue) {
          errors.range = 'الحد الأدنى يجب أن يكون أقل من الحد الأقصى';
        }
      } else {
        if (formData.value === undefined || formData.value <= 0) {
          errors.value = 'القيمة مطلوبة ويجب أن تكون > 0';
        }
      }
    }

    return errors;
  }, [formData]);

  const handleAddCondition = useCallback(() => {
    setShowAddForm(true);
    setFormErrors({});
    setFormData({
      name: '',
      priority: 1,
      enabled: true,
      operator: 'EQUAL',
      value: undefined,
      minValue: undefined,
      maxValue: undefined,
      template: '',
    });
  }, []);

  const handleEditCondition = useCallback((condition: QueueMessageCondition) => {
    setEditingId(condition.id);
    setFormData(condition);
    setFormErrors({});
    setShowAddForm(true);
  }, []);

  const handleSaveCondition = useCallback(() => {
    const errors = validateFormData();
    setFormErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
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
    setFormErrors({});
    setFormData({
      name: '',
      priority: 1,
      enabled: true,
      operator: 'EQUAL',
      value: undefined,
      minValue: undefined,
      maxValue: undefined,
      template: '',
    });
  }, [formData, editingId, addToast, validateFormData]);

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
    setFormErrors({});
    setFormData({
      name: '',
      priority: 1,
      enabled: true,
      operator: 'EQUAL',
      value: undefined,
      minValue: undefined,
      maxValue: undefined,
      template: '',
    });
  }, []);

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

  /**
   * Get overlapping conditions using utility function
   */
  const overlappingConditions = useMemo(() => {
    return detectOverlappingConditions(conditions as any);
  }, [conditions]);

  /**
   * Sort conditions by priority (1 = highest priority, appears first)
   */
  const sortedConditions = useMemo(() => {
    return [...conditions].sort((a, b) => a.priority - b.priority);
  }, [conditions]);

  if (!isOpen || !data) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => closeModal('manageConditions')}
      title={`إدارة شروط الرسالة - ${queue?.doctorName || data.queueName || 'طابور'}`}
      size="2xl"
    >
      <div className="flex flex-col h-full space-y-4">
        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
          <p className="text-xs text-blue-800">
            <i className="fas fa-info-circle ml-1"></i>
            <span className="font-semibold">الشروط</span> تحدد كيفية إرسال الرسائل للمرضى
          </p>
          <p className="text-xs text-blue-800 border-t border-blue-200 pt-2">
            <i className="fas fa-exclamation-circle ml-1"></i>
            <span className="font-semibold">مهم:</span> يجب أن يكون لديك <span className="font-semibold">قالب رسالة واحد بشرط افتراضي</span> في الطابور لكي تتمكن من إرسال الرسائل
          </p>
        </div>

        {/* Intersection Warning */}
        {overlappingConditions.length > 0 && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <i className="fas fa-exclamation-triangle text-yellow-600 mt-0.5 text-sm flex-shrink-0"></i>
              <div className="flex-1">
                <p className="text-xs font-semibold text-yellow-800 mb-1">⚠️ تحذير: تداخل في الشروط</p>
                <p className="text-xs text-yellow-700 mb-2">
                  تم اكتشاف شروط متداخلة. قد يؤدي هذا إلى سلوك غير متوقع حيث قد يطبق الرسالة أكثر من شرط على نفس المريض:
                </p>
                <ul className="space-y-1">
                  {overlappingConditions.map((overlap, idx) => (
                    <li key={idx} className="text-xs text-yellow-700 flex items-center gap-1">
                      <span className="text-yellow-500">•</span>
                      {overlap.description}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Conditions List */}
        <div className="flex-1 overflow-y-auto space-y-3">
          {sortedConditions.length > 0 ? (
            sortedConditions.map((condition) => (
              <div
                key={condition.id}
                className="p-3 border rounded-lg bg-white hover:bg-gray-50 transition"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-600">
                      {condition.operator === 'RANGE' 
                        ? `${condition.operator}: من ${condition.minValue} إلى ${condition.maxValue}`
                        : `${condition.operator}: ${condition.value}`
                      }
                    </p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0 ml-2">
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
              <p className="text-sm">لا توجد شروط مطبقة على هذا الطابور</p>
            </div>
          )}
        </div>

        {/* Add/Edit Form */}
        {showAddForm && (
          <div className="border-t pt-4 space-y-3">
            <h4 className="font-semibold text-sm text-gray-800">
              {editingId ? 'تعديل الشرط' : 'إضافة شرط جديد'}
            </h4>

            {/* Validation Errors Alert */}
            {Object.keys(formErrors).length > 0 && (
              <div className="bg-red-50 border-2 border-red-400 rounded-lg p-3">
                <p className="text-red-800 font-semibold flex items-center gap-2 mb-2 text-xs">
                  <i className="fas fa-exclamation-circle text-red-600"></i>
                  يرجى تصحيح الأخطاء التالية:
                </p>
                <ul className="space-y-1 text-xs text-red-700">
                  {Object.entries(formErrors).map(([field, error]) => (
                    <li key={field} className="flex items-center gap-2">
                      <span className="inline-block w-1 h-1 bg-red-600 rounded-full"></span>
                      {error}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Message Template Selection - For trace */}
            {queueTemplates && queueTemplates.length > 0 && (
              <>
                <ConditionApplicationSection
                  operator={formData.operator as 'EQUAL' | 'GREATER' | 'LESS' | 'RANGE' | null}
                  value={formData.value}
                  minValue={formData.minValue}
                  maxValue={formData.maxValue}
                  onOperatorChange={(op) => {
                    setFormData((prev) => ({
                      ...prev,
                      operator: op as any,
                      value: undefined,
                      minValue: undefined,
                      maxValue: undefined,
                    }));
                    // Clear range/value errors when operator changes
                    setFormErrors((prev) => {
                      const newErrors = { ...prev };
                      delete newErrors.value;
                      delete newErrors.minValue;
                      delete newErrors.maxValue;
                      delete newErrors.range;
                      return newErrors;
                    });
                  }}
                  onValueChange={(val) => {
                    setFormData((prev) => ({ ...prev, value: val }));
                    if (formErrors.value) {
                      setFormErrors((prev) => {
                        const newErrors = { ...prev };
                        delete newErrors.value;
                        return newErrors;
                      });
                    }
                  }}
                  onMinValueChange={(val) => {
                    setFormData((prev) => ({ ...prev, minValue: val }));
                    if (formErrors.minValue) {
                      setFormErrors((prev) => {
                        const newErrors = { ...prev };
                        delete newErrors.minValue;
                        delete newErrors.range;
                        return newErrors;
                      });
                    }
                  }}
                  onMaxValueChange={(val) => {
                    setFormData((prev) => ({ ...prev, maxValue: val }));
                    if (formErrors.maxValue) {
                      setFormErrors((prev) => {
                        const newErrors = { ...prev };
                        delete newErrors.maxValue;
                        delete newErrors.range;
                        return newErrors;
                      });
                    }
                  }}
                  onAddToast={addToast}
                  showTemplateSelector={true}
                  templates={queueTemplates}
                  selectedTemplate={formData.template || ''}
                  onTemplateChange={(templateId) =>
                    setFormData((prev) => ({ ...prev, template: templateId }))
                  }
                  templateErrors={formErrors}
                  errors={formErrors}
                  isLoading={isLoading}
                  hideInfo={false}
                />
              </>
            )}

            {/* If no templates, show condition section only */}
            {!queueTemplates || queueTemplates.length === 0 && (
              <ConditionApplicationSection
                operator={formData.operator as 'EQUAL' | 'GREATER' | 'LESS' | 'RANGE' | null}
                value={formData.value}
                minValue={formData.minValue}
                maxValue={formData.maxValue}
                onOperatorChange={(op) => {
                  setFormData((prev) => ({
                    ...prev,
                    operator: op as any,
                    value: undefined,
                    minValue: undefined,
                    maxValue: undefined,
                  }));
                  // Clear range/value errors when operator changes
                  setFormErrors((prev) => {
                    const newErrors = { ...prev };
                    delete newErrors.value;
                    delete newErrors.minValue;
                    delete newErrors.maxValue;
                    delete newErrors.range;
                    return newErrors;
                  });
                }}
                onValueChange={(val) => {
                  setFormData((prev) => ({ ...prev, value: val }));
                  if (formErrors.value) {
                    setFormErrors((prev) => {
                      const newErrors = { ...prev };
                      delete newErrors.value;
                      return newErrors;
                    });
                  }
                }}
                onMinValueChange={(val) => {
                  setFormData((prev) => ({ ...prev, minValue: val }));
                  if (formErrors.minValue) {
                    setFormErrors((prev) => {
                      const newErrors = { ...prev };
                      delete newErrors.minValue;
                      delete newErrors.range;
                      return newErrors;
                    });
                  }
                }}
                onMaxValueChange={(val) => {
                  setFormData((prev) => ({ ...prev, maxValue: val }));
                  if (formErrors.maxValue) {
                    setFormErrors((prev) => {
                      const newErrors = { ...prev };
                      delete newErrors.maxValue;
                      delete newErrors.range;
                      return newErrors;
                    });
                  }
                }}
                onAddToast={addToast}
                errors={formErrors}
                isLoading={isLoading}
                hideInfo={false}
              />
            )}

            {/* Form Buttons - Inline with form, distinct styling */}
            <div className="flex gap-2 pt-3 bg-gradient-to-r from-blue-50 to-cyan-50 border-2 border-blue-200 rounded-lg p-3">
              <button
                onClick={handleSaveCondition}
                disabled={isLoading}
                className="flex-1 px-3 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 font-semibold flex items-center justify-center gap-2 shadow-md"
              >
                <i className="fas fa-save"></i>
                {editingId ? 'تحديث الشرط' : 'حفظ الشرط'}
              </button>
              <button
                onClick={handleCancel}
                disabled={isLoading}
                className="flex-1 px-3 py-2 bg-slate-400 text-white text-sm rounded-lg hover:bg-slate-500 transition disabled:opacity-50 font-semibold flex items-center justify-center gap-2 shadow-md"
              >
                <i className="fas fa-times"></i>
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
