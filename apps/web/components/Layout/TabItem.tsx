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
}

export function TabItem({
  icon,
  label,
  isActive,
  onClick,
  className = '',
  ariaLabel,
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
        ${className}
      `}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate">{label}</span>
        <i className={`fas ${icon} transition-transform duration-200 group-hover:scale-110`}></i>
      </div>
    </button>
  );
}
