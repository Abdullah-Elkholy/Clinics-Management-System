'use client';

import { useUI } from '@/contexts/UIContext';
import { useState, useCallback, useRef, useEffect } from 'react';
import { MessageCondition, QueueMessageConfig } from '@/types/messageCondition';

interface MessageConditionsFormEnhancedProps {
  config: QueueMessageConfig | undefined;
  onChange: (config: QueueMessageConfig) => void;
  currentQueuePosition?: number;
  previewPatients?: Array<{ id: string | number; name: string; queue: number }>;
}

export default function MessageConditionsFormEnhanced({
  config,
  onChange,
  currentQueuePosition,
  previewPatients = [],
}: MessageConditionsFormEnhancedProps) {
  const { addToast } = useUI();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  const [formData, setFormData] = useState<Partial<MessageCondition>>({
    operator: 'RANGE',
    minValue: 1,
    maxValue: 5,
    priority: 1,
    template: '',
    enabled: true,
  });

  const conditions = config?.conditions || [];
  const defaultTemplate = config?.defaultTemplate || '';
  const queueName = config?.queueName || '';

  // Get available priorities
  const usedPriorities = new Set(conditions.map(c => c.priority));
  const nextPriority = conditions.length + 1;

  // Validate condition
  const validateCondition = useCallback((cond: Partial<MessageCondition>): string | null => {
    if (!cond.operator) return 'يجب اختيار المشغل';
    if (!cond.template) return 'يجب إدخال نص الرسالة';
    if (!cond.priority) return 'يجب تحديد الأولوية';

    switch (cond.operator) {
      case 'EQUAL':
      case 'GREATER':
      case 'LESS':
        if (cond.value === undefined || cond.value === null) return 'يجب إدخال قيمة';
        break;
      case 'RANGE':
        if (!cond.minValue || !cond.maxValue) return 'يجب إدخال الحد الأدنى والأقصى';
        if (cond.minValue > cond.maxValue) return 'الحد الأدنى يجب أن يكون أصغر من الأقصى';
        break;
    }
    return null;
  }, []);

  // Add or update condition
  const handleSaveCondition = useCallback(() => {
    const error = validateCondition(formData);
    if (error) {
      addToast(error, 'error');
      return;
    }

    const newCondition: MessageCondition = {
      id: formData.id || `cond_${Date.now()}`,
      priority: formData.priority!,
      operator: formData.operator as any,
      value: formData.value,
      minValue: formData.minValue,
      maxValue: formData.maxValue,
      template: formData.template!,
      enabled: formData.enabled !== false,
      name: formData.name,
    };

    let newConditions = [...conditions];
    if (editingId) {
      newConditions = newConditions.map(c => c.id === editingId ? newCondition : c);
    } else {
      newConditions.push(newCondition);
    }

    // Sort by priority
    newConditions.sort((a, b) => a.priority - b.priority);

    onChange({
      ...config!,
      conditions: newConditions,
    });

    addToast(editingId ? 'تم تحديث الشرط' : 'تم إضافة الشرط', 'success');
    resetForm();
  }, [formData, editingId, conditions, config, onChange, addToast, validateCondition]);

  // Delete condition
  const handleDeleteCondition = useCallback((id: string) => {
    const newConditions = conditions.filter(c => c.id !== id);
    onChange({
      ...config!,
      conditions: newConditions,
    });
    addToast('تم حذف الشرط', 'success');
  }, [conditions, config, onChange, addToast]);

  // Handle drag start
  const handleDragStart = (id: string) => {
    setDraggingId(id);
  };

  // Handle drag over
  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (draggingId && draggingId !== id) {
      // Swap priorities
      const draggedCond = conditions.find(c => c.id === draggingId);
      const targetCond = conditions.find(c => c.id === id);
      if (draggedCond && targetCond) {
        const newConditions = conditions.map(c => {
          if (c.id === draggingId) return { ...c, priority: targetCond.priority };
          if (c.id === id) return { ...c, priority: draggedCond.priority };
          return c;
        });
        newConditions.sort((a, b) => a.priority - b.priority);
        onChange({
          ...config!,
          conditions: newConditions,
        });
      }
    }
  };

  // Handle drag end
  const handleDragEnd = () => {
    setDraggingId(null);
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      operator: 'RANGE',
      minValue: 1,
      maxValue: 5,
      priority: nextPriority,
      template: '',
      enabled: true,
    });
    setEditingId(null);
    setShowEditor(false);
  };

  // Edit condition
  const handleEditCondition = (cond: MessageCondition) => {
    setFormData(cond);
    setEditingId(cond.id);
    setShowEditor(true);
  };

  // Toggle enabled
  const handleToggleEnabled = useCallback((id: string) => {
    const newConditions = conditions.map(c =>
      c.id === id ? { ...c, enabled: !c.enabled } : c
    );
    onChange({
      ...config!,
      conditions: newConditions,
    });
  }, [conditions, config, onChange]);

  return (
    <div className="space-y-4">
      {/* Default Message Section */}
      <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-200 rounded-lg p-4">
        <h4 className="font-bold text-purple-900 mb-2 flex items-center gap-2">
          <i className="fas fa-envelope-circle-check"></i>
          الرسالة الافتراضية (عند عدم تطابق أي شرط)
        </h4>
        <div className="bg-white p-3 rounded border border-purple-200 text-sm text-gray-700 font-mono">
          {defaultTemplate || 'لم يتم تعيين رسالة افتراضية'}
        </div>
      </div>

      {/* Conditions List */}
      <div className="bg-white border border-gray-300 rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white flex items-center justify-between">
          <h4 className="font-bold flex items-center gap-2">
            <i className="fas fa-list-check"></i>
            الشروط المخصصة ({conditions.length})
          </h4>
          {conditions.length > 0 && (
            <span className="text-xs bg-white bg-opacity-20 px-2 py-1 rounded">
              اسحب لإعادة الترتيب
            </span>
          )}
        </div>

        {conditions.length === 0 ? (
          <div className="px-4 py-12 text-center text-gray-500">
            <i className="fas fa-inbox text-3xl mb-2 block opacity-50"></i>
            <p>لا توجد شروط مخصصة حالياً</p>
          </div>
        ) : (
          <div className="divide-y max-h-96 overflow-y-auto">
            {conditions.map((cond, index) => (
              <div
                key={cond.id}
                draggable
                onDragStart={() => handleDragStart(cond.id)}
                onDragOver={(e) => handleDragOver(e, cond.id)}
                onDragEnd={handleDragEnd}
                className={`px-4 py-3 flex items-center gap-3 transition-colors cursor-move ${
                  draggingId === cond.id
                    ? 'bg-blue-100 opacity-50'
                    : 'hover:bg-gray-50'
                } ${!cond.enabled ? 'opacity-50' : ''}`}
              >
                {/* Priority Badge */}
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-500 text-white font-bold flex items-center justify-center text-sm">
                  {cond.priority}
                </div>

                {/* Drag Handle */}
                <div className="flex-shrink-0 text-gray-400 cursor-grab active:cursor-grabbing">
                  <i className="fas fa-grip-vertical"></i>
                </div>

                {/* Condition Info */}
                <div className="flex-1 min-w-0">
                  {cond.name && (
                    <p className="text-sm font-semibold text-gray-900">{cond.name}</p>
                  )}
                  <p className="text-xs text-gray-600">
                    <span className="font-semibold">الشرط:</span> {getConditionLabel(cond)}
                  </p>
                  <p className="text-xs text-gray-600 truncate">
                    <span className="font-semibold">الرسالة:</span> {cond.template?.substring(0, 60)}...
                  </p>
                </div>

                {/* Actions */}
                <div className="flex-shrink-0 flex items-center gap-2">
                  {/* Enable/Disable Toggle */}
                  <button
                    onClick={() => handleToggleEnabled(cond.id)}
                    className={`p-2 rounded transition-colors ${
                      cond.enabled
                        ? 'text-green-600 bg-green-50 hover:bg-green-100'
                        : 'text-gray-400 bg-gray-100 hover:bg-gray-200'
                    }`}
                    title={cond.enabled ? 'تعطيل' : 'تفعيل'}
                  >
                    <i className={`fas ${cond.enabled ? 'fa-eye' : 'fa-eye-slash'}`}></i>
                  </button>

                  {/* Edit Button */}
                  <button
                    onClick={() => handleEditCondition(cond)}
                    className="p-2 rounded text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
                    title="تعديل"
                  >
                    <i className="fas fa-edit"></i>
                  </button>

                  {/* Delete Button */}
                  <button
                    onClick={() => handleDeleteCondition(cond.id)}
                    className="p-2 rounded text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                    title="حذف"
                  >
                    <i className="fas fa-trash"></i>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Condition Form */}
      <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-green-900 flex items-center gap-2">
            <i className={`fas ${editingId ? 'fa-pen' : 'fa-plus'}`}></i>
            {editingId ? 'تعديل الشرط' : 'إضافة شرط جديد'}
          </h4>
          {editingId && (
            <button
              onClick={resetForm}
              className="text-xs text-gray-600 hover:text-gray-900 flex items-center gap-1"
            >
              <i className="fas fa-times"></i>
              إلغاء
            </button>
          )}
        </div>

        <div className="space-y-3">
          {/* Name (Optional) */}
          <div>
            <label className="block text-sm font-medium text-green-900 mb-1">
              اسم الشرط (اختياري)
            </label>
            <input
              type="text"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="مثال: تنبيه قريب جداً"
              className="w-full px-3 py-2 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
            />
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-green-900 mb-1">
              الأولوية (1 = يتم التحقق أولاً)
            </label>
            <select
              value={formData.priority || 1}
              onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm bg-white"
            >
              {Array.from({ length: 10 }, (_, i) => i + 1).map(p => (
                <option key={p} value={p} disabled={usedPriorities.has(p) && !editingId}>
                  الأولوية {p}
                </option>
              ))}
            </select>
          </div>

          {/* Operator & Values */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {/* Operator */}
            <div>
              <label className="block text-sm font-medium text-green-900 mb-1">المشغل</label>
              <select
                value={formData.operator || 'RANGE'}
                onChange={(e) => setFormData({ ...formData, operator: e.target.value as any })}
                className="w-full px-3 py-2 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm bg-white"
              >
                <option value="EQUAL">يساوي =</option>
                <option value="GREATER">أكبر من</option>
                <option value="LESS">أصغر من</option>
                <option value="RANGE">نطاق من...إلى</option>
              </select>
            </div>

            {/* Value(s) */}
            {formData.operator === 'RANGE' ? (
              <>
                <input
                  type="number"
                  value={formData.minValue || ''}
                  onChange={(e) => setFormData({ ...formData, minValue: parseInt(e.target.value) })}
                  placeholder="الحد الأدنى"
                  className="px-3 py-2 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                />
                <input
                  type="number"
                  value={formData.maxValue || ''}
                  onChange={(e) => setFormData({ ...formData, maxValue: parseInt(e.target.value) })}
                  placeholder="الحد الأقصى"
                  className="px-3 py-2 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                />
              </>
            ) : (
              <input
                type="number"
                value={formData.value || ''}
                onChange={(e) => setFormData({ ...formData, value: parseInt(e.target.value) })}
                placeholder="القيمة"
                className="col-span-2 px-3 py-2 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
              />
            )}
          </div>

          {/* Template Message */}
          <div>
            <label className="block text-sm font-medium text-green-900 mb-1">
              نص الرسالة (مع المتغيرات: {'{PN}'}, {'{PQP}'}, {'{ETR}'}, {'{DN}'})
            </label>
            <textarea
              value={formData.template || ''}
              onChange={(e) => setFormData({ ...formData, template: e.target.value })}
              placeholder={`مثال: أنت قريب جداً! دورك خلال {ETR}`}
              className="w-full px-3 py-2 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm h-24 resize-none"
            />
            <p className="text-xs text-green-700 mt-1">
              المتغيرات المتاحة: {'{PN}'} = الاسم، {'{PQP}'} = الترتيب، {'{ETR}'} = الوقت المتبقي، {'{DN}'} = اسم الطبيب
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleSaveCondition}
              className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center justify-center gap-2"
            >
              <i className={`fas ${editingId ? 'fa-save' : 'fa-plus'}`}></i>
              {editingId ? 'تحديث الشرط' : 'إضافة الشرط'}
            </button>
            {editingId && (
              <button
                onClick={resetForm}
                className="px-4 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition-colors font-medium"
              >
                <i className="fas fa-times"></i>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Help Text */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900">
        <p className="font-semibold mb-1">💡 كيفية الاستخدام:</p>
        <ul className="list-disc list-inside space-y-1 opacity-80">
          <li>أضف شروط متعددة بأولويات مختلفة</li>
          <li>الشرط ذو الأولوية 1 يتم فحصه أولاً</li>
          <li>إذا تطابق شرط، يتم استخدام رسالته والتوقف</li>
          <li>إذا لم يتطابق أي شرط، يتم استخدام الرسالة الافتراضية</li>
          <li>اسحب الشروط لإعادة ترتيب الأولويات</li>
        </ul>
      </div>
    </div>
  );
}

// Helper to get condition label
function getConditionLabel(cond: MessageCondition): string {
  switch (cond.operator) {
    case 'EQUAL':
      return `الموضع = ${cond.value}`;
    case 'GREATER':
      return `الموضع > ${cond.value}`;
    case 'LESS':
      return `الموضع < ${cond.value}`;
    case 'RANGE':
      return `الموضع من ${cond.minValue} إلى ${cond.maxValue}`;
    default:
      return 'شرط غير معروف';
  }
}
