/**
 * ResponsiveTable Component
 * 
 * Mobile-friendly responsive table with collapsible rows and card view on mobile
 */

import React, { useState } from 'react';

interface Column<T> {
  key: string;
  label: string;
  width?: string;
  render?: (value: unknown, row: T) => React.ReactNode;
  mobile?: boolean; // Show on mobile
}

interface ResponsiveTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField: keyof T; // Field used as unique key
  onRowClick?: (row: T) => void;
  rowActions?: (row: T) => React.ReactNode;
  emptyMessage?: string;
  loading?: boolean;
  className?: string;
}

export function ResponsiveTable<T extends Record<string, unknown>>({
  columns,
  data,
  keyField,
  onRowClick,
  rowActions,
  emptyMessage = 'لا توجد بيانات',
  loading = false,
  className = '',
}: ResponsiveTableProps<T>) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRowExpand = (key: string) => {
    const newSet = new Set(expandedRows);
    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }
    setExpandedRows(newSet);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-gray-200 rounded-lg animate-pulse"></div>
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <i className="fas fa-inbox text-4xl mb-3 opacity-20"></i>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={`overflow-x-auto ${className}`}>
      {/* Desktop Table */}
      <table className="hidden md:table w-full">
        <thead>
          <tr className="bg-gray-50 border-b-2 border-gray-200">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 text-right font-bold text-gray-700 ${col.width || ''}`}
              >
                {col.label}
              </th>
            ))}
            {rowActions && <th className="px-4 py-3 font-bold text-gray-700 w-20">إجراءات</th>}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => {
            const rowKey = String(row[keyField]);
            return (
            <tr
              key={rowKey}
              onClick={() => onRowClick?.(row)}
              className={`
                border-b border-gray-200 hover:bg-blue-50 transition-all duration-200
                ${onRowClick ? 'cursor-pointer' : ''}
              `}
            >
              {columns.map((col) => {
                const cellValue = row[col.key];
                return (
                <td key={col.key} className="px-4 py-3 text-gray-800">
                  {col.render
                    ? col.render(cellValue, row)
                    : (cellValue as React.ReactNode) ?? ''}
                </td>
              );})}
              {rowActions && (
                <td className="px-4 py-3 text-right">
                  {rowActions(row)}
                </td>
              )}
            </tr>
          );})}
        </tbody>
      </table>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {data.map((row) => {
          const rowKey = String(row[keyField]);
          const isExpanded = expandedRows.has(rowKey);

          return (
            <div
              key={rowKey}
              className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden"
            >
              {/* Card Header */}
              <div
                onClick={() => toggleRowExpand(rowKey)}
                className="p-4 cursor-pointer hover:bg-gray-50 transition-all duration-200"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {columns
                      .filter((c) => c.mobile !== false)
                      .slice(0, 2)
                      .map((col) => {
                        const value = row[col.key];
                        return (
                        <div key={col.key} className="text-sm">
                          <span className="font-medium text-gray-600">{col.label}:</span>
                          <span className="text-gray-800 mr-2">
                            {col.render
                              ? col.render(value, row)
                              : (value as React.ReactNode) ?? ''}
                          </span>
                        </div>
                      );})}
                  </div>
                  <i
                    className={`
                      fas fa-chevron-down text-gray-400 transition-transform duration-200
                      ${isExpanded ? 'rotate-180' : ''}
                    `}
                  ></i>
                </div>
              </div>

              {/* Card Details (Expanded) */}
              {isExpanded && (
                <div className="border-t border-gray-200 bg-gray-50 p-4 space-y-2">
                  {columns.map((col) => {
                    const value = row[col.key];
                    return (
                    <div key={col.key} className="text-sm">
                      <span className="font-medium text-gray-600">{col.label}:</span>
                      <span className="text-gray-800 mr-2">
                        {col.render
                          ? col.render(value, row)
                          : (value as React.ReactNode) ?? ''}
                      </span>
                    </div>
                  );})}
                </div>
              )}

              {/* Card Actions */}
              {rowActions && (
                <div className="border-t border-gray-200 p-4 bg-gray-50 flex gap-2 justify-end">
                  {rowActions(row)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
