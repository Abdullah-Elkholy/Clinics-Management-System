'use client';

import React, { useState } from 'react';
import { ModeratorQuota, User } from '@/types/user';
import { formatLocalDate } from '@/utils/dateTimeUtils';

interface ModeratorQuotaModalProps {
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
 * ModeratorQuotaModal - Edit moderator quota limits
 * Features:
 * - Three-column breakdown: total, used, remaining
 * - SET (replace total) or ADD (add to current) mode dropdown
 * - Handle empty field as unlimited (-1)
 * - Accumulative quota warning
 */
export default function ModeratorQuotaModal({
  quota,
  moderatorName,
  moderatorData,
  isOpen,
  onClose,
  onSave,
  isLoading = false,
}: ModeratorQuotaModalProps) {
  const [formData, setFormData] = useState<ModeratorQuota>(quota);
  const [messagesMode, setMessagesMode] = useState<QuotaMode>('set');
  const [queuesMode, setQueuesMode] = useState<QuotaMode>('set');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      // Validate: limits should be positive or -1 for unlimited
      if (
        formData.messagesQuota.limit < -1 ||
        formData.queuesQuota.limit < -1
      ) {
        setError('الحدود يجب أن تكون موجبة أو غير محدودة');
        setSaving(false);
        return;
      }

      // Validate: Cannot add values when currently unlimited
      if (messagesMode === 'add' && quota.messagesQuota.limit === -1) {
        setError('لا يمكن إضافة قيم عندما تكون الحصة غير محدودة حالياً للرسائل. اختر "تعيين الحد" بدلاً من ذلك');
        setSaving(false);
        return;
      }

      if (queuesMode === 'add' && quota.queuesQuota.limit === -1) {
        setError('لا يمكن إضافة قيم عندما تكون الحصة غير محدودة حالياً للعيادات. اختر "تعيين الحد" بدلاً من ذلك');
        setSaving(false);
        return;
      }

      await onSave(formData);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'فشل حفظ الحصة'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleMessagesLimitChange = (value: string) => {
    const inputValue = value === '' ? -1 : parseInt(value, 10) || -1;
    const currentLimit = quota.messagesQuota.limit;

    // Validation: Cannot add when currently unlimited
    if (messagesMode === 'add' && currentLimit === -1) {
      return;
    }

    let newLimit = inputValue;
    if (messagesMode === 'add' && inputValue !== -1) {
      // In ADD mode, add to current limit (not used)
      if (currentLimit === -1) {
        newLimit = -1; // If unlimited, stays unlimited
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

  const handleQueuesLimitChange = (value: string) => {
    const inputValue = value === '' ? -1 : parseInt(value, 10) || -1;
    const currentLimit = quota.queuesQuota.limit;

    // Validation: Cannot add when currently unlimited
    if (queuesMode === 'add' && currentLimit === -1) {
      return;
    }

    let newLimit = inputValue;
    if (queuesMode === 'add' && inputValue !== -1) {
      // In ADD mode, add to current limit (not used)
      if (currentLimit === -1) {
        newLimit = -1; // If unlimited, stays unlimited
      } else {
        newLimit = currentLimit + inputValue;
      }
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

  const renderQuotaSection = (
    title: string,
    icon: string,
    quotaData: ModeratorQuota['messagesQuota'],
    originalQuotaData: ModeratorQuota['messagesQuota'],
    mode: QuotaMode,
    onModeChange: (mode: QuotaMode) => void,
    onLimitChange: (value: string) => void,
    bgColor: string,
    textColor: string
  ) => {
    const remaining = calculateRemaining(quotaData.limit, quotaData.used);
    const originalRemaining = calculateRemaining(originalQuotaData.limit, originalQuotaData.used);
    const isUnlimited = quotaData.limit === -1;
    const wasUnlimited = originalQuotaData.limit === -1;

    return (
      <div className="space-y-3">
        {/* Title */}
        <label className="block">
          <span className={`text-xs font-semibold ${textColor} flex items-center gap-2`}>
            <i className={`fas ${icon} text-xs`}></i>
            {title}
          </span>
        </label>

        {/* Current State - Read Only */}
        <div className={`${bgColor} rounded-lg p-2 border ${textColor} border-opacity-20`}>
          <div className="text-xs mb-1.5 font-semibold opacity-70">الحالة الحالية:</div>
          <div className="grid grid-cols-3 gap-1.5 text-center text-xs">
            {/* Total */}
            <div>
              <div className={`${textColor} opacity-70 font-medium mb-0.5 text-xs`}>الإجمالي</div>
              <div className={`${textColor} font-bold text-xs`}>
                {wasUnlimited ? 'غير محدود' : originalQuotaData.limit.toLocaleString('ar-EG-u-nu-latn')}
              </div>
            </div>
            {/* Used */}
            <div>
              <div className={`${textColor} opacity-70 font-medium mb-0.5 text-xs`}>المستخدم</div>
              <div className={`${textColor} font-bold text-xs`}>
                {originalQuotaData.used.toLocaleString('ar-EG-u-nu-latn')}
              </div>
            </div>
            {/* Remaining */}
            <div>
              <div className={`${textColor} opacity-70 font-medium mb-0.5 text-xs`}>المتبقي</div>
              <div className={`${textColor} font-bold text-xs`}>
                {wasUnlimited ? 'غير محدود' : originalRemaining.toLocaleString('ar-EG-u-nu-latn')}
              </div>
            </div>
          </div>
        </div>

        {/* Input and Mode Dropdown */}
        <div className="flex gap-2 items-end">
          <input
            type="number"
            value={quotaData.limit === -1 ? '' : quotaData.limit}
            onChange={(e) => onLimitChange(e.target.value)}
            disabled={saving || isLoading || (mode === 'add' && wasUnlimited)}
            placeholder={mode === 'add' ? 'أدخل الكمية المراد إضافتها (اتركه فارغاً لتجعله غير محدود)' : 'أدخل الحد الجديد (اتركه فارغاً لتجعله غير محدود)'}
            className="flex-1 px-3 py-1.5 text-right text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
          <select
            value={mode}
            onChange={(e) => {
              const newMode = e.target.value as QuotaMode | 'unlimited';
              if (newMode === 'unlimited') {
                onModeChange('set');
                onLimitChange(''); // Set to unlimited
              } else {
                onModeChange(newMode);
              }
            }}
            disabled={saving || isLoading}
            className={`px-2.5 py-1.5 rounded border ${textColor} border-opacity-50 text-xs font-medium whitespace-nowrap focus:outline-none focus:ring-2 disabled:bg-gray-100 disabled:cursor-not-allowed`}
          >
            <option value="set">تعيين الحد</option>
            <option value="add">إضافة للحد الحالي</option>
            <option value="unlimited">تعيين غير محدود</option>
          </select>
        </div>

        {/* Mode Description */}
        {mode === 'add' && wasUnlimited ? (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
            ⚠️ لا يمكن إضافة قيم عندما تكون الحصة غير محدودة. اختر "تعيين الحد" لتحديد حد جديد.
          </p>
        ) : (
          <p className="text-xs text-gray-600">
            {mode === 'set'
              ? `سيتم تعيين القيمة المدخلة لتصبح هي نفسها الحد الإجمالي`
              : `سيتم إضافة القيمة المدخلة على الحد الحالي (${originalQuotaData.limit === -1 ? 'غير محدود' : originalQuotaData.limit.toLocaleString('ar-EG-u-nu-latn')})`}
          </p>
        )}

        {/* Preview - New State */}
        {quotaData.limit !== originalQuotaData.limit && (
          <div className={`${bgColor} rounded-lg p-2 border border-green-400 border-opacity-50 bg-green-50`}>
            <div className="text-xs mb-1.5 font-semibold text-green-700">معاينة الحالة الجديدة:</div>
            <div className="grid grid-cols-3 gap-1.5 text-center text-xs">
              {/* Total */}
              <div>
                <div className="text-green-700 opacity-70 font-medium mb-0.5 text-xs">الإجمالي</div>
                <div className="text-green-900 font-bold text-xs">
                  {isUnlimited ? 'غير محدود' : quotaData.limit.toLocaleString('ar-EG-u-nu-latn')}
                </div>
              </div>
              {/* Used */}
              <div>
                <div className="text-green-700 opacity-70 font-medium mb-0.5 text-xs">المستخدم</div>
                <div className="text-green-900 font-bold text-xs">
                  {quotaData.used.toLocaleString('ar-EG-u-nu-latn')}
                </div>
              </div>
              {/* Remaining */}
              <div>
                <div className="text-green-700 opacity-70 font-medium mb-0.5 text-xs">المتبقي</div>
                <div className="text-green-900 font-bold text-xs">
                  {isUnlimited ? 'غير محدود' : remaining.toLocaleString('ar-EG-u-nu-latn')}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        onClick={onClose}
      ></div>

      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-2xl z-50 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
          <h2 className="text-base font-semibold text-gray-900">
            <i className="fas fa-tachometer-alt text-blue-600 ml-2"></i>
            إدارة الحصة - {moderatorName}
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
          {/* Moderator Data */}
          {moderatorData && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-3 border border-blue-100">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-gray-600 font-medium text-xs">اسم المستخدم:</span>
                  <p className="text-gray-900 font-semibold text-xs">@{moderatorData.username}</p>
                </div>
                <div>
                  <span className="text-gray-600 font-medium text-xs">الحالة:</span>
                  <p className="text-gray-900 font-semibold text-xs">
                    {moderatorData.isActive ? '✅ مفعّل' : '❌ معطّل'}
                  </p>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-600 font-medium text-xs">آخر دخول:</span>
                  <p className="text-gray-900 font-semibold text-xs">
                    {moderatorData.lastLogin
                      ? formatLocalDate(moderatorData.lastLogin)
                      : 'لم يدخل بعد'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}

          {/* Messages Quota Section */}
          {renderQuotaSection(
            'حد الرسائل',
            'fa-envelope',
            formData.messagesQuota,
            quota.messagesQuota,
            messagesMode,
            setMessagesMode,
            handleMessagesLimitChange,
            'bg-blue-50',
            'text-blue-900'
          )}

          {/* Divider */}
          <div className="border-t border-gray-200"></div>

          {/* Queues Quota Section */}
          {renderQuotaSection(
            'حد العيادات',
            'fa-layer-group',
            formData.queuesQuota,
            quota.queuesQuota,
            queuesMode,
            setQueuesMode,
            handleQueuesLimitChange,
            'bg-purple-50',
            'text-purple-900'
          )}

          {/* Important Note */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 space-y-1.5">
            <div className="flex gap-2">
              <i className="fas fa-info-circle text-blue-600 mt-0.5 flex-shrink-0 text-xs"></i>
              <div className="text-xs text-blue-800">
                <p className="font-semibold mb-1">ملاحظات هامة:</p>
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
            className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {saving || isLoading ? (
              <>
                <i className="fas fa-spinner animate-spin"></i>
                جارٍ...
              </>
            ) : (
              <>
                <i className="fas fa-save text-xs"></i>
                حفظ
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}

