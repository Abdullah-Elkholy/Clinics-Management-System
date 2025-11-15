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

  // Icon-only mode when collapsed (computed inline via isCollapsed)

  return (
    <div
      className={`
        w-full overflow-hidden transition-all duration-200 ease-out rounded-lg group flex
        ${isCollapsed
          ? 'flex-col p-2 items-center'
          : 'flex-row items-center px-1 sm:px-2 md:px-3 py-2 gap-1 min-w-0'}
        ${className}
      `}
    >
      <button
        key={id}
        onClick={onClick}
        title={isCollapsed ? doctorName : undefined}
        aria-label={`الطابور: ${doctorName}`}
        className={`
          transition-all duration-200 ease-out rounded-lg group overflow-hidden min-w-0
          ${isCollapsed
            ? 'p-2 flex justify-center w-full'
            : 'flex-1 px-1 sm:px-2 md:px-3 py-1.5 sm:py-2 text-right border-r-4 flex items-center justify-between'}
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
          <i className="fas fa-hospital text-lg group-hover:scale-110 transition-transform duration-200"></i>
        ) : (
          <div className="flex items-center justify-between w-full overflow-hidden min-w-0">
            <div className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0">
              <i className="fas fa-hospital text-sm sm:text-base text-gray-400 group-hover:text-blue-600 transition-colors duration-200 flex-shrink-0"></i>
              <div className="truncate flex-1 min-w-0">
                <p className="font-medium text-xs sm:text-sm truncate">{doctorName}</p>
                {isSelected && (
                  <p className="text-xs text-gray-500 mt-0.5 truncate">طابور نشط</p>
                )}
              </div>
            </div>
          </div>
        )}
      </button>

      {/* Action Buttons - Beside tile in expanded, below in collapsed */}
      {onEdit || onDelete ? (
        !isCollapsed ? (
          // Expanded mode: buttons beside the tile
          <div className="flex items-center gap-1 flex-shrink-0">
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
        ) : (
          // Collapsed mode: stacked icons below
          <div className="w-full flex flex-col items-center gap-1 mt-1">
            {onEdit && (
              <button
                onClick={handleEdit}
                className="w-7 h-7 rounded-full bg-white text-gray-600 hover:text-blue-600 hover:bg-blue-50 flex items-center justify-center border border-gray-200"
                title="تحرير الطابور"
                aria-label="تحرير الطابور"
              >
                <i className="fas fa-edit text-xs"></i>
              </button>
            )}
            {onDelete && (
              <button
                onClick={handleDelete}
                className="w-7 h-7 rounded-full bg-white text-gray-600 hover:text-red-600 hover:bg-red-50 flex items-center justify-center border border-gray-200"
                title="حذف الطابور"
                aria-label="حذف الطابور"
              >
                <i className="fas fa-trash text-xs"></i>
              </button>
            )}
          </div>
        )
      ) : null}
    </div>
  );
}
