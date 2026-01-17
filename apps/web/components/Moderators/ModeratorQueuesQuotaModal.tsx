'use client';

import React, { useState } from 'react';
import { ModeratorQuota, User } from '@/types/user';

interface ModeratorQueuesQuotaModalProps {
  quota: ModeratorQuota;
  moderatorName: string;
  moderatorData?: User;
  isOpen: boolean;
  onClose: () => void;
  onSave: (quota: ModeratorQuota) => Promise<void>;
  isLoading?: boolean;
}

type QuotaMode = 'set' | 'add';

// Maximum value for 32-bit integer (int in C#)
// This is 2^31 - 1 = 2,147,483,647, which is the maximum value for int in C# backend
const MAX_INTEGER = 2147483647;

/**
 * ModeratorQueuesQuotaModal - Edit moderator queues quota
 * Features:
 * - SET (replace total) or ADD (add to current) mode dropdown
 * - Handle empty field as unlimited (-1)
 * - Three-column breakdown display
 * - Queues-specific button styling
 * - Integer validation with maximum value capping
 */
export default function ModeratorQueuesQuotaModal({
  quota,
  moderatorName,
  moderatorData,
  isOpen,
  onClose,
  onSave,
  isLoading = false,
}: ModeratorQueuesQuotaModalProps) {
  const [formData, setFormData] = useState<ModeratorQuota>(quota);
  const [mode, setMode] = useState<QuotaMode | 'unlimited'>('set');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [inputValue, setInputValue] = useState<string>(''); // Store raw input for 'add' mode

  // Reset form data when modal opens or quota changes
  React.useEffect(() => {
    if (isOpen && quota) {
      setFormData(quota);
      // If quota is already unlimited, set mode to 'unlimited'
      setMode(quota.queuesQuota.limit === -1 ? 'unlimited' : 'set');
      setError(null);
      setInputValue(''); // Reset input value
    }
  }, [isOpen, quota]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      if (formData.queuesQuota.limit < -1) {
        setError('الحد يجب أن يكون موجب أو غير محدود');
        setSaving(false);
        return;
      }

      // Validate integer maximum for queues quota
      if (formData.queuesQuota.limit !== -1 && formData.queuesQuota.limit > MAX_INTEGER) {
        setError(`القيمة القصوى المسموحة هي ${MAX_INTEGER.toLocaleString('ar-EG-u-nu-latn')}`);
        setSaving(false);
        return;
      }

      if (mode === 'set' && formData.queuesQuota.limit !== -1 && formData.queuesQuota.limit < formData.queuesQuota.used) {
        setError(`الحد لا يمكن أن يكون أقل من الكمية المستخدمة (${formData.queuesQuota.used.toLocaleString('ar-EG-u-nu-latn')})`);
        setSaving(false);
        return;
      }

      if (mode === 'add' && quota.queuesQuota.limit === -1) {
        setError('لا يمكن إضافة قيم عندما تكون الحصة غير محدودة حالياً. اختر "تعيين الحد" بدلاً من ذلك');
        setSaving(false);
        return;
      }

      // For 'add' mode, validate that adding won't exceed MAX_INTEGER
      if (mode === 'add' && inputValue !== '' && quota.queuesQuota.limit !== -1) {
        const currentLimit = quota.queuesQuota.limit;
        const delta = parseInt(inputValue, 10) || 0;
        const maxAddable = MAX_INTEGER - currentLimit;

        if (delta > maxAddable) {
          setError(`لا يمكن إضافة أكثر من ${maxAddable.toLocaleString('ar-EG-u-nu-latn')} (الحد الأقصى: ${MAX_INTEGER.toLocaleString('ar-EG-u-nu-latn')})`);
          setSaving(false);
          return;
        }
      }

      // For 'add' mode, we need to pass the delta (input value), not the final calculated limit
      // Only update queuesQuota, keep messagesQuota unchanged
      const quotaToSave: Partial<ModeratorQuota> = {
        messagesQuota: { ...quota.messagesQuota }, // Keep original messages quota
        queuesQuota: { ...formData.queuesQuota },
      };

      if (mode === 'unlimited') {
        // For 'unlimited' mode, set limit to -1
        quotaToSave.queuesQuota = {
          ...formData.queuesQuota,
          limit: -1,
        };
      } else if (mode === 'add' && inputValue !== '' && quota.queuesQuota.limit !== -1) {
        // Calculate delta from input value
        const delta = parseInt(inputValue, 10) || 0;
        if (delta > 0) {
          quotaToSave.queuesQuota = {
            ...formData.queuesQuota,
            limit: delta, // Pass delta for 'add' mode
          };
        } else {
          setError('يرجى إدخال قيمة صحيحة للإضافة');
          setSaving(false);
          return;
        }
      } else if (mode === 'set') {
        // For 'set' mode, use the calculated limit from formData (capped at MAX_INTEGER)
        quotaToSave.queuesQuota = {
          ...formData.queuesQuota,
          limit: formData.queuesQuota.limit > MAX_INTEGER
            ? MAX_INTEGER
            : formData.queuesQuota.limit,
        };
      } else if (mode === 'add' && inputValue === '') {
        setError('يرجى إدخال قيمة للإضافة');
        setSaving(false);
        return;
      }

      // Pass mode information via a custom property
      const quotaWithMode = { ...quotaToSave, _mode: mode } as any;
      await onSave(quotaWithMode as ModeratorQuota);
      // Don't close modal here - let parent component handle closing after refreshing data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل حفظ الحصة');
    } finally {
      setSaving(false);
    }
  };

  const handleLimitChange = (value: string) => {
    // Prevent changes when mode is 'unlimited' (input is disabled, but this is a safeguard)
    if (mode === 'unlimited') {
      return;
    }

    const currentLimit = quota.queuesQuota.limit;

    if (mode === 'add' && currentLimit === -1) {
      return;
    }

    const parsedValue = value === '' ? -1 : parseInt(value, 10) || -1;

    // For 'add' mode, cap the input value itself at (MAX_INTEGER - currentLimit)
    if (mode === 'add' && currentLimit !== -1 && parsedValue !== -1) {
      const maxAddable = MAX_INTEGER - currentLimit;

      if (parsedValue > maxAddable) {
        // Cap the input value at maxAddable
        const cappedValue = String(maxAddable);
        setInputValue(cappedValue);
        const sum = currentLimit + maxAddable;
        setFormData((prev) => ({
          ...prev,
          queuesQuota: {
            ...prev.queuesQuota,
            limit: sum > MAX_INTEGER ? MAX_INTEGER : sum,
          },
        }));
        return;
      }
    }

    setInputValue(value); // Store raw input

    let newLimit = parsedValue;
    if (mode === 'add' && parsedValue !== -1) {
      if (currentLimit === -1) {
        newLimit = -1;
      } else {
        // Cap the addition result at MAX_INTEGER
        const sum = currentLimit + parsedValue;
        newLimit = sum > MAX_INTEGER ? MAX_INTEGER : sum;
      }
    } else if (mode === 'set' && parsedValue !== -1 && parsedValue > MAX_INTEGER) {
      // Cap 'set' mode values at MAX_INTEGER
      newLimit = MAX_INTEGER;
    }

    setFormData((prev) => ({
      ...prev,
      queuesQuota: {
        ...prev.queuesQuota,
        limit: newLimit,
      },
    }));
  };

  const calculateRemaining = (limit: number, used: number): number => {
    if (limit === -1) return -1;
    return limit - used;
  };

  const remaining = calculateRemaining(formData.queuesQuota.limit, formData.queuesQuota.used);
  const originalRemaining = calculateRemaining(quota.queuesQuota.limit, quota.queuesQuota.used);
  const isUnlimited = formData.queuesQuota.limit === -1;
  const wasUnlimited = quota.queuesQuota.limit === -1;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50" onClick={onClose}></div>

      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-2xl z-50 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
          <h2 className="text-base font-semibold text-gray-900">
            <i className="fas fa-layer-group text-purple-600 ml-2"></i>
            إدارة حصة العيادات - {moderatorName}
          </h2>
          <button
            onClick={onClose}
            disabled={saving || isLoading}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <i className="fas fa-times text-lg"></i>
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-4 space-y-4">
          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}

          {/* Current State */}
          <div className="bg-purple-50 rounded-lg p-2 border border-purple-200">
            <div className="text-xs mb-1.5 font-semibold opacity-70">الحالة الحالية:</div>
            <div className="grid grid-cols-3 gap-1.5 text-center text-xs">
              <div>
                <div className="text-purple-900 opacity-70 font-medium mb-0.5 text-xs">الإجمالي</div>
                <div className="text-purple-900 font-bold text-xs">
                  {wasUnlimited ? 'غير محدود' : quota.queuesQuota.limit.toLocaleString('ar-EG-u-nu-latn')}
                </div>
              </div>
              <div>
                <div className="text-purple-900 opacity-70 font-medium mb-0.5 text-xs">المستخدم</div>
                <div className="text-purple-900 font-bold text-xs">
                  {quota.queuesQuota.used.toLocaleString('ar-EG-u-nu-latn')}
                </div>
              </div>
              <div>
                <div className="text-purple-900 opacity-70 font-medium mb-0.5 text-xs">المتبقي</div>
                <div className="text-purple-900 font-bold text-xs">
                  {wasUnlimited ? 'غير محدود' : originalRemaining.toLocaleString('ar-EG-u-nu-latn')}
                </div>
              </div>
            </div>
          </div>

          {/* Input and Mode Dropdown */}
          <div className="flex gap-2 items-end">
            <input
              type="number"
              value={mode === 'unlimited' ? '' : (mode === 'add' ? inputValue : (formData.queuesQuota.limit === -1 ? '' : String(formData.queuesQuota.limit)))}
              onChange={(e) => handleLimitChange(e.target.value)}
              disabled={saving || isLoading || (mode === 'add' && wasUnlimited) || mode === 'unlimited'}
              placeholder={mode === 'unlimited' ? 'غير محدود' : (mode === 'add' ? 'أدخل الكمية المراد إضافتها' : 'أدخل الحد الجديد')}
              max={mode === 'add' && quota.queuesQuota.limit !== -1
                ? MAX_INTEGER - quota.queuesQuota.limit
                : MAX_INTEGER}
              className="flex-1 px-3 py-1.5 text-right text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            <select
              value={mode}
              onChange={(e) => {
                const newMode = e.target.value as QuotaMode | 'unlimited';
                if (newMode === 'unlimited') {
                  setMode('unlimited');
                  setInputValue('');
                  // Set formData limit to -1
                  setFormData((prev) => ({
                    ...prev,
                    queuesQuota: {
                      ...prev.queuesQuota,
                      limit: -1,
                    },
                  }));
                } else {
                  setMode(newMode);
                  // If switching from unlimited to set/add, clear the input
                  if (mode === 'unlimited') {
                    setInputValue('');
                    setFormData((prev) => ({
                      ...prev,
                      queuesQuota: {
                        ...prev.queuesQuota,
                        limit: quota.queuesQuota.limit === -1 ? 0 : quota.queuesQuota.limit,
                      },
                    }));
                  }
                }
              }}
              disabled={saving || isLoading}
              className="px-2.5 py-1.5 rounded-lg border border-purple-300 text-purple-900 border-opacity-50 text-xs font-medium whitespace-nowrap focus:outline-none focus:ring-2 disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="set">تعيين الحد</option>
              <option value="add">إضافة للحد الحالي</option>
              <option value="unlimited">تعيين غير محدود</option>
            </select>
          </div>

          {/* Mode Description */}
          {mode === 'unlimited' ? (
            <p className="text-xs text-purple-700 bg-purple-50 border border-purple-200 rounded-lg p-2">
              ✓ سيتم تعيين الحصة كغير محدودة
            </p>
          ) : mode === 'add' && wasUnlimited ? (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
              ⚠️ لا يمكن إضافة قيم عندما تكون الحصة غير محدودة. اختر "تعيين الحد" لتحديد حد جديد.
            </p>
          ) : (
            <p className="text-xs text-gray-600">
              {mode === 'set'
                ? `سيتم تعيين القيمة المدخلة لتصبح هي نفسها الحد الإجمالي`
                : `سيتم إضافة القيمة المدخلة على الحد الحالي (${quota.queuesQuota.limit === -1 ? 'غير محدود' : quota.queuesQuota.limit.toLocaleString('ar-EG-u-nu-latn')})`}
            </p>
          )}

          {/* Preview */}
          {formData.queuesQuota.limit !== quota.queuesQuota.limit && (
            <div className="rounded-lg p-2 border border-green-400 border-opacity-50 bg-green-50">
              <div className="text-xs mb-1.5 font-semibold text-green-700">معاينة الحالة الجديدة:</div>
              <div className="grid grid-cols-3 gap-1.5 text-center text-xs">
                <div>
                  <div className="text-green-700 opacity-70 font-medium mb-0.5 text-xs">الإجمالي</div>
                  <div className="text-green-900 font-bold text-xs">
                    {isUnlimited ? 'غير محدود' : formData.queuesQuota.limit.toLocaleString('ar-EG-u-nu-latn')}
                  </div>
                </div>
                <div>
                  <div className="text-green-700 opacity-70 font-medium mb-0.5 text-xs">المستخدم</div>
                  <div className="text-green-900 font-bold text-xs">
                    {formData.queuesQuota.used.toLocaleString('ar-EG-u-nu-latn')}
                  </div>
                </div>
                <div>
                  <div className="text-green-700 opacity-70 font-medium mb-0.5 text-xs">المتبقي</div>
                  <div className="text-green-900 font-bold text-xs">
                    {isUnlimited ? 'غير محدود' : remaining.toLocaleString('ar-EG-u-nu-latn')}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Info Box */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-2.5">
            <div className="flex gap-2">
              <i className="fas fa-info-circle text-purple-600 mt-0.5 flex-shrink-0 text-xs"></i>
              <div className="text-xs text-purple-800">
                <p className="font-semibold mb-1">ملاحظات عن العيادات:</p>
                <ul className="space-y-0.5 list-disc list-inside text-xs">
                  <li>الحصة تتراكم ولا تُعاد تعيينها تلقائياً</li>
                  <li>اختر "تعيين الحد" لتحديد إجمالي جديد</li>
                  <li>اختر "إضافة للحد الحالي" لزيادة الحصة الموجودة</li>
                  <li>اترك الحقل فارغاً لجعل الحصة غير محدودة</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-200 flex gap-2 justify-end sticky bottom-0 bg-gray-50">
          <button
            onClick={onClose}
            disabled={saving || isLoading}
            className="px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            إلغاء
          </button>
          <button
            onClick={handleSave}
            disabled={saving || isLoading}
            className="px-4 py-1.5 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {saving || isLoading ? (
              <>
                <i className="fas fa-spinner animate-spin text-xs"></i>
                جارٍ...
              </>
            ) : (
              <>
                <i className="fas fa-save text-xs"></i>
                حفظ التغييرات
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}

