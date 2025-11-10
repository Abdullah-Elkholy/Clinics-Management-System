/**
 * Manage Conditions Modal Component (REFACTORED)
 * File: apps/web/components/Modals/ManageConditionsModal.tsx
 * 
 * Per-Template State Management
 * - Shows all templates with their state: افتراضي / بدون شرط / active rule
 * - State derived from (isDefault, hasCondition) pair
 * - Allows toggling active condition ↔ placeholder without deleting condition entity
 * - Calls refreshQueueData() on modal close to reload from backend
 * 
 * Features:
 * - View all templates with status badges
 * - Toggle condition: hasCondition true ↔ false (active ↔ placeholder)
 * - Set template as default: isDefault=true + hasCondition=false
 * - Edit active conditions
 * - Detect overlaps between active conditions
 */

'use client';

import { useModal } from '@/contexts/ModalContext';
import { useUI } from '@/contexts/UIContext';
import { useQueue } from '@/contexts/QueueContext';
import { useState, useCallback, useMemo, useEffect } from 'react';
import { messageApiClient } from '@/services/api/messageApiClient';
import Modal from './Modal';
import { ValidationError } from '@/utils/validation';
import { ConditionApplicationSection } from '../Common/ConditionApplicationSection';
import UsageGuideSection from '../Common/UsageGuideSection';
import { ConflictWarning } from '../Common/ConflictBadge';
import { detectOverlappingConditions } from '@/utils/conditionConflictDetector';

import type { MessageCondition } from '@/types/messageCondition';
import type { MessageTemplate } from '@/types/messageTemplate';

interface ModalData {
  queueId: string;
  queueName: string;
  onSave?: (templates: MessageTemplate[]) => void;
}

/**
 * Get display status for a template based on (isDefault, hasCondition) pair
 */
function getTemplateStatus(template: MessageTemplate): {
  label: string;
  color: string;
  icon: string;
  description: string;
} {
  if (template.isDefault && !template.hasCondition) {
    return {
      label: 'افتراضي',
      color: 'bg-blue-100 text-blue-800 border-blue-300',
      icon: 'fa-star',
      description: 'قالب افتراضي (بدون شرط مخصص)',
    };
  }
  if (!template.isDefault && !template.hasCondition) {
    return {
      label: 'بدون شرط',
      color: 'bg-gray-100 text-gray-800 border-gray-300',
      icon: 'fa-ban',
      description: 'قالب بدون شرط مخصص',
    };
  }
  if (!template.isDefault && template.hasCondition) {
    return {
      label: 'شرط مخصص',
      color: 'bg-green-100 text-green-800 border-green-300',
      icon: 'fa-check-circle',
      description: 'قالب له شرط مخصص',
    };
  }
  // Should not reach here (invalid state: isDefault=true && hasCondition=true)
  return {
    label: 'خطأ',
    color: 'bg-red-100 text-red-800 border-red-300',
    icon: 'fa-exclamation-triangle',
    description: 'حالة غير صحيحة (قالب افتراضي مع شرط)',
  };
}

/**
 * Get condition display text for active conditions
 */
function getConditionDisplayText(condition: MessageCondition | undefined): string {
  if (!condition) return '';
  
  if (condition.operator === 'DEFAULT' || !condition.operator) {
    return '';
  }
  
  const operatorLabels: Record<string, string> = {
    'EQUAL': 'يساوي',
    'GREATER': 'أكبر من',
    'LESS': 'أقل من',
    'RANGE': 'من...إلى',
  };
  
  const label = operatorLabels[condition.operator] || condition.operator;
  
  if (condition.operator === 'RANGE') {
    return `${label}: ${condition.minValue} - ${condition.maxValue}`;
  }
  return `${label}: ${condition.value}`;
}

export default function ManageConditionsModal() {
  const { openModals, closeModal, getModalData } = useModal();
  const { addToast } = useUI();
  const {
    queues,
    messageConditions,
    messageTemplates,
    selectedQueueId,
    updateMessageCondition,
    refreshQueueData,
  } = useQueue();

  const isOpen = openModals.has('manageConditions');
  const data = getModalData('manageConditions') as ModalData | undefined;

  // Get queue info
  const queueId = data?.queueId;
  const queue = queues.find(q => q.id === queueId);

  // Filter templates for this queue
  const queueTemplates: MessageTemplate[] = useMemo(
    () => messageTemplates.filter(t => t.queueId === queueId),
    [messageTemplates, queueId]
  );

  // Map templates to conditions
  const templateConditionMap = useMemo(() => {
    const map = new Map<string, MessageCondition>();
    messageConditions.forEach(c => {
      if (c.templateId) {
        map.set(c.templateId, c);
      }
    });
    return map;
  }, [messageConditions]);

  // State for modal
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<ValidationError>({});
  const [formData, setFormData] = useState<Partial<MessageCondition>>({
    operator: 'EQUAL',
    value: undefined,
    minValue: undefined,
    maxValue: undefined,
  });

  const validateFormData = useCallback((): ValidationError => {
    const errors: ValidationError = {};

    if (formData.operator && formData.operator !== 'DEFAULT' && formData.operator !== 'EQUAL') {
      if (formData.operator === 'RANGE') {
        if (formData.minValue === undefined || formData.minValue <= 0) {
          errors.minValue = 'الحد الأدنى مطلوب ويجب أن يكون > 0';
        }
        if (formData.maxValue === undefined || formData.maxValue <= 0) {
          errors.maxValue = 'الحد الأقصى مطلوب ويجب أن يكون > 0';
        }
        if (
          formData.minValue !== undefined &&
          formData.maxValue !== undefined &&
          formData.minValue >= formData.maxValue
        ) {
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

  const handleEditCondition = useCallback((template: MessageTemplate) => {
    const condition = templateConditionMap.get(template.id);
    if (condition) {
      setEditingTemplateId(template.id);
      setFormData({
        operator: condition.operator as any,
        value: condition.value,
        minValue: condition.minValue,
        maxValue: condition.maxValue,
      });
      setFormErrors({});
    }
  }, [templateConditionMap]);

  const handleSaveCondition = useCallback(async () => {
    const errors = validateFormData();
    setFormErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    try {
      setIsLoading(true);

      const template = queueTemplates.find(t => t.id === editingTemplateId);
      if (!template) throw new Error('لم يتم العثور على القالب');

      const condition = templateConditionMap.get(template.id);
      if (!condition) throw new Error('لم يتم العثور على الشرط');

      const conditionBackendId = Number(condition.id);
      if (isNaN(conditionBackendId)) throw new Error('معرف الشرط غير صالح');

      // Update condition
      await messageApiClient.updateCondition(conditionBackendId, {
        operator: formData.operator as string,
        value: formData.value,
        minValue: formData.minValue,
        maxValue: formData.maxValue,
      });

      // Update local state
      updateMessageCondition(condition.id, {
        operator: formData.operator as any,
        value: formData.value,
        minValue: formData.minValue,
        maxValue: formData.maxValue,
      });

      addToast('تم تحديث الشرط بنجاح', 'success');
      setEditingTemplateId(null);
      setFormErrors({});
    } catch (err: any) {
      addToast(err?.message || 'حدث خطأ أثناء حفظ الشرط', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [
    validateFormData,
    formData,
    editingTemplateId,
    queueTemplates,
    templateConditionMap,
    updateMessageCondition,
    addToast,
  ]);

  const handleSetAsDefault = useCallback(async (template: MessageTemplate) => {
    if (template.isDefault) {
      addToast('هذا القالب محدد بالفعل كافتراضي', 'info');
      return;
    }

    try {
      setIsLoading(true);
      const templateBackendId = Number(template.id);
      if (isNaN(templateBackendId)) throw new Error('معرف القالب غير صالح');

      // Call backend to set as default
      await messageApiClient.setTemplateAsDefault(templateBackendId);

      addToast('تم تحديد هذا القالب كافتراضي', 'success');
      
      // Refresh queue data to get updated state from backend
      if (selectedQueueId) {
        await refreshQueueData(selectedQueueId);
      }
    } catch (err: any) {
      addToast(err?.message || 'حدث خطأ أثناء تحديد القالب الافتراضي', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [selectedQueueId, refreshQueueData, addToast]);

  const handleToggleCondition = useCallback(async (template: MessageTemplate) => {
    const condition = templateConditionMap.get(template.id);
    if (!condition) return;

    // If currently active (hasCondition=true), convert to placeholder (hasCondition=false)
    // If currently placeholder (hasCondition=false), conversion is manual via edit form

    if (template.hasCondition) {
      // Convert active to placeholder
      try {
        setIsLoading(true);
        const conditionBackendId = Number(condition.id);
        if (isNaN(conditionBackendId)) throw new Error('معرف الشرط غير صالح');

        // Update to placeholder: EQUAL operator, null values
        await messageApiClient.updateCondition(conditionBackendId, {
          operator: 'EQUAL',
          value: undefined,
          minValue: undefined,
          maxValue: undefined,
        });

        updateMessageCondition(condition.id, {
          operator: 'EQUAL',
          value: undefined,
          minValue: undefined,
          maxValue: undefined,
        });

        addToast('تم تحويل الشرط إلى بدون شرط بنجاح', 'success');
        
        // Refresh to get hasCondition=false
        if (selectedQueueId) {
          await refreshQueueData(selectedQueueId);
        }
      } catch (err: any) {
        addToast(err?.message || 'حدث خطأ أثناء إزالة الشرط', 'error');
      } finally {
        setIsLoading(false);
      }
    }
  }, [templateConditionMap, updateMessageCondition, selectedQueueId, refreshQueueData, addToast]);

  const handleCancel = useCallback(() => {
    setEditingTemplateId(null);
    setFormErrors({});
    setFormData({
      operator: 'EQUAL',
      value: undefined,
      minValue: undefined,
      maxValue: undefined,
    });
  }, []);

  // Close modal and refresh data
  const handleClose = useCallback(async () => {
    // Refresh queue data before closing to ensure UI is in sync
    if (selectedQueueId) {
      await refreshQueueData(selectedQueueId);
    }
    closeModal('manageConditions');
  }, [selectedQueueId, refreshQueueData, closeModal]);

  // Detect overlapping active conditions
  const activeConditions = useMemo(
    () => messageConditions.filter(c => {
      const template = queueTemplates.find(t => t.id === c.templateId);
      return template && template.hasCondition;
    }),
    [messageConditions, queueTemplates]
  );

  const overlappingConditions = useMemo(() => detectOverlappingConditions(activeConditions as any), [activeConditions]);

  if (!isOpen || !data) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`إدارة الشروط - ${queue?.doctorName || data.queueName || 'طابور'}`}
      size="2xl"
    >
      <div className="flex flex-col h-full space-y-4">

        {/* Conflict Warning */}
        {overlappingConditions.length > 0 && (
          <ConflictWarning
            overlappingConditions={overlappingConditions}
            hasDefaultConflict={false}
          />
        )}

        {/* Templates List - Per-Template State View */}
        <div className="flex-1 overflow-y-auto space-y-3">
          {queueTemplates.length > 0 ? (
            queueTemplates.map((template) => {
              const condition = templateConditionMap.get(template.id);
              const status = getTemplateStatus(template);
              const isEditing = editingTemplateId === template.id;

              return (
                <div key={template.id}>
                  {isEditing ? (
                    // Edit Mode - Condition editor
                    <div className="border-2 border-blue-400 bg-blue-50 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-sm text-gray-800">{template.title}</h4>
                        <div className="flex gap-2">
                          <button
                            onClick={handleSaveCondition}
                            disabled={isLoading}
                            className="px-3 py-1.5 bg-emerald-600 text-white text-xs rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 font-semibold flex items-center gap-2"
                          >
                            <i className="fas fa-save"></i>
                            حفظ
                          </button>
                          <button
                            onClick={handleCancel}
                            disabled={isLoading}
                            className="px-3 py-1.5 bg-slate-400 text-white text-xs rounded-lg hover:bg-slate-500 transition disabled:opacity-50 font-semibold"
                          >
                            <i className="fas fa-times"></i>
                          </button>
                        </div>
                      </div>

                      {/* Validation Errors */}
                      {Object.keys(formErrors).length > 0 && (
                        <div className="bg-red-50 border-2 border-red-400 rounded-lg p-3">
                          <p className="text-red-800 font-semibold flex items-center gap-2 mb-2 text-xs">
                            <i className="fas fa-exclamation-circle"></i>
                            يرجى تصحيح الأخطاء:
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

                      {/* Condition Editor */}
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
                    // View Mode - Template status card
                    <div className={`p-4 border-2 rounded-lg transition cursor-pointer ${
                      status.color.includes('red')
                        ? 'hover:bg-red-50'
                        : status.color.includes('blue')
                        ? 'hover:bg-blue-50'
                        : status.color.includes('green')
                        ? 'hover:bg-green-50'
                        : 'hover:bg-gray-50'
                    } ${status.color}`}>
                      <div className="space-y-2">
                        {/* Header: Title and Status Badge */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <h4 className="font-semibold text-sm">{template.title}</h4>
                            <p className="text-xs opacity-75 mt-1">{status.description}</p>
                          </div>
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 flex-shrink-0 border`}>
                            <i className={`fas ${status.icon} text-xs`}></i>
                            {status.label}
                          </span>
                        </div>

                        {/* Condition Display (for active conditions) */}
                        {template.hasCondition && condition && (
                          <p className="text-xs bg-white bg-opacity-60 px-2 py-1.5 rounded border border-opacity-50">
                            <span className="font-semibold">الشرط: </span>
                            {getConditionDisplayText(condition)}
                          </p>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-2 pt-2">
                          {!template.isDefault && (
                            <button
                              onClick={() => handleSetAsDefault(template)}
                              disabled={isLoading}
                              className="flex-1 px-2 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition disabled:opacity-50 font-medium flex items-center justify-center gap-1"
                              title="تعيين كافتراضي"
                            >
                              <i className="fas fa-star"></i>
                              تعيين كافتراضي
                            </button>
                          )}

                          {template.hasCondition && (
                            <button
                              onClick={() => handleToggleCondition(template)}
                              disabled={isLoading}
                              className="flex-1 px-2 py-1.5 bg-orange-500 text-white text-xs rounded hover:bg-orange-600 transition disabled:opacity-50 font-medium flex items-center justify-center gap-1"
                              title="إزالة الشرط"
                            >
                              <i className="fas fa-times-circle"></i>
                              بدون شرط
                            </button>
                          )}

                          {!template.isDefault && (
                            <button
                              onClick={() => handleEditCondition(template)}
                              disabled={isLoading}
                              className="flex-1 px-2 py-1.5 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition disabled:opacity-50 font-medium flex items-center justify-center gap-1"
                              title="تعديل الشرط"
                            >
                              <i className="fas fa-edit"></i>
                              {template.hasCondition ? 'تعديل' : 'إضافة شرط'}
                            </button>
                          )}
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
              <p className="text-sm">لا توجد قوالب في هذا الطابور</p>
            </div>
          )}
        </div>

        {/* Usage Guide */}
        <UsageGuideSection
          items={[
            {
              title: 'افتراضي',
              description: 'قالب افتراضي بدون شرط مخصص. يُستخدم تلقائياً إذا لم ينطبق أي شرط آخر',
            },
            {
              title: 'بدون شرط',
              description: 'قالب بدون شرط مخصص. يمكن إضافة شرط له لاحقاً',
            },
            {
              title: 'شرط مخصص',
              description: 'قالب له شرط مخصص (يساوي / أكبر من / أقل من / نطاق)',
            },
            {
              title: 'تضارب الشروط',
              description: 'الشروط المتداخلة تسبب تضارباً ويجب تعديلها لتجنب ذلك',
            },
            {
              title: 'جميع القيم',
              description: 'يجب أن تكون أكبر من صفر (≥1)',
            },
          ]}
        />

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t flex-shrink-0">
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="flex-1 bg-emerald-600 text-white py-2 rounded-lg hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 font-medium disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <i className="fas fa-spinner fa-spin"></i>
                جاري...
              </>
            ) : (
              <>
                <i className="fas fa-check"></i>
                تم
              </>
            )}
          </button>
          <button
            onClick={handleClose}
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

  const queue = queues.find(q => q.id === queueId);
  
  // Filter conditions for this queue from API data
  const queueConditions = useMemo(() => {
    if (!selectedQueueId) return [];
    return messageConditions
      .filter(c => c.queueId === selectedQueueId)
      .map(c => ({
        ...c,
        template: messageTemplates.find(t => t.id === c.templateId)?.title || '',
      }));
  }, [selectedQueueId, messageConditions, messageTemplates]);
  
  // Get templates for this queue from API data
  const queueTemplates: MessageTemplate[] = useMemo(() => messageTemplates.filter(t => t.queueId === selectedQueueId), [messageTemplates, selectedQueueId]);

  const [conditions, setConditions] = useState<MessageCondition[]>(
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

  const [formData, setFormData] = useState<Partial<MessageCondition>>({
    name: '',
    priority: 1,
    enabled: true,
    operator: 'EQUAL',
    value: undefined,
    minValue: undefined,
    maxValue: undefined,
    templateId: undefined,
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

  const handleEditCondition = useCallback((condition: MessageCondition) => {
    setEditingId(condition.id);
    setFormData(condition);
    setFormErrors({});
    setShowAddForm(true);
  }, []);

  const handleSaveCondition = useCallback(async () => {
    const errors = validateFormData();
    setFormErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }
    try {
      setIsLoading(true);
      if (!selectedQueueId) throw new Error('لا يوجد طابور محدد');
      const queueIdNum = Number(selectedQueueId);
      if (isNaN(queueIdNum)) throw new Error('معرف الطابور غير صالح');
      const templateIdNum = Number(formData.templateId);
      if (!templateIdNum || isNaN(templateIdNum)) throw new Error('اختر رسالة صالحة للشرط');

      if (editingId) {
        const backendId = Number(editingId);
        if (isNaN(backendId)) throw new Error('معرف الشرط غير صالح');
        await messageApiClient.updateCondition(backendId, {
          operator: formData.operator as string,
          value: formData.value,
          minValue: formData.minValue,
          maxValue: formData.maxValue,
        });
        updateMessageCondition(editingId, {
          operator: formData.operator as any,
          value: formData.value,
          minValue: formData.minValue,
          maxValue: formData.maxValue,
        });
        addToast('تم تحديث الشرط بنجاح', 'success');
      } else {
        const dto = await messageApiClient.createCondition({
          templateId: templateIdNum,
          queueId: queueIdNum,
          operator: formData.operator as string,
          value: formData.value,
          minValue: formData.minValue,
          maxValue: formData.maxValue,
        });
        const mapped: MessageCondition = {
          id: dto.id.toString(),
          queueId: dto.queueId.toString(),
          templateId: dto.templateId?.toString(),
          name: `Condition ${conditions.length + 1}`,
            priority: conditions.length,
          enabled: true,
          operator: dto.operator as any,
          value: dto.value ?? undefined,
          minValue: dto.minValue ?? undefined,
          maxValue: dto.maxValue ?? undefined,
          template: messageTemplates.find(t => t.id === (dto.templateId?.toString() || ''))?.title || '',
          createdAt: dto.createdAt ? new Date(dto.createdAt) : undefined,
          updatedAt: dto.updatedAt ? new Date(dto.updatedAt) : undefined,
        };
        setConditions(prev => [...prev, mapped]);
        addToast('تم إضافة الشرط بنجاح', 'success');
      }
    } catch (err: any) {
      addToast(err?.message || 'حدث خطأ أثناء حفظ الشرط', 'error');
    } finally {
      setIsLoading(false);
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
      templateId: undefined,
    });
  }, [formData, editingId, addToast, validateFormData, selectedQueueId, messageTemplates, conditions.length, updateMessageCondition]);

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
      templateId: undefined,
    });
  }, []);

  const handleSave = useCallback(async () => {
    closeModal('manageConditions');
  }, [closeModal]);

  const operatorOptions = [
    { value: 'EQUAL', label: 'يساوي' },
    { value: 'GREATER', label: 'أكبر من' },
    { value: 'LESS', label: 'أقل من' },
    { value: 'RANGE', label: 'نطاق' },
  ];

  /**
   * Get overlapping conditions using utility function
   */
  const overlappingConditions = useMemo(() => detectOverlappingConditions(conditions as any), [conditions]);

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
        {overlappingConditions.length > 0 && (
          <ConflictWarning 
            overlappingConditions={overlappingConditions}
            hasDefaultConflict={false}
          />
        )}

        {/* Conditions List */}
        <div className="flex-1 overflow-y-auto space-y-3">
          {sortedConditions.length > 0 ? (
            sortedConditions.map((condition) => {
              // Helper function to format condition description
              const getConditionDescription = (cond: MessageCondition) => {
                const operatorLabels: Record<string, string> = {
                  'EQUAL': 'يساوي',
                  'GREATER': 'أكبر من',
                  'LESS': 'أقل من',
                  'RANGE': 'نطاق',
                };
                
                // Handle no operator (بدون الشرط)
                if (!cond.operator) {
                  return 'بدون الشرط';
                }
                
                if (cond.operator === 'RANGE') {
                  return `${operatorLabels[cond.operator]}: من ${cond.minValue} إلى ${cond.maxValue}`;
                }
                return `${operatorLabels[cond.operator]}: ${cond.value}`;
              };

              const isEditing = editingId === condition.id;
              const isWarningCondition = !condition.operator;
              
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
                            <span className="text-blue-600">القالب:</span> {messageTemplates.find(t => t.id === condition.templateId)?.title || 'قالب'}
                          </p>
                        </div>
                          <p className="text-xs text-gray-600 mt-1">
                            <span className="text-blue-600">الشرط:</span> {getConditionDescription(condition)}
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
                              <span className="text-blue-600">القالب:</span> {messageTemplates.find(t => t.id === condition.templateId)?.title || 'قالب'}
                            </p>
                          </div>
                          <p className="text-xs text-gray-600 mt-1">
                            <span className="text-blue-600">الشرط:</span> {getConditionDescription(condition)}
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
            { title: '', description: 'جميع القيم يجب أن تكون أكبر من صفر (≥1)' },
            { title: '', description: 'تحدد الشروط كيفية إرسال الرسائل للمرضى' },
            { title: '', description: 'يشترط وجود قالب افتراضي لتفادي الحالات غير المشمولة بأي شرط' },
            { title: 'بدون شرط', description: 'لن يتم استخدام هذا الشرط حتى يتم تحديد قيمة مناسبة' },
            { title: 'القالب الافتراضي', description: 'لا يمكن أن يحتوي القالب الافتراضي على شرط مخصص. يُستخدم تلقائياً إذا لم ينطبق أي شرط آخر' },
            { title: 'نطاق', description: 'يجب أن يكون الحد الأدنى أقل من الحد الأقصى' },
            { title: 'يساوي / أكبر من / أقل من', description: 'يتم تطبيق الشرط على قيمة واحدة محددة' },
            { title: 'تضارب الشروط', description: 'الشروط المتداخلة تسبب تضارباً ويجب تعديلها لتجنب ذلك' },
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
