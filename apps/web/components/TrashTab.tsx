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
import { useConfirmDialog } from '@/contexts/ConfirmationContext';
import { createRestoreConfirmation } from '@/utils/confirmationHelpers';

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
}) => {
  const { confirm } = useConfirmDialog();
  const [restoring, setRestoring] = useState<Set<string | number>>(new Set());
  const [restoreErrors, setRestoreErrors] = useState<Map<string | number, string>>(new Map());

  // Default columns per entity type
  const getDefaultColumns = (): typeof columns => {
    switch (entityType) {
      case 'queue':
        return [
          { key: 'doctorName', label: 'Doctor Name' },
          { key: 'deletedAt', label: 'Deleted', render: (item) => formatDeletionDate(item.deletedAt) },
          { 
            key: 'countdown', 
            label: 'Time Remaining',
            render: (item) => <TrashCountdownBadge deletedAt={item.deletedAt} compact />
          },
        ];
      case 'template':
        return [
          { key: 'title', label: 'Template Name' },
          { key: 'queueId', label: 'Queue ID' },
          { key: 'deletedAt', label: 'Deleted', render: (item) => formatDeletionDate(item.deletedAt) },
          { 
            key: 'countdown', 
            label: 'Time Remaining',
            render: (item) => <TrashCountdownBadge deletedAt={item.deletedAt} compact />
          },
        ];
      case 'patient':
        return [
          { key: 'name', label: 'Patient Name' },
          { key: 'phone', label: 'Phone' },
          { key: 'deletedAt', label: 'Deleted', render: (item) => formatDeletionDate(item.deletedAt) },
          { 
            key: 'countdown', 
            label: 'Time Remaining',
            render: (item) => <TrashCountdownBadge deletedAt={item.deletedAt} compact />
          },
        ];
      case 'user':
        return [
          { key: 'username', label: 'Username' },
          { key: 'firstName', label: 'First Name' },
          { key: 'role', label: 'Role' },
          { key: 'deletedAt', label: 'Deleted', render: (item) => formatDeletionDate(item.deletedAt) },
          { 
            key: 'countdown', 
            label: 'Time Remaining',
            render: (item) => <TrashCountdownBadge deletedAt={item.deletedAt} compact />
          },
        ];
      case 'condition':
        return [
          { key: 'name', label: 'Condition Name' },
          { key: 'operator', label: 'Operator' },
          { key: 'deletedAt', label: 'Deleted', render: (item) => formatDeletionDate(item.deletedAt) },
          { 
            key: 'countdown', 
            label: 'Time Remaining',
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
      return value.toISOString();
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
        <p>Only administrators can view archived items.</p>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="p-6 text-center">
        <div className="inline-block">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
        <p className="mt-2 text-gray-600">Loading...</p>
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-800 font-medium">Error loading trash items</p>
        {errorMessage && <p className="text-red-700 text-sm mt-1">{errorMessage}</p>}
      </div>
    );
  }

  // Empty state
  if (items.length === 0) {
    return (
      <div className="p-12 text-center text-gray-500">
        <svg
          className="mx-auto h-12 w-12 text-gray-400 mb-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
          />
        </svg>
        <p className="text-lg font-medium">المهملات فارغة</p>
        <p className="text-sm text-gray-400 mt-1">ستظهر العناصر المحذوفة هنا لمدة 30 يومًا قبل الحذف الدائم.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Table */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {onToggleSelect && (
                <th className="px-4 py-3 text-left">
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
                <th key={col.key} className="px-4 py-3 text-left font-medium text-gray-700">
                  {col.label}
                </th>
              ))}
              <th className="px-4 py-3 text-right font-medium text-gray-700">Actions</th>
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
                      <td key={col.key} className="px-4 py-3 text-gray-900">
                        {col.render ? col.render(item) : getColumnValue(item, col.key)}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right">
                      {adminOnly ? (
                        <span className="text-xs text-gray-500">Archived</span>
                      ) : (
                        <button
                          onClick={() => handleRestore(item.id)}
                          disabled={isRestoring || !canRestore}
                          className={`px-3 py-1 rounded text-sm font-medium transition ${
                            isRestoring
                              ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                              : canRestore
                              ? 'bg-blue-100 text-blue-700 hover:bg-blue-200 cursor-pointer'
                              : 'bg-gray-100 text-gray-500 cursor-not-allowed'
                          }`}
                          title={canRestore ? 'Restore this item' : 'Item is no longer restorable (expired)'}
                        >
                          {isRestoring ? 'Restoring...' : 'Restore'}
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
            Showing {(pageNumber - 1) * pageSize + 1} to{' '}
            {Math.min(pageNumber * pageSize, totalCount)} of {totalCount} items
          </p>
          <div className="space-x-2">
            <button
              onClick={() => onPageChange(pageNumber - 1)}
              disabled={pageNumber === 1}
              className="px-4 py-2 rounded border border-gray-300 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Previous
            </button>
            <button
              onClick={() => onPageChange(pageNumber + 1)}
              disabled={pageNumber >= totalPages}
              className="px-4 py-2 rounded border border-gray-300 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrashTab;
