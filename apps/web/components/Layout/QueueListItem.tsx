/**
 * QueueListItem Component
 * 
 * Reusable queue item for sidebar with collapse support
 */

import React from 'react';

interface QueueListItemProps {
  id: string;
  doctorName: string;
  isSelected: boolean;
  isCollapsed: boolean;
  onClick: () => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  className?: string;
}

export function QueueListItem({
  id,
  doctorName,
  isSelected,
  isCollapsed,
  onClick,
  onEdit,
  onDelete,
  className = '',
}: QueueListItemProps) {
  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.(id);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.(id);
  };

  return (
    <div
      className={`
        w-full transition-all duration-200 ease-out rounded-lg group flex items-center gap-2
        ${isCollapsed ? 'p-2.5 justify-center' : 'px-4 py-3'}
        ${className}
      `}
    >
      <button
        key={id}
        onClick={onClick}
        title={isCollapsed ? doctorName : undefined}
        aria-label={`الطابور: ${doctorName}`}
        className={`
          flex-1 transition-all duration-200 ease-out rounded-lg group
          ${isCollapsed ? 'p-2.5 flex justify-center' : 'px-4 py-3 text-right border-r-4'}
          ${isSelected
            ? isCollapsed
              ? 'bg-blue-100 text-blue-600 border-l-4 border-l-blue-600'
              : 'bg-gradient-to-r from-blue-50 to-blue-100 border-r-blue-600 text-blue-600 font-medium shadow-sm'
            : isCollapsed
              ? 'text-gray-700 hover:bg-gray-100'
              : 'border-r-transparent text-gray-700 hover:bg-gray-50'
          }
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
        `}
      >
        {isCollapsed ? (
          <i className="fas fa-hospital text-base group-hover:scale-110 transition-transform duration-200"></i>
        ) : (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 flex-1">
              <i className="fas fa-hospital text-gray-400 group-hover:text-blue-600 transition-colors duration-200"></i>
              <div className="truncate flex-1">
                <p className="font-medium text-sm truncate">{doctorName}</p>
                {isSelected && (
                  <p className="text-xs text-gray-500 mt-0.5">طابور نشط</p>
                )}
              </div>
            </div>
          </div>
        )}
      </button>

      {/* Action Buttons - Show only when not collapsed */}
      {!isCollapsed && (onEdit || onDelete) && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          {onEdit && (
            <button
              onClick={handleEdit}
              className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors duration-200"
              title="تحرير الطابور"
              aria-label="تحرير الطابور"
            >
              <i className="fas fa-edit text-sm"></i>
            </button>
          )}
          {onDelete && (
            <button
              onClick={handleDelete}
              className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors duration-200"
              title="حذف الطابور"
              aria-label="حذف الطابور"
            >
              <i className="fas fa-trash text-sm"></i>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
