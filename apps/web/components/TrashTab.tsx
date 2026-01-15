/**
 * Trash Tab Component
 * File: apps/web/components/TrashTab.tsx
 * 
 * Generic trash/recycle bin tab component for displaying soft-deleted items
 * Supports pagination, restore actions, and countdown badges
 */

import React, { useState } from 'react';
import TrashCountdownBadge from './TrashCountdownBadge';
import { formatDeletionDate, getDaysRemainingInTrash, getRestoreErrorMessage, parseRestoreError } from '@/utils/trashUtils';
import { formatLocalDateTime } from '@/utils/dateTimeUtils';
import { useConfirmDialog } from '@/contexts/ConfirmationContext';
import { createRestoreConfirmation } from '@/utils/confirmationHelpers';
import { formatArabicNumber } from '@/utils/numberUtils';
import { LoadingSpinner, ErrorState, EmptyState } from '@/components/state';


type TrashItemPrimitive = string | number | boolean | null | undefined | Date;

interface TrashItem {
  id: string | number;
  name?: string;
  title?: string;
  deletedAt: string;
  deletedBy?: number | string;
  [key: string]: TrashItemPrimitive;
}

interface TrashTabProps {
  entityType: 'queue' | 'template' | 'patient' | 'user' | 'condition';
  items: TrashItem[];
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (pageNumber: number) => void;
  onRestore: (id: string | number) => Promise<void>;
  onToggleSelect?: (id: string | number) => void;
  selectedIds?: Set<string | number>;
  columns?: Array<{
    key: string;
    label: string;
    render?: (item: TrashItem) => React.ReactNode;
  }>;
  adminOnly?: boolean;
  isAdmin?: boolean;
  queues?: Array<{ id: string | number; doctorName?: string }>; // For looking up doctor names for templates
}

export const TrashTab: React.FC<TrashTabProps> = ({
  entityType,
  items,
  isLoading = false,
  isError = false,
  errorMessage = '',
  pageNumber,
  pageSize,
  totalCount,
  onPageChange,
  onRestore,
  onToggleSelect,
  selectedIds = new Set(),
  columns,
  adminOnly = false,
  isAdmin = false,
  queues = [],
}) => {
  const { confirm } = useConfirmDialog();
  const [restoring, setRestoring] = useState<Set<string | number>>(new Set());
  const [restoreErrors, setRestoreErrors] = useState<Map<string | number, string>>(new Map());

  // Default columns per entity type
  const getDefaultColumns = (): typeof columns => {
    switch (entityType) {
      case 'queue':
        return [
          { key: 'doctorName', label: 'اسم الطبيب' },
          { key: 'moderatorUsername', label: 'اسم المشرف' },
          { key: 'deletedByUsername', label: 'حذف بواسطة' },
          { key: 'deletedAt', label: 'تاريخ الحذف', render: (item) => formatLocalDateTime(item.deletedAt) },
          {
            key: 'countdown',
            label: 'الوقت المتبقي',
            render: (item) => <TrashCountdownBadge deletedAt={item.deletedAt} compact />
          },
        ];
      case 'template':
        return [
          { key: 'title', label: 'اسم القالب' },
          {
            key: 'doctorName',
            label: 'اسم الطبيب',
            render: (item) => {
              // Look up doctor name from queueId
              if (item.queueId && queues.length > 0) {
                const queue = queues.find(q => String(q.id) === String(item.queueId));
                return queue?.doctorName || '—';
              }
              return '—';
            }
          },
          { key: 'moderatorUsername', label: 'اسم المشرف' },
          { key: 'deletedByUsername', label: 'حذف بواسطة' },
          { key: 'deletedAt', label: 'تاريخ الحذف', render: (item) => formatLocalDateTime(item.deletedAt) },
          {
            key: 'countdown',
            label: 'الوقت المتبقي',
            render: (item) => <TrashCountdownBadge deletedAt={item.deletedAt} compact />
          },
        ];
      case 'patient':
        return [
          { key: 'name', label: 'اسم المريض' },
          { key: 'phone', label: 'رقم الهاتف' },
          { key: 'deletedAt', label: 'تاريخ الحذف', render: (item) => formatLocalDateTime(item.deletedAt) },
          {
            key: 'countdown',
            label: 'الوقت المتبقي',
            render: (item) => <TrashCountdownBadge deletedAt={item.deletedAt} compact />
          },
        ];
      case 'user':
        return [
          { key: 'username', label: 'اسم المستخدم' },
          { key: 'firstName', label: 'الاسم الأول' },
          { key: 'role', label: 'الدور' },
          { key: 'deletedByUsername', label: 'حذف بواسطة' },
          { key: 'deletedAt', label: 'تاريخ الحذف', render: (item) => formatLocalDateTime(item.deletedAt) },
          {
            key: 'countdown',
            label: 'الوقت المتبقي',
            render: (item) => <TrashCountdownBadge deletedAt={item.deletedAt} compact />
          },
        ];
      case 'condition':
        return [
          { key: 'name', label: 'اسم الشرط' },
          { key: 'operator', label: 'العامل' },
          { key: 'deletedAt', label: 'تاريخ الحذف', render: (item) => formatDeletionDate(item.deletedAt) },
          {
            key: 'countdown',
            label: 'الوقت المتبقي',
            render: (item) => <TrashCountdownBadge deletedAt={item.deletedAt} compact />
          },
        ];
      default:
        return [];
    }
  };

  const displayColumns = columns || getDefaultColumns();
  const totalPages = Math.ceil(totalCount / pageSize);
  const isRestorable = (item: TrashItem) => getDaysRemainingInTrash(item.deletedAt) > 0;
  const getColumnValue = (item: TrashItem, key: string): string => {
    const value = item[key];

    if (value === null || typeof value === 'undefined') {
      return '—';
    }

    if (value instanceof Date) {
      return formatLocalDateTime(value);
    }

    // Format numbers with English numerals (using Arabic locale for grouping)
    if (typeof value === 'number' || (typeof value === 'string' && !isNaN(Number(value)) && value.trim() !== '')) {
      return formatArabicNumber(value);
    }

    return String(value);
  };

  const handleRestore = async (id: string | number) => {
    const item = items.find((i) => i.id === id);
    const itemName = item?.name || item?.title || `${entityType} #${id}`;

    const confirmed = await confirm(createRestoreConfirmation(itemName));
    if (!confirmed) return;

    setRestoring((prev) => new Set([...prev, id]));
    setRestoreErrors((prev) => {
      const newErrors = new Map(prev);
      newErrors.delete(id);
      return newErrors;
    });

    try {
      await onRestore(id);
    } catch (error) {
      const restoreError = parseRestoreError(error);
      const errorMsg = getRestoreErrorMessage(restoreError);
      setRestoreErrors((prev) => new Map([...prev, [id, errorMsg]]));
    } finally {
      setRestoring((prev) => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  // Access control
  if (adminOnly && !isAdmin) {
    return (
      <div className="p-6 text-center text-gray-500">
        <p>فقط المسؤولون يمكنهم عرض العناصر المؤرشفة.</p>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="p-6">
        <LoadingSpinner size="lg" label="جاري التحميل..." />
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="p-6">
        <ErrorState
          title="فشل تحميل العناصر المحذوفة"
          message={errorMessage || 'حدث خطأ أثناء تحميل البيانات'}
          compact
        />
      </div>
    );
  }

  // Empty state
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<i className="fas fa-inbox text-4xl text-gray-300" />}
        title="المهملات فارغة"
        description="ستظهر العناصر المحذوفة هنا لمدة 30 يومًا قبل الحذف الدائم."
      />
    );
  }

  return (
    <div className="space-y-4" dir="rtl">
      {/* Table */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="w-full text-sm" dir="rtl">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {onToggleSelect && (
                <th className="px-4 py-3 text-right">
                  <input
                    type="checkbox"
                    checked={selectedIds.size > 0}
                    onChange={(e) => {
                      // Toggle select all
                      if (e.target.checked) {
                        items.forEach((item) => onToggleSelect(item.id));
                      } else {
                        selectedIds.forEach((id) => onToggleSelect(id));
                      }
                    }}
                    className="rounded border-gray-300"
                  />
                </th>
              )}
              {displayColumns.map((col) => (
                <th key={col.key} className="px-4 py-3 text-right font-medium text-gray-700">
                  {col.label}
                </th>
              ))}
              <th className="px-4 py-3 text-right font-medium text-gray-700">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {items.map((item) => {
              const isRestoring = restoring.has(item.id);
              const restoreError = restoreErrors.get(item.id);
              const canRestore = isRestorable(item);

              return (
                <React.Fragment key={item.id}>
                  <tr className="hover:bg-gray-50">
                    {onToggleSelect && (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(item.id)}
                          onChange={() => onToggleSelect(item.id)}
                          className="rounded border-gray-300"
                        />
                      </td>
                    )}
                    {displayColumns.map((col) => (
                      <td key={col.key} className="px-4 py-3 text-gray-900 text-right">
                        {col.render ? col.render(item) : getColumnValue(item, col.key)}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right">
                      {adminOnly ? (
                        <span className="text-xs text-gray-500">مؤرشف</span>
                      ) : (
                        <button
                          onClick={() => handleRestore(item.id)}
                          disabled={isRestoring || !canRestore}
                          className={`px-3 py-1 rounded text-sm font-medium transition flex items-center gap-2 ${isRestoring
                            ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                            : canRestore
                              ? 'bg-blue-100 text-blue-700 hover:bg-blue-200 cursor-pointer'
                              : 'bg-gray-100 text-gray-500 cursor-not-allowed'
                            }`}
                          title={canRestore ? 'استعادة هذا العنصر' : 'لم يعد من الممكن استعادة هذا العنصر (منتهي الصلاحية)'}
                        >
                          {isRestoring ? (
                            <>
                              <i className="fas fa-spinner fa-spin"></i>
                              <span>جاري الاستعادة...</span>
                            </>
                          ) : (
                            <>
                              <i className="fas fa-undo"></i>
                              <span>استعادة</span>
                            </>
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                  {restoreError && (
                    <tr className="bg-red-50">
                      <td colSpan={displayColumns.length + (onToggleSelect ? 2 : 1)} className="px-4 py-3">
                        <p className="text-sm text-red-800">{restoreError}</p>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            عرض {formatArabicNumber((pageNumber - 1) * pageSize + 1)} إلى{' '}
            {formatArabicNumber(Math.min(pageNumber * pageSize, totalCount))} من {formatArabicNumber(totalCount)} عنصر
          </p>
          <div className="space-x-2">
            <button
              onClick={() => onPageChange(pageNumber - 1)}
              disabled={pageNumber === 1}
              className="px-4 py-2 rounded border border-gray-300 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              السابق
            </button>
            <button
              onClick={() => onPageChange(pageNumber + 1)}
              disabled={pageNumber >= totalPages}
              className="px-4 py-2 rounded border border-gray-300 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              التالي
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrashTab;
