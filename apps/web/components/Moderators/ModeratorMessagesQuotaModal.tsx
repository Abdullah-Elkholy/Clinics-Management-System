'use client';

import React, { useState } from 'react';
import { ModeratorQuota, User } from '@/types/user';

interface ModeratorMessagesQuotaModalProps {
  quota: ModeratorQuota;
  moderatorName: string;
  moderatorData?: User;
  isOpen: boolean;
  onClose: () => void;
  onSave: (quota: ModeratorQuota) => Promise<void>;
  isLoading?: boolean;
}

type QuotaMode = 'set' | 'add';

/**
 * ModeratorMessagesQuotaModal - Edit moderator messages quota
 * Features:
 * - SET (replace total) or ADD (add to current) mode dropdown
 * - Handle empty field as unlimited (-1)
 * - Three-column breakdown display
 * - Messages-specific button styling
 */
export default function ModeratorMessagesQuotaModal({
  quota,
  moderatorName,
  moderatorData,
  isOpen,
  onClose,
  onSave,
  isLoading = false,
}: ModeratorMessagesQuotaModalProps) {
  const [formData, setFormData] = useState<ModeratorQuota>(quota);
  const [mode, setMode] = useState<QuotaMode>('set');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      if (formData.messagesQuota.limit < -1) {
        setError('الحد يجب أن يكون موجب أو غير محدود');
        setSaving(false);
        return;
      }

      if (mode === 'set' && formData.messagesQuota.limit !== -1 && formData.messagesQuota.limit < formData.messagesQuota.used) {
        setError(`الحد لا يمكن أن يكون أقل من الكمية المستخدمة (${formData.messagesQuota.used.toLocaleString('ar-SA')})`);
        setSaving(false);
        return;
      }

      if (mode === 'add' && quota.messagesQuota.limit === -1) {
        setError('لا يمكن إضافة قيم عندما تكون الحصة غير محدودة حالياً. اختر "تعيين الحد" بدلاً من ذلك');
        setSaving(false);
        return;
      }

      await onSave(formData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل حفظ الحصة');
    } finally {
      setSaving(false);
    }
  };

  const handleLimitChange = (value: string) => {
    const inputValue = value === '' ? -1 : parseInt(value, 10) || -1;
    const currentLimit = quota.messagesQuota.limit;

    if (mode === 'add' && currentLimit === -1) {
      return;
    }

    let newLimit = inputValue;
    if (mode === 'add' && inputValue !== -1) {
      if (currentLimit === -1) {
        newLimit = -1;
      } else {
        newLimit = currentLimit + inputValue;
      }
    }

    setFormData((prev) => ({
      ...prev,
      messagesQuota: {
        ...prev.messagesQuota,
        limit: newLimit,
      },
    }));
  };

  const calculateRemaining = (limit: number, used: number): number => {
    if (limit === -1) return -1;
    return Math.max(0, limit - used);
  };

  const remaining = calculateRemaining(formData.messagesQuota.limit, formData.messagesQuota.used);
  const originalRemaining = calculateRemaining(quota.messagesQuota.limit, quota.messagesQuota.used);
  const isUnlimited = formData.messagesQuota.limit === -1;
  const wasUnlimited = quota.messagesQuota.limit === -1;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50" onClick={onClose}></div>

      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-2xl z-50 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
          <h2 className="text-base font-semibold text-gray-900">
            <i className="fas fa-envelope text-blue-600 ml-2"></i>
            إدارة حصة الرسائل - {moderatorName}
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
          <div className="bg-blue-50 rounded-lg p-2 border border-blue-200">
            <div className="text-xs mb-1.5 font-semibold opacity-70">الحالة الحالية:</div>
            <div className="grid grid-cols-3 gap-1.5 text-center text-xs">
              <div>
                <div className="text-blue-900 opacity-70 font-medium mb-0.5 text-xs">الإجمالي</div>
                <div className="text-blue-900 font-bold text-xs">
                  {wasUnlimited ? 'غير محدود' : quota.messagesQuota.limit.toLocaleString('ar-SA')}
                </div>
              </div>
              <div>
                <div className="text-blue-900 opacity-70 font-medium mb-0.5 text-xs">المستخدم</div>
                <div className="text-blue-900 font-bold text-xs">
                  {quota.messagesQuota.used.toLocaleString('ar-SA')}
                </div>
              </div>
              <div>
                <div className="text-blue-900 opacity-70 font-medium mb-0.5 text-xs">المتبقي</div>
                <div className="text-blue-900 font-bold text-xs">
                  {wasUnlimited ? 'غير محدود' : originalRemaining.toLocaleString('ar-SA')}
                </div>
              </div>
            </div>
          </div>

          {/* Input and Mode Dropdown */}
          <div className="flex gap-2 items-end">
            <input
              type="number"
              value={formData.messagesQuota.limit === -1 ? '' : formData.messagesQuota.limit}
              onChange={(e) => handleLimitChange(e.target.value)}
              disabled={saving || isLoading || (mode === 'add' && wasUnlimited)}
              placeholder={mode === 'add' ? 'أدخل الكمية المراد إضافتها (اتركه فارغاً لغير محدود)' : 'أدخل الحد الجديد (اتركه فارغاً لغير محدود)'}
              className="flex-1 px-3 py-1.5 text-right text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as QuotaMode)}
              disabled={saving || isLoading}
              className="px-2.5 py-1.5 rounded-lg border border-blue-300 text-blue-900 border-opacity-50 text-xs font-medium whitespace-nowrap focus:outline-none focus:ring-2 disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="set">تعيين الحد</option>
              <option value="add">إضافة للحد الحالي</option>
            </select>
          </div>

          {/* Mode Description */}
          {mode === 'add' && wasUnlimited ? (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
              ⚠️ لا يمكن إضافة قيم عندما تكون الحصة غير محدودة. اختر "تعيين الحد" لتحديد حد جديد.
            </p>
          ) : (
            <p className="text-xs text-gray-600">
              {mode === 'set' 
                ? `سيتم تعيين القيمة المدخلة لتصبح هي نفسها الحد الإجمالي`
                : `سيتم إضافة القيمة المدخلة على الحد الحالي (${quota.messagesQuota.limit === -1 ? 'غير محدود' : quota.messagesQuota.limit.toLocaleString('ar-SA')})`}
            </p>
          )}

          {/* Preview */}
          {formData.messagesQuota.limit !== quota.messagesQuota.limit && (
            <div className="rounded-lg p-2 border border-green-400 border-opacity-50 bg-green-50">
              <div className="text-xs mb-1.5 font-semibold text-green-700">معاينة الحالة الجديدة:</div>
              <div className="grid grid-cols-3 gap-1.5 text-center text-xs">
                <div>
                  <div className="text-green-700 opacity-70 font-medium mb-0.5 text-xs">الإجمالي</div>
                  <div className="text-green-900 font-bold text-xs">
                    {isUnlimited ? 'غير محدود' : formData.messagesQuota.limit.toLocaleString('ar-SA')}
                  </div>
                </div>
                <div>
                  <div className="text-green-700 opacity-70 font-medium mb-0.5 text-xs">المستخدم</div>
                  <div className="text-green-900 font-bold text-xs">
                    {formData.messagesQuota.used.toLocaleString('ar-SA')}
                  </div>
                </div>
                <div>
                  <div className="text-green-700 opacity-70 font-medium mb-0.5 text-xs">المتبقي</div>
                  <div className="text-green-900 font-bold text-xs">
                    {isUnlimited ? 'غير محدود' : remaining.toLocaleString('ar-SA')}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5">
            <div className="flex gap-2">
              <i className="fas fa-info-circle text-blue-600 mt-0.5 flex-shrink-0 text-xs"></i>
              <div className="text-xs text-blue-800">
                <p className="font-semibold mb-1">ملاحظات عن الرسائل:</p>
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
            className="px-4 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
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
