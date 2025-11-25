/**
 * Manage Conditions Modal Component (Operator-Driven)
 * File: apps/web/components/Modals/ManageConditionsModal.tsx
 * 
 * Per-Template Operator-Based State Management
 * - Shows all templates with their operator-determined state: DEFAULT / UNCONDITIONED / active operator
 * - State derived from template.condition?.operator value:
 *   - DEFAULT: Queue default template (exactly one per queue enforced by DB filtered unique index)
 *   - UNCONDITIONED: No custom selection criteria (placeholder)
 *   - EQUAL/GREATER/LESS/RANGE: Active condition determining when template is selected
 * - Allows toggling condition state without deleting condition entity
 * - Calls refreshQueueData() on modal close to reload from backend
 * 
 * Features:
 * - View all templates with operator-based status badges (DEFAULT / UNCONDITIONED / active rule)
 * - Set template as default: updates condition.operator = 'DEFAULT'
 * - Convert to unconditioned: updates condition.operator = 'UNCONDITIONED'
 * - Edit active conditions (EQUAL, GREATER, LESS, RANGE)
 * - Detect overlaps between active conditions (ignores sentinel operators)
 */

'use client';

import { useModal } from '@/contexts/ModalContext';
import { useUI } from '@/contexts/UIContext';
import { useQueue } from '@/contexts/QueueContext';
import { useConfirmDialog } from '@/contexts/ConfirmationContext';
import { useState, useCallback, useMemo } from 'react';
import { messageApiClient } from '@/services/api/messageApiClient';
import Modal from './Modal';
import { ValidationError } from '@/utils/validation';
import { ConditionApplicationSection } from '../Common/ConditionApplicationSection';
import UsageGuideSection from '../Common/UsageGuideSection';
import { ConflictWarning } from '../Common/ConflictBadge';
import { detectOverlappingConditions, conditionsOverlap } from '@/utils/conditionConflictDetector';

import type { MessageCondition } from '@/types/messageCondition';
import type { MessageTemplate } from '@/types/messageTemplate';

interface ModalData {
  queueId: string;
  queueName: string;
}

/**
 * Get display status for a template based on operator type
 * Uses real condition data from messageConditions array (via templateConditionMap)
 */
function getTemplateStatus(
  template: MessageTemplate,
  condition: MessageCondition | undefined
): {
  label: string;
  color: string;
  icon: string;
  description: string;
} {
  // Prefer condition from messageConditions array, fallback to template.condition
  const operator = condition?.operator || template.condition?.operator;
  
  if (operator === 'DEFAULT') {
    return {
      label: 'افتراضي',
      color: 'bg-blue-100 text-blue-800 border-blue-300',
      icon: 'fa-star',
      description: 'قالب افتراضي (DEFAULT)',
    };
  }
  if (operator === 'UNCONDITIONED') {
    return {
      label: 'بدون شرط',
      color: 'bg-gray-100 text-gray-800 border-gray-300',
      icon: 'fa-ban',
      description: 'قالب بدون شرط مخصص (UNCONDITIONED)',
    };
  }
  if (operator && ['EQUAL', 'GREATER', 'LESS', 'RANGE'].includes(operator)) {
    return {
      label: 'شرط مخصص',
      color: 'bg-green-100 text-green-800 border-green-300',
      icon: 'fa-check-circle',
      description: `قالب له شرط مخصص (${operator})`,
    };
  }
  // Default fallback - no condition found
  return {
    label: 'بدون شرط',
    color: 'bg-gray-100 text-gray-800 border-gray-300',
    icon: 'fa-ban',
    description: 'قالب بدون شرط (لم يتم العثور على شرط)',
  };
}

/**
 * Get condition display text for active conditions
 */
function getConditionDisplayText(condition: MessageCondition | undefined): string {
  if (!condition) return '';
  
  // If there's no operator or value, it's a placeholder
  if (!condition.operator || (condition.value === undefined && condition.minValue === undefined)) {
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
  const { confirm } = useConfirmDialog();
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

  // Get queue info - use data.queueId if available, otherwise use selectedQueueId from context
  const queueId = data?.queueId || selectedQueueId;
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
    operator: 'EQUAL' as any,
    value: undefined,
    minValue: undefined,
    maxValue: undefined,
  });

  const validateFormData = useCallback((): ValidationError => {
    const errors: ValidationError = {};

    if (formData.operator && formData.operator !== 'EQUAL') {
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
    // Get condition from messageConditions array (real data)
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
    } else {
      // If no condition found, initialize with default values
      setEditingTemplateId(template.id);
      setFormData({
        operator: 'EQUAL' as any,
        value: undefined,
        minValue: undefined,
        maxValue: undefined,
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

    const template = queueTemplates.find(t => t.id === editingTemplateId);
    if (!template) {
      addToast('لم يتم العثور على القالب', 'error');
      return;
    }

    // Get condition from messageConditions array (real data)
    const condition = templateConditionMap.get(template.id);
    
    const targetQueueId = queueId || selectedQueueId;
    if (!targetQueueId) {
      addToast('معرف الطابور غير متوفر', 'error');
      return;
    }

    // Check for overlaps with existing conditions (only for active operators)
    const newOperator = formData.operator as string;
    if (newOperator && newOperator !== 'DEFAULT' && newOperator !== 'UNCONDITIONED') {
      const newCondition: Partial<MessageCondition> = {
        operator: newOperator as any,
        value: formData.value,
        minValue: formData.minValue,
        maxValue: formData.maxValue,
      };

      // Find conflicting conditions in the same queue (excluding the current condition being edited)
      const conflictingConditions = messageConditions
        .filter(c => {
          // Only check conditions in the same queue
          const conditionQueueId = c.queueId?.toString();
          if (conditionQueueId !== String(targetQueueId)) return false;
          
          // Skip the current condition being edited
          if (condition && c.id === condition.id) return false;
          
          // Skip UNCONDITIONED and DEFAULT conditions (they don't conflict)
          if (c.operator === 'UNCONDITIONED' || c.operator === 'DEFAULT') return false;
          
          // Check if conditions overlap
          return conditionsOverlap(newCondition as MessageCondition, c);
        })
        .map(c => {
          const conflictingTemplate = messageTemplates.find(t => t.id === c.templateId);
          return {
            condition: c,
            templateTitle: conflictingTemplate?.title || 'غير معروف',
          };
        });

      if (conflictingConditions.length > 0) {
        // Show confirmation dialog
        const conflictDetails = conflictingConditions
          .map(c => {
            const cond = c.condition;
            let condDesc = '';
            if (cond.operator === 'RANGE') {
              condDesc = `${cond.operator} ${cond.minValue}-${cond.maxValue}`;
            } else {
              condDesc = `${cond.operator} ${cond.value}`;
            }
            return `- ${c.templateTitle} (${condDesc})`;
          })
          .join('\n');
        
        const shouldProceed = await confirm({
          title: 'تعارض في الشروط',
          message: `هذا الشرط يتداخل مع الشروط التالية:\n\n${conflictDetails}\n\nهل تريد المتابعة على أي حال؟`,
          confirmText: 'نعم، المتابعة',
          cancelText: 'إلغاء',
        });

        if (!shouldProceed) {
          return; // User cancelled
        }
      }
    }

    try {
      setIsLoading(true);

      if (condition && condition.id && condition.templateId) {
        // Update existing condition
        const conditionBackendId = Number(condition.id);
        if (isNaN(conditionBackendId)) throw new Error('معرف الشرط غير صالح');

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
      } else {
        // Create new condition (shouldn't happen normally, but handle it)
        const templateBackendId = Number(template.id);
        const queueIdNum = Number(targetQueueId);
        
        if (isNaN(templateBackendId)) throw new Error('معرف القالب غير صالح');
        if (isNaN(queueIdNum)) throw new Error('معرف الطابور غير صالح');

        await messageApiClient.createCondition({
          templateId: templateBackendId,
          queueId: queueIdNum,
          operator: formData.operator as string,
          value: formData.value,
          minValue: formData.minValue,
          maxValue: formData.maxValue,
        });

        addToast('تم إنشاء الشرط بنجاح', 'success');
      }
      
      // Refresh queue data to get updated state from backend
      if (targetQueueId) {
        await refreshQueueData(targetQueueId);
        // Trigger custom events to notify other components to refetch
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('templateDataUpdated'));
          window.dispatchEvent(new CustomEvent('conditionDataUpdated'));
        }, 100);
      }
      
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
    queueId,
    selectedQueueId,
    refreshQueueData,
    messageConditions,
    messageTemplates,
    confirm,
  ]);

  const handleSetAsDefault = useCallback(async (template: MessageTemplate) => {
    // Check real condition data from messageConditions array
    const condition = templateConditionMap.get(template.id);
    const operator = condition?.operator || template.condition?.operator;
    
    if (operator === 'DEFAULT') {
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
      const targetQueueId = queueId || selectedQueueId;
      if (targetQueueId) {
        await refreshQueueData(targetQueueId);
        // Trigger custom events to notify other components to refetch
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('templateDataUpdated'));
          window.dispatchEvent(new CustomEvent('conditionDataUpdated'));
        }, 100);
      }
    } catch (err: any) {
      addToast(err?.message || 'حدث خطأ أثناء تحديد القالب الافتراضي', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [queueId, selectedQueueId, refreshQueueData, addToast]);

  const handleToggleCondition = useCallback(async (template: MessageTemplate) => {
    // Get condition from messageConditions array (real data)
    const condition = templateConditionMap.get(template.id);
    if (!condition) return;

    // Use real condition data from messageConditions array
    // Only toggle to UNCONDITIONED if it's currently an active condition (not already UNCONDITIONED or DEFAULT)
    if (condition.operator && !['DEFAULT', 'UNCONDITIONED'].includes(condition.operator)) {
      // Convert active to placeholder
      try {
        setIsLoading(true);
        const conditionBackendId = Number(condition.id);
        if (isNaN(conditionBackendId)) throw new Error('معرف الشرط غير صالح');

        // Update to placeholder: UNCONDITIONED operator
        // Backend requires explicit null values (not undefined) for UNCONDITIONED operator
        // Ensure null values are explicitly included in the request
        const updateRequest: any = {
          operator: 'UNCONDITIONED',
          value: null,
          minValue: null,
          maxValue: null,
        };
        await messageApiClient.updateCondition(conditionBackendId, updateRequest);

        updateMessageCondition(condition.id, {
          operator: 'UNCONDITIONED' as any,
          value: undefined,
          minValue: undefined,
          maxValue: undefined,
        });

        addToast('تم تحويل الشرط إلى بدون شرط بنجاح', 'success');
        
        // Refresh to get unconditioned state
        const targetQueueId = queueId || selectedQueueId;
        if (targetQueueId) {
          await refreshQueueData(targetQueueId);
          // Trigger custom events to notify other components to refetch
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('templateDataUpdated'));
            window.dispatchEvent(new CustomEvent('conditionDataUpdated'));
          }, 100);
        }
      } catch (err: any) {
        addToast(err?.message || 'حدث خطأ أثناء إزالة الشرط', 'error');
      } finally {
        setIsLoading(false);
      }
    }
  }, [queueId, templateConditionMap, updateMessageCondition, selectedQueueId, refreshQueueData, addToast]);

  const handleCancel = useCallback(() => {
    setEditingTemplateId(null);
    setFormErrors({});
    setFormData({
      operator: 'EQUAL' as any,
      value: undefined,
      minValue: undefined,
      maxValue: undefined,
    });
  }, []);

  // Close modal and refresh data
  const handleClose = useCallback(async () => {
    // Refresh queue data before closing to ensure UI is in sync
    const targetQueueId = queueId || selectedQueueId;
    if (targetQueueId) {
      await refreshQueueData(targetQueueId);
    }
    closeModal('manageConditions');
  }, [queueId, selectedQueueId, refreshQueueData, closeModal]);

  // Detect overlapping active conditions using TemplateId FK directly
  const activeConditions = useMemo(
    () => messageConditions.filter(c => {
      // Use TemplateId FK directly to verify template exists and condition is not DEFAULT
      const template = c.templateId ? queueTemplates.find(t => t.id === c.templateId) : undefined;
      // Include UNCONDITIONED in display (exclude only DEFAULT as it's a sentinel)
      // Use condition's operator directly from messageConditions (backed by TemplateId FK)
      return template && c.operator && c.operator !== 'DEFAULT';
    }),
    [messageConditions, queueTemplates]
  );

  // Helper function to get human-readable condition text (same format as QueueDashboard)
  const getConditionText = useCallback((cond: MessageCondition): string => {
    const operatorMap: Record<string, string> = {
      'EQUAL': 'يساوي',
      'GREATER': 'أكثر من',
      'LESS': 'أقل من',
      'RANGE': 'نطاق',
      'UNCONDITIONED': 'بدون شرط', 
      'DEFAULT': 'افتراضي',
    };

    const operatorText = operatorMap[cond.operator] || cond.operator;
    const valueText =
      cond.operator === 'RANGE' ? `${cond.minValue}-${cond.maxValue}` : cond.value;

    return `${operatorText} ${valueText}`;
  }, []);

  // Detect overlaps and format descriptions like QueueDashboard
  const overlappingConditions = useMemo(() => {
    const overlaps = detectOverlappingConditions(activeConditions as any);
    
    // Transform descriptions to match QueueDashboard format
    return overlaps.map(overlap => {
      const cond1 = activeConditions.find(c => c.id === overlap.id1);
      const cond2 = activeConditions.find(c => c.id === overlap.id2);
      
      if (!cond1 || !cond2) return overlap;
      
      // Get template names
      const template1 = queueTemplates.find(t => t.id === cond1.templateId);
      const template2 = queueTemplates.find(t => t.id === cond2.templateId);
      const template1Name = template1?.title || 'قالب غير معروف';
      const template2Name = template2?.title || 'قالب غير معروف';
      
      // Format like QueueDashboard: "تقاطع: TemplateName (conditionText) و TemplateName2 (conditionText2)"
      return {
        ...overlap,
        description: `تقاطع: ${template1Name} (${getConditionText(cond1)}) و ${template2Name} (${getConditionText(cond2)})`
      };
    });
  }, [activeConditions, queueTemplates, getConditionText]);
  
  // Create a set of condition IDs that are in conflict for quick lookup
  const conflictingConditionIds = useMemo(() => {
    const ids = new Set<string>();
    overlappingConditions.forEach(overlap => {
      // Each overlap is an object with id1 and id2 properties
      if (overlap.id1) ids.add(overlap.id1);
      if (overlap.id2) ids.add(overlap.id2);
    });
    return ids;
  }, [overlappingConditions]);

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
            // Sort templates: DEFAULT first, then others
            [...queueTemplates].sort((a, b) => {
              const condA = templateConditionMap.get(a.id);
              const condB = templateConditionMap.get(b.id);
              const opA = condA?.operator || a.condition?.operator;
              const opB = condB?.operator || b.condition?.operator;
              
              // DEFAULT always comes first
              if (opA === 'DEFAULT' && opB !== 'DEFAULT') return -1;
              if (opA !== 'DEFAULT' && opB === 'DEFAULT') return 1;
              
              // Otherwise maintain original order
              return 0;
            }).map((template) => {
              // Get condition from messageConditions array (real data)
              const condition = templateConditionMap.get(template.id);
              // Use real condition data for status
              const status = getTemplateStatus(template, condition);
              const isEditing = editingTemplateId === template.id;
              
              // Check if this template's condition is in conflict
              const isInConflict = condition && condition.id && conflictingConditionIds.has(condition.id);

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
                    <div className={`p-4 border-2 rounded-lg transition ${
                      isInConflict
                        ? 'bg-red-100 border-red-400 hover:bg-red-150'
                        : status.color.includes('red')
                        ? 'hover:bg-red-50'
                        : status.color.includes('blue')
                        ? 'hover:bg-blue-50'
                        : status.color.includes('green')
                        ? 'hover:bg-green-50'
                        : 'hover:bg-gray-50'
                    } ${isInConflict ? 'border-red-400' : status.color}`}>
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

                        {/* Condition Display (for all non-DEFAULT conditions, including UNCONDITIONED) - Use real condition data */}
                        {condition && condition.operator && condition.operator !== 'DEFAULT' && (
                          <p className="text-xs bg-white bg-opacity-60 px-2 py-1.5 rounded border border-opacity-50">
                            <span className="font-semibold">الشرط: </span>
                            {getConditionDisplayText(condition)}
                          </p>
                        )}

                        {/* Action Buttons - Use real condition data */}
                        <div className="flex gap-2 pt-2">
                          {condition?.operator !== 'DEFAULT' && (
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

                          {condition && condition.operator && !['DEFAULT', 'UNCONDITIONED'].includes(condition.operator) && (
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

                          {condition?.operator !== 'DEFAULT' && (
                            <button
                              onClick={() => handleEditCondition(template)}
                              disabled={isLoading}
                              className="flex-1 px-2 py-1.5 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition disabled:opacity-50 font-medium flex items-center justify-center gap-1"
                              title="تعديل الشرط"
                            >
                              <i className="fas fa-edit"></i>
                              {condition && condition.operator && !['DEFAULT', 'UNCONDITIONED'].includes(condition.operator) ? 'تعديل' : 'إضافة شرط'}
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
