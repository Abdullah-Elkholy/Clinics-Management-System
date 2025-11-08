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
import UsageGuideSection from '../Common/UsageGuideSection';
import { ConflictWarning } from '../Common/ConflictBadge';
import { detectOverlappingConditions } from '@/utils/conditionConflictDetector';
// Mock data removed - using API data instead

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
  
  // Filter conditions for this queue from API data
  const queueConditions = useMemo(() => {
    return [];
  }, [queueId]);
  
  // Get templates for this queue from API data
  const queueTemplates = useMemo(() => {
    return [];
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

    // If operator is selected, value/range is required (except for DEFAULT)
    if (formData.operator && formData.operator !== 'DEFAULT') {
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
      title={`إدارة شروط الرسائل - ${queue?.doctorName || data.queueName || 'طابور'}`}
      size="2xl"
    >
      <div className="flex flex-col h-full space-y-4">

        {/* Blocking Alert - Using Reusable ConflictWarning Component */}
        {(overlappingConditions.length > 0 || !conditions.some(c => c.operator === 'DEFAULT')) && (
          <ConflictWarning 
            overlappingConditions={overlappingConditions}
            hasDefaultConflict={!conditions.some(c => c.operator === 'DEFAULT')}
          />
        )}

        {/* Conditions List */}
        <div className="flex-1 overflow-y-auto space-y-3">
          {sortedConditions.length > 0 ? (
            sortedConditions.map((condition) => {
              // Helper function to format condition description
              const getConditionDescription = (cond: QueueMessageCondition) => {
                const operatorLabels: Record<string, string> = {
                  'EQUAL': 'يساوي',
                  'GREATER': 'أكبر من',
                  'LESS': 'أقل من',
                  'RANGE': 'نطاق',
                  'DEFAULT': 'قالب افتراضي',
                };
                
                // Handle no operator (بدون الشرط)
                if (!cond.operator) {
                  return 'بدون الشرط';
                }
                
                if (cond.operator === 'RANGE') {
                  return `${operatorLabels[cond.operator]}: من ${cond.minValue} إلى ${cond.maxValue}`;
                } else if (cond.operator === 'DEFAULT') {
                  return operatorLabels[cond.operator];
                }
                return `${operatorLabels[cond.operator]}: ${cond.value}`;
              };

              const isEditing = editingId === condition.id;
              const isWarningCondition = !condition.operator; // Only warn when NO operator is set
              
              // Check if this condition is part of a conflict
              const isConflictingCondition = overlappingConditions.some(overlap =>
                overlap.description.includes(condition.name || '') || 
                overlap.description.includes(condition.id)
              );
              
              return (
                <div key={condition.id}>
                  {isEditing ? (
                    // Edit Mode - Full tile with form
                    <div className={`border-2 rounded-lg p-3 space-y-3 ${
                      isConflictingCondition
                        ? 'bg-red-50 border-red-400 shadow-lg shadow-red-200'
                        : 'bg-blue-50 border-blue-400 shadow-md'
                    }`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {isWarningCondition && (
                            <i className="fas fa-exclamation-triangle text-amber-600 text-xs flex-shrink-0 mt-0.5"></i>
                          )}
                          {isConflictingCondition && (
                            <i className="fas fa-circle-xmark text-red-600 text-xs flex-shrink-0 mt-0.5"></i>
                          )}
                          <p className="text-sm font-semibold text-gray-800">
                            <span className="text-blue-600">العنوان:</span> {condition.name || 'بدون عنوان'}
                          </p>
                        </div>
                          <p className="text-xs text-gray-600 mt-1">
                            <span className="text-blue-600">الشرط المطبق:</span> {getConditionDescription(condition)}
                          </p>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <button
                            onClick={handleSaveCondition}
                            disabled={isLoading}
                            className="px-3 py-1.5 bg-emerald-600 text-white text-xs rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 font-semibold flex items-center justify-center gap-2 shadow-md whitespace-nowrap"
                          >
                            <i className="fas fa-save"></i>
                            تحديث الشرط
                          </button>
                          <button
                            onClick={handleCancel}
                            disabled={isLoading}
                            className="px-3 py-1.5 bg-slate-400 text-white text-xs rounded-lg hover:bg-slate-500 transition disabled:opacity-50 font-semibold flex items-center justify-center gap-2 shadow-md whitespace-nowrap"
                          >
                            <i className="fas fa-times"></i>
                            إلغاء
                          </button>
                        </div>
                      </div>

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

                      {/* Condition Section */}
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
                        showTemplateSelector={false}
                        errors={formErrors}
                        isLoading={isLoading}
                        hideInfo={false}
                      />
                    </div>
                  ) : (
                    // View Mode - Simple tile with edit button
                    <div
                      onClick={() => handleEditCondition(condition)}
                      className={`p-3 border-2 rounded-lg transition cursor-pointer ${
                        isConflictingCondition
                          ? 'bg-red-50 border-red-400 hover:bg-red-100 shadow-md shadow-red-200'
                          : isWarningCondition
                          ? 'bg-amber-50 border-amber-300 hover:bg-amber-100'
                          : 'bg-white border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {isWarningCondition && (
                              <i className="fas fa-exclamation-triangle text-amber-600 text-xs flex-shrink-0 mt-0.5"></i>
                            )}
                            {isConflictingCondition && (
                              <i className="fas fa-circle-xmark text-red-600 text-xs flex-shrink-0 mt-0.5"></i>
                            )}
                            <p className="text-sm font-semibold text-gray-800">
                              <span className="text-blue-600">العنوان:</span> {condition.name || 'بدون عنوان'}
                            </p>
                          </div>
                          <p className="text-xs text-gray-600 mt-1">
                            <span className="text-blue-600">الشرط المطبق:</span> {getConditionDescription(condition)}
                          </p>
                        </div>
                        <div className="flex gap-2 flex-shrink-0 ml-2 items-center">
                          <span className="text-xs text-amber-600 font-medium">تعديل</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditCondition(condition);
                            }}
                            disabled={isLoading}
                            className="p-1.5 text-amber-600 bg-amber-50 hover:bg-amber-100 rounded transition disabled:opacity-50"
                            title="تعديل"
                          >
                            <i className="fas fa-edit text-xs"></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="text-center py-8 text-gray-500">
              <i className="fas fa-circle-minus text-2xl mb-2 block"></i>
              <p className="text-sm">لا توجد شروط مطبقة على هذا الطابور</p>
            </div>
          )}
        </div>

        {/* Usage Guide */}
        <UsageGuideSection
          items={[
            {
            title: '',
            description: 'جميع القيم يجب أن تكون أكبر من صفر (≥1)',
            },
            {
                title: '',
                description: 'تحدد الشروط كيفية إرسال الرسائل للمرضى',
            },
            {
                title: '',
                description: 'يشترط وجود قالب بقيمة افتراضية لتتمكن من إرسال الرسائل لتفادي الحالات غير المشمولة بأي شرط',
            },
            {
                title: 'بدون شرط',
                description: 'سيصبح هذا بدون شرط محدد ولن يتم استخدامه في الإرسال لحين تغيير هذا الشرط',
            },
            {
              title: 'قالب افتراضي',
              description: 'يشترط إرسال الرسائل وجود قالب افتراضي, يسمح بوجود قالب افتراضي واحد فقط ويتم استخدامه عندما لا تنطبق أي شروط أخرى',
            },
            {
                title: 'نطاق',
                description: 'يجب أن يكون الحد الأدنى أقل من الحد الأقصى',
            },
            {
                title: 'يساوي / أكبر من / أقل من',
                description: 'يتم تطبيق الشرط على قيمة واحدة محددة',
            },
            {
                title: 'تضارب الشروط',
                description: 'الشروط التي تتداخل في القيم المطبقة تسبب تضارباً ويجب تعديلها لتجنب ذلك',
            },
          ]}
        />

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
