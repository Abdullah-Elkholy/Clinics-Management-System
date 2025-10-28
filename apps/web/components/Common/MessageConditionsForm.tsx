'use client';

import { useUI } from '@/contexts/UIContext';
import { useState, useCallback, useMemo } from 'react';
import {
  matchesCondition,
  getMessageRecipients,
  formatPositionDisplay,
} from '@/utils/queuePositionUtils';

/**
 * Unified Message Condition Type
 * Now supports queue_position only with range operator
 */
export interface MessageCondition {
  id: string;
  type: 'queue_position';
  operator: 'equals' | 'greater' | 'less' | 'range';
  value: string;
  minValue?: number;
  maxValue?: number;
  templateId?: string;
  messageTitle?: string;
}

/**
 * Conflict detection result
 */
export interface ConflictInfo {
  hasConflict: boolean;
  conflictingIds: string[];
  message: string;
  severity: 'warning' | 'error';
}

export interface MessageConditionsFormProps {
  conditions: MessageCondition[];
  onChange: (conditions: MessageCondition[]) => void;
  showTemplateSelect?: boolean;
  availableTemplates?: Array<{ id: string; title: string }>;
  selectedTemplate?: string;
  onTemplateChange?: (templateId: string) => void;
  compact?: boolean;
  /** CQP for offset-based condition evaluation and preview */
  currentQueuePosition?: number;
  /** Sample patients for condition preview (optional) */
  previewPatients?: Array<{ id: string | number; name: string; queue: number }>;
}

/**
 * Unified Message Conditions Form Component
 * Replaces both:
 * 1. MessageConditionsModal (in QueueDashboard)
 * 2. Conditions Tab (in MessagesPanel)
 * 
 * Features:
 * - Queue position only (focused)
 * - Range operator with min/max values
 * - Clean, reusable UI
 */
export default function MessageConditionsForm({
  conditions,
  onChange,
  showTemplateSelect = false,
  availableTemplates = [],
  selectedTemplate = '',
  onTemplateChange,
  compact = false,
  currentQueuePosition,
  previewPatients = [],
}: MessageConditionsFormProps) {
  const { addToast } = useUI();

  // Collapsible info box state
  const [isInfoBoxCollapsed, setIsInfoBoxCollapsed] = useState(true);

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);

  // Selected message for condition
  const [selectedMessage, setSelectedMessage] = useState('');

  const [newCondition, setNewCondition] = useState({
    type: 'queue_position' as const,
    operator: 'equals' as 'equals' | 'greater' | 'less' | 'range',
    value: '',
    minValue: '',
    maxValue: '',
  });

  /**
   * Operator labels
   */
  const operatorLabels = useMemo(() => ({
    equals: 'يساوي',
    greater: 'أكبر من',
    less: 'أقل من',
    range: 'نطاق',
  }), []);

  /**
   * Calculate expected recipients based on condition and CQP
   * Shows how many patients would receive this condition
   */
  const getExpectedRecipients = useCallback((condition: MessageCondition): number => {
    if (!currentQueuePosition || previewPatients.length === 0) {
      return 0;
    }

    try {
      const patients = previewPatients.map((p) => ({
        id: String(p.id),
        queue: p.queue,
        name: p.name,
      }));

      const recipients = getMessageRecipients(
        patients,
        currentQueuePosition,
        {
          operator: condition.operator,
          value: condition.value,
          minValue: condition.minValue,
          maxValue: condition.maxValue,
        }
      );

      return recipients.length;
    } catch (err) {
      return 0;
    }
  }, [currentQueuePosition, previewPatients]);

  /**
   * Get description for expected recipients
   */
  const getRecipientDescription = useCallback((count: number): string => {
    if (count === 0) {
      return 'لا يوجد مستقبلون';
    } else if (count === 1) {
      return 'مريض واحد';
    } else if (count <= 10) {
      return `${count} مرضى`;
    } else {
      return `${count}+ مرضى`;
    }
  }, []);

  /**
   * Detect conflicting conditions
   * Returns conflict info with details about which conditions overlap
   */
  const detectConflicts = useCallback((allConditions: MessageCondition[]): ConflictInfo => {
    if (allConditions.length < 2) {
      return { hasConflict: false, conflictingIds: [], message: '', severity: 'warning' };
    }

    const conflicts: string[] = [];
    const conflictMap = new Map<string, string[]>();

    // Check each pair of conditions
    for (let i = 0; i < allConditions.length; i++) {
      for (let j = i + 1; j < allConditions.length; j++) {
        const c1 = allConditions[i];
        const c2 = allConditions[j];

        let hasOverlap = false;
        let reason = '';

        // Convert conditions to ranges for comparison
        const c1Range = getConditionRange(c1);
        const c2Range = getConditionRange(c2);

        if (c1Range && c2Range) {
          // Check if ranges overlap
          if (!(c1Range.max < c2Range.min || c2Range.max < c1Range.min)) {
            hasOverlap = true;
            reason = `النطاق ${c1.value} يتداخل مع ${c2.value}`;
          }
        } else if (c1Range && !c2Range && c1.operator === 'equals') {
          // equals overlaps with everything that includes its value
          const val = parseInt(c1.value);
          if (!isNaN(val) && val >= c2Range?.min! && val <= c2Range?.max!) {
            hasOverlap = true;
            reason = `القيمة ${c1.value} موجودة ضمن الشروط الأخرى`;
          }
        }

        if (hasOverlap) {
          conflicts.push(c1.id);
          conflicts.push(c2.id);
          
          if (!conflictMap.has(c1.id)) conflictMap.set(c1.id, []);
          if (!conflictMap.has(c2.id)) conflictMap.set(c2.id, []);
          
          conflictMap.get(c1.id)!.push(reason);
          conflictMap.get(c2.id)!.push(reason);
        }
      }
    }

    const uniqueConflicts = Array.from(new Set(conflicts));

    if (uniqueConflicts.length > 0) {
      const messages = Array.from(conflictMap.values())
        .flat()
        .filter((v, i, a) => a.indexOf(v) === i);
      
      return {
        hasConflict: true,
        conflictingIds: uniqueConflicts,
        message: `⚠️ تم اكتشاف تضارب في الشروط: ${messages.join(' و ')}`,
        severity: 'warning',
      };
    }

    return { hasConflict: false, conflictingIds: [], message: '', severity: 'warning' };
  }, []);

  /**
   * Get numeric range for a condition
   */
  const getConditionRange = useCallback((condition: MessageCondition): { min: number; max: number } | null => {
    switch (condition.operator) {
      case 'equals':
        const val = parseInt(condition.value);
        return isNaN(val) ? null : { min: val, max: val };
      
      case 'greater':
        const gVal = parseInt(condition.value);
        return isNaN(gVal) ? null : { min: gVal + 1, max: Infinity };
      
      case 'less':
        const lVal = parseInt(condition.value);
        return isNaN(lVal) ? null : { min: 0, max: lVal - 1 };
      
      case 'range':
        return condition.minValue !== undefined && condition.maxValue !== undefined
          ? { min: condition.minValue, max: condition.maxValue }
          : null;
      
      default:
        return null;
    }
  }, []);

  /**
   * Memoized conflict check
   */
  const conflictInfo = useMemo(() => {
    return detectConflicts(conditions);
  }, [conditions, detectConflicts]);

  /**
   * Check if range operator is selected
   */
  const isRangeOperator = newCondition.operator === 'range';

  /**
   * Add or update condition - handles both simple values and range
   */
  const handleAddCondition = useCallback(() => {
    if (isRangeOperator) {
      if (!newCondition.minValue.trim() || !newCondition.maxValue.trim()) {
        addToast('يرجى إدخال القيم الدنيا والعليا للنطاق', 'error');
        return;
      }

      const minVal = parseInt(newCondition.minValue);
      const maxVal = parseInt(newCondition.maxValue);

      if (isNaN(minVal) || isNaN(maxVal)) {
        addToast('القيم يجب أن تكون أرقام', 'error');
        return;
      }

      if (minVal > maxVal) {
        addToast('القيمة الدنيا يجب أن تكون أصغر من القيمة العليا', 'error');
        return;
      }

      const condition: MessageCondition = {
        id: editingId || Date.now().toString(),
        type: newCondition.type,
        operator: newCondition.operator,
        value: `${minVal}-${maxVal}`,
        minValue: minVal,
        maxValue: maxVal,
        templateId: selectedMessage || undefined,
        messageTitle: selectedMessage ? availableTemplates.find(t => t.id === selectedMessage)?.title : undefined,
      };

      if (editingId) {
        // Update existing condition
        onChange(conditions.map(c => c.id === editingId ? condition : c));
        addToast('تم تحديث الشرط بنجاح', 'success');
      } else {
        // Add new condition
        onChange([...conditions, condition]);
        addToast('تم إضافة الشرط بنجاح', 'success');
      }

      setNewCondition({
        type: 'queue_position',
        operator: 'equals',
        value: '',
        minValue: '',
        maxValue: '',
      });
      setSelectedMessage('');
      setEditingId(null);
    } else {
      if (!newCondition.value.trim()) {
        addToast('يرجى إدخال القيمة', 'error');
        return;
      }

      const condition: MessageCondition = {
        id: editingId || Date.now().toString(),
        type: newCondition.type,
        operator: newCondition.operator,
        value: newCondition.value,
        templateId: selectedMessage || undefined,
        messageTitle: selectedMessage ? availableTemplates.find(t => t.id === selectedMessage)?.title : undefined,
      };

      if (editingId) {
        // Update existing condition
        onChange(conditions.map(c => c.id === editingId ? condition : c));
        addToast('تم تحديث الشرط بنجاح', 'success');
      } else {
        // Add new condition
        onChange([...conditions, condition]);
        addToast('تم إضافة الشرط بنجاح', 'success');
      }

      setNewCondition({
        type: 'queue_position',
        operator: 'equals',
        value: '',
        minValue: '',
        maxValue: '',
      });
      setSelectedMessage('');
      setEditingId(null);
    }
  }, [newCondition, isRangeOperator, conditions, onChange, addToast, selectedMessage, editingId, availableTemplates]);

  /**
   * Delete condition
   */
  const handleDeleteCondition = useCallback((id: string) => {
    onChange(conditions.filter(c => c.id !== id));
    addToast('تم حذف الشرط بنجاح', 'success');
  }, [conditions, onChange, addToast]);

  /**
   * Get description for condition
   */
  const getConditionDescription = (condition: MessageCondition): string => {
    const opLabel = operatorLabels[condition.operator];
    const baseDesc = condition.operator === 'range'
      ? `موضع الانتظار في النطاق ${condition.value}`
      : `موضع الانتظار ${opLabel} ${condition.value}`;

    // Add CQP context if available
    if (currentQueuePosition !== undefined) {
      return `${baseDesc} (الموضع الحالي: ${currentQueuePosition})`;
    }
    return baseDesc;
  };

  if (compact) {
    // Compact view for inline usage
    return (
      <div className="space-y-3">
        {/* Template Select (if enabled) */}
        {showTemplateSelect && (
          <div className="flex items-center gap-2">
            <select
              value={selectedTemplate}
              onChange={(e) => onTemplateChange?.(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="">اختر رسالة</option>
              {availableTemplates.map((t) => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
          </div>
        )}

        {/* Current Conditions */}
        {conditions.length > 0 && (
          <div className="space-y-2 bg-gray-50 p-3 rounded-lg border border-gray-200">
            {conditions.map((condition) => (
              <div key={condition.id} className="flex items-center justify-between p-2 bg-white rounded border border-gray-200">
                <span className="text-sm text-gray-700">{getConditionDescription(condition)}</span>
                <button
                  onClick={() => handleDeleteCondition(condition.id)}
                  className="text-red-600 hover:text-red-800 p-1 transition-colors text-sm"
                >
                  <i className="fas fa-trash"></i>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add New Condition */}
        <div className="space-y-2 bg-green-50 p-3 rounded-lg border border-green-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {/* Operator */}
            <select
              value={newCondition.operator}
              onChange={(e) => setNewCondition({ ...newCondition, operator: e.target.value as any })}
              className="px-3 py-2 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm bg-white"
            >
              <option value="equals">يساوي</option>
              <option value="greater">أكبر من</option>
              <option value="less">أقل من</option>
              <option value="range">نطاق</option>
            </select>

            {/* Value(s) */}
            {isRangeOperator ? (
              <>
                <input
                  type="number"
                  value={newCondition.minValue}
                  onChange={(e) => setNewCondition({ ...newCondition, minValue: e.target.value })}
                  placeholder="الحد الأدنى"
                  className="px-3 py-2 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                />
                <input
                  type="number"
                  value={newCondition.maxValue}
                  onChange={(e) => setNewCondition({ ...newCondition, maxValue: e.target.value })}
                  placeholder="الحد الأقصى"
                  className="px-3 py-2 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                />
              </>
            ) : (
              <input
                type="number"
                value={newCondition.value}
                onChange={(e) => setNewCondition({ ...newCondition, value: e.target.value })}
                placeholder="أدخل القيمة"
                className="px-3 py-2 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
              />
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleAddCondition}
              className="flex-1 bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 font-medium text-sm"
            >
              <i className={`fas ${editingId ? 'fa-save' : 'fa-plus'}`}></i>
              <span>{editingId ? 'تحديث الشرط' : 'إضافة شرط'}</span>
            </button>
            {editingId && (
              <button
                onClick={() => {
                  setEditingId(null);
                  setSelectedMessage('');
                  setNewCondition({
                    type: 'queue_position',
                    operator: 'equals',
                    value: '',
                    minValue: '',
                    maxValue: '',
                  });
                }}
                className="px-4 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition-colors text-sm"
              >
                <i className="fas fa-times"></i>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Full view for modal/panel usage
  return (
    <div className="space-y-4">
      {/* Info Box - Collapsible */}
      <div className={`border-2 rounded-xl transition-all duration-300 ${
        conflictInfo.hasConflict 
          ? 'bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-300 shadow-lg shadow-yellow-100' 
          : 'bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-300 shadow-lg shadow-blue-100'
      }`}>
        {/* Header with Collapse Toggle - Fully Clickable */}
        <button
          onClick={() => setIsInfoBoxCollapsed(!isInfoBoxCollapsed)}
          className={`w-full flex items-center gap-3 p-5 text-left transition-all cursor-pointer group ${
            isInfoBoxCollapsed ? '' : 'border-b-2 border-current border-opacity-15'
          } ${
            conflictInfo.hasConflict
              ? 'hover:bg-yellow-100 active:bg-yellow-200'
              : 'hover:bg-blue-100 active:bg-blue-200'
          }`}
          title={isInfoBoxCollapsed ? 'عرض التفاصيل' : 'إخفاء التفاصيل'}
        >
          <div className="flex-shrink-0 mt-1">
            <i className={`fas ${conflictInfo.hasConflict ? 'fa-exclamation-triangle text-yellow-600' : 'fa-info-circle text-blue-600'} text-xl`}></i>
          </div>
          
          <div className="flex-1 flex items-center gap-2">
            <p className="font-bold text-base">📋 الشروط والقواعد</p>
            <span className={`text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap ${
              conflictInfo.hasConflict
                ? 'bg-yellow-200 text-yellow-800'
                : 'bg-blue-200 text-blue-800'
            }`}>
              {conflictInfo.hasConflict ? '⚠️ يحتاج مراجعة' : '✅ جاهز'}
            </span>
          </div>

          {/* Collapse Toggle Icon */}
          <div className={`flex-shrink-0 transition-transform ${isInfoBoxCollapsed ? 'rotate-180' : ''}`}>
            <i className={`fas fa-chevron-up ${
              conflictInfo.hasConflict
                ? 'text-yellow-700 group-hover:text-yellow-800'
                : 'text-blue-700 group-hover:text-blue-800'
            }`}></i>
          </div>
        </button>

        {/* Collapsible Content */}
        {!isInfoBoxCollapsed && (
          <div className={`px-5 pb-5 text-sm ${conflictInfo.hasConflict ? 'text-yellow-900' : 'text-blue-900'}`}>
          {/* Scope Section */}
            <div className="mt-6 mb-4 pb-4 border-b-2 border-current border-opacity-15">
            <p className="font-semibold text-xs opacity-80 mb-2 flex items-center gap-1">
              <i className="fas fa-map-pin text-xs"></i>
              نطاق التطبيق
            </p>
            <div className="ml-4 space-y-3">
              {showTemplateSelect ? (
                <div className="space-y-1">
                  <span className="inline-block bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm">
                    <i className="fas fa-envelope ml-1"></i>
                    لكل رسالة فقط (Per Message Template)
                  </span>
                  <p className="text-xs opacity-80 mt-2 leading-relaxed">
                    الشروط المحددة هنا تطبق على <span className="font-semibold">هذه الرسالة المختارة فقط</span>، بغض النظر عن الطابور أو الوقت
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <span className="inline-block bg-gradient-to-r from-purple-100 to-indigo-100 text-purple-800 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm">
                    <i className="fas fa-layer-group ml-1"></i>
                    لكل طابور (Per Queue)
                  </span>
                  <p className="text-xs opacity-80 mt-2 leading-relaxed">
                    الشروط المحددة هنا تطبق على <span className="font-semibold">الرسائل المختارة</span> من هذا الطابور. إذا لم تحدد رسالة، الشرط سيطبق على <span className="font-semibold">جميع الرسائل</span>
                  </p>
                </div>
              )}

              {/* CQP Info if available */}
              {currentQueuePosition !== undefined && (
                <div className="mt-3 pt-3 border-t border-current border-opacity-10 space-y-2">
                  <div className="flex items-center gap-2 bg-white bg-opacity-50 p-2 rounded-lg">
                    <i className="fas fa-location-dot text-lg opacity-60"></i>
                    <div>
                      <p className="text-xs font-semibold opacity-90">الموضع الحالي للعيادة: <span className="font-bold text-base text-blue-700">{currentQueuePosition}</span></p>
                      <p className="text-xs opacity-70 mt-0.5">الشروط تقيّم كـ <span className="font-semibold">نسبة من هذا الموضع</span> (موضع الانتظار - {currentQueuePosition})</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Main Description */}
          <div className="mb-4 pb-4 border-b-2 border-current border-opacity-15">
            <p className="font-semibold text-xs opacity-80 mb-2 flex items-center gap-1">
              <i className="fas fa-lightbulb text-xs"></i>
              كيفية الاستخدام
            </p>
            <p className="text-xs opacity-85 ml-4 leading-relaxed">
              اضبط شروطاً محددة لإرسال الرسائل تلقائياً عند تحقق الشروط. <span className="font-medium">مثلاً:</span> أرسل تنبيهاً عندما يكون موضع الانتظار أكثر من 5 مرضى 👥، أو عندما يكون الترتيب في نطاق 5-10 📊
            </p>
          </div>

          {/* Conflict Warning - Enhanced */}
          {conflictInfo.hasConflict && (
            <div className="mb-4 pb-4 border-2 border-yellow-400 rounded-lg p-3 bg-yellow-100 bg-opacity-50">
              <div className="flex items-start gap-2 mb-2">
                <i className="fas fa-triangle-exclamation text-yellow-700 text-sm mt-0.5"></i>
                <div className="flex-1">
                  <p className="font-bold text-xs text-yellow-800">⚠️ تم اكتشاف تضارب في الشروط</p>
                </div>
              </div>
              <p className="text-xs text-yellow-900 ml-5 mb-2 leading-relaxed font-medium">
                {conflictInfo.message}
              </p>
              <div className="ml-5 p-2 bg-yellow-50 rounded border border-yellow-200">
                <p className="text-xs text-yellow-800 opacity-85">
                  <i className="fas fa-circle-info ml-1"></i>
                  قد تتداخل بعض الشروط، مما قد يؤدي إلى سلوك غير متوقع. يُنصح بمراجعة الشروط المحددة أدناه.
                </p>
              </div>
            </div>
          )}

          {/* Best Practices - Enhanced */}
          <div className={`rounded-lg p-3.5 space-y-2 ${
            conflictInfo.hasConflict
              ? 'bg-yellow-100 border-l-4 border-yellow-500'
              : 'bg-blue-100 border-l-4 border-blue-500'
          }`}>
            <p className="font-bold text-xs opacity-90 flex items-center gap-1">
              <i className="fas fa-sparkles text-xs"></i>
              أفضل الممارسات 💡
            </p>
            <ul className="text-xs space-y-2 ml-1 opacity-85">
              <li className="flex items-start gap-2 leading-relaxed">
                <span className="flex-shrink-0 text-xs mt-0.5">✓</span>
                <span><span className="font-medium">تجنب التداخل:</span> لا تستخدم شروطاً متداخلة (مثل: = 5 مع نطاق 5-10)</span>
              </li>
              <li className="flex items-start gap-2 leading-relaxed">
                <span className="flex-shrink-0 text-xs mt-0.5">✓</span>
                <span><span className="font-medium">النطاقات للمرونة:</span> استخدم نطاقات (مثل 5-10) للقواعد المرنة والعامة</span>
              </li>
              <li className="flex items-start gap-2 leading-relaxed">
                <span className="flex-shrink-0 text-xs mt-0.5">✓</span>
                <span><span className="font-medium">المقارنات للدقة:</span> استخدم مقارنات بسيطة (يساوي أو أكبر أو أصغر) للقواعد المحددة بدقة</span>
              </li>
              <li className="flex items-start gap-2 leading-relaxed">
                <span className="flex-shrink-0 text-xs mt-0.5">✓</span>
                <span><span className="font-medium">ترتيب منطقي:</span> رتب الشروط من الأضيق للأوسع (أو العكس) للوضوح</span>
              </li>
            </ul>
          </div>
          </div>
        )}
      </div>

      {/* Template Select (if enabled) */}
      {showTemplateSelect && (
        <div className="flex items-center gap-2">
          <select
            value={selectedTemplate}
            onChange={(e) => onTemplateChange?.(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">اختر رسالة</option>
            {availableTemplates.map((t) => (
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
          </select>
        </div>
      )}

      {/* Current Conditions List */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b">
          <h4 className="font-bold text-gray-800">الشروط الحالية ({conditions.length})</h4>
        </div>

        <div className="max-h-64 overflow-y-auto">
          {conditions.length === 0 ? (
            <div className="flex items-center justify-center h-20 text-gray-500">
              <p className="text-sm">لا توجد شروط محددة حالياً</p>
            </div>
          ) : (
            <div className="divide-y">
              {conditions.map((condition) => {
                const isConflicting = conflictInfo.conflictingIds.includes(condition.id);
                return (
                  <div
                    key={condition.id}
                    className={`px-4 py-3 flex items-center justify-between transition-colors ${
                      editingId === condition.id
                        ? 'bg-blue-100 border-l-4 border-blue-500 hover:bg-blue-150'
                        : isConflicting
                        ? 'bg-yellow-50 border-l-4 border-yellow-400 hover:bg-yellow-100'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div>
                        {isConflicting && (
                          <i className="fas fa-exclamation-circle text-yellow-600 text-sm mr-1"></i>
                        )}
                        <i className="fas fa-list text-gray-400"></i>
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${isConflicting ? 'text-yellow-900' : 'text-gray-900'}`}>
                          {getConditionDescription(condition)}
                        </p>
                        <p className={`text-xs mt-1 ${isConflicting ? 'text-yellow-700' : 'text-gray-500'}`}>
                          {condition.templateId ? `مرتبطة برسالة: ${condition.messageTitle || condition.templateId}` : 'شرط عام (لجميع الرسائل)'}
                          {isConflicting && ' • ⚠️ يتضارب مع شرط آخر'}
                        </p>
                        {/* Show expected recipients if CQP is available */}
                        {currentQueuePosition !== undefined && previewPatients.length > 0 && (
                          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-200">
                            <i className="fas fa-users text-green-600 text-xs"></i>
                            <span className="text-xs font-semibold text-green-700">
                              {getRecipientDescription(getExpectedRecipients(condition))} متوقعون
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          // Set form to edit mode
                          setEditingId(condition.id);
                          setSelectedMessage(condition.templateId || '');
                          setNewCondition({
                            type: condition.type,
                            operator: condition.operator,
                            value: condition.value,
                            minValue: condition.minValue ? String(condition.minValue) : '',
                            maxValue: condition.maxValue ? String(condition.maxValue) : '',
                          });
                        }}
                        className="text-blue-600 hover:text-blue-800 p-2 transition-colors"
                        title="تعديل الشرط"
                      >
                        <i className="fas fa-edit text-sm"></i>
                      </button>
                      <button
                        onClick={() => handleDeleteCondition(condition.id)}
                        className="text-red-600 hover:text-red-800 p-2 transition-colors"
                        title="حذف الشرط"
                      >
                        <i className="fas fa-trash text-sm"></i>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Add New Condition */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
        <h4 className="font-bold text-green-900">إضافة شرط جديد</h4>

        {/* Message Selection */}
        {availableTemplates.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-green-900 mb-1">تطبيق الشرط على رسالة:</label>
            <select
              value={selectedMessage}
              onChange={(e) => setSelectedMessage(e.target.value)}
              className="w-full px-3 py-2 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm bg-white"
            >
              <option value="">- جميع الرسائل -</option>
              {availableTemplates.map((t) => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          {/* Operator */}
          <select
            value={newCondition.operator}
            onChange={(e) => setNewCondition({ ...newCondition, operator: e.target.value as any })}
            className="px-3 py-2 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm bg-white"
          >
            <option value="equals">يساوي</option>
            <option value="greater">أكبر من</option>
            <option value="less">أقل من</option>
            <option value="range">نطاق</option>
          </select>

          {/* Value(s) */}
          {isRangeOperator ? (
            <>
              <input
                type="number"
                value={newCondition.minValue}
                onChange={(e) => setNewCondition({ ...newCondition, minValue: e.target.value })}
                placeholder="الحد الأدنى"
                className="px-3 py-2 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
              />
              <input
                type="number"
                value={newCondition.maxValue}
                onChange={(e) => setNewCondition({ ...newCondition, maxValue: e.target.value })}
                placeholder="الحد الأقصى"
                className="px-3 py-2 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
              />
            </>
          ) : (
            <input
              type="number"
              value={newCondition.value}
              onChange={(e) => setNewCondition({ ...newCondition, value: e.target.value })}
              placeholder="أدخل القيمة"
              className="px-3 py-2 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
            />
          )}

          {/* Add Button */}
          <button
            onClick={handleAddCondition}
            className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 font-medium text-sm"
          >
            <i className={`fas ${editingId ? 'fa-save' : 'fa-plus'}`}></i>
            <span>{editingId ? 'تحديث الشرط' : 'إضافة'}</span>
          </button>
          {editingId && (
            <button
              onClick={() => {
                setEditingId(null);
                setSelectedMessage('');
                setNewCondition({
                  type: 'queue_position',
                  operator: 'equals',
                  value: '',
                  minValue: '',
                  maxValue: '',
                });
              }}
              className="bg-gray-400 text-white px-3 py-2 rounded-lg hover:bg-gray-500 transition-colors flex items-center justify-center gap-2 font-medium text-sm"
            >
              <i className="fas fa-times"></i>
              <span>إلغاء</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
