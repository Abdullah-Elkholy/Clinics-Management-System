/**
 * TabItem Component
 * 
 * Reusable tab item for queue panel tabs
 */

import React from 'react';

interface TabItemProps {
  icon: string;
  label: string;
  isActive: boolean;
  onClick: (e?: React.MouseEvent) => void;
  className?: string;
  ariaLabel?: string;
  badge?: number; // Notification badge count (hidden when 0)
  pulse?: boolean; // Show pulsing animation when actively processing
}

export function TabItem({
  icon,
  label,
  isActive,
  onClick,
  className = '',
  ariaLabel,
  badge,
  pulse,
}: TabItemProps) {
  return (
    <button
      onClick={onClick}
      role="tab"
      aria-selected={isActive}
      aria-label={ariaLabel || label}
      className={`
        w-full text-right px-4 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
        ${isActive
          ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md'
          : 'bg-white text-gray-700 hover:bg-blue-50 hover:text-blue-600 border border-gray-200'
        }
        ${pulse ? 'animate-pulse ring-2 ring-blue-400 ring-opacity-75' : ''}
        ${className}
      `}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="truncate">{label}</span>
          {/* Notification badge */}
          {badge !== undefined && badge > 0 && (
            <span className={`
              inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold rounded-full
              ${isActive ? 'bg-white text-blue-600' : 'bg-red-500 text-white'}
            `}>
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </div>
        <i className={`fas ${icon} transition-transform duration-200 group-hover:scale-110`}></i>
      </div>
    </button>
  );
}

