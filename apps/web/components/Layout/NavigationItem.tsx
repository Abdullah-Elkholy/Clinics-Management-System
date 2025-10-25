/**
 * NavigationItem Component
 * 
 * Reusable navigation item for sidebar with collapse support
 * Handles icon, label, and active state
 */

import React from 'react';

interface NavigationItemProps {
  icon: string;
  label: string;
  isActive: boolean;
  isCollapsed: boolean;
  onClick: () => void;
  className?: string;
  ariaLabel?: string;
  badge?: number | string;
}

export function NavigationItem({
  icon,
  label,
  isActive,
  isCollapsed,
  onClick,
  className = '',
  ariaLabel,
  badge,
}: NavigationItemProps) {
  return (
    <button
      onClick={onClick}
      title={isCollapsed ? label : undefined}
      aria-label={ariaLabel || label}
      className={`
        nav-item w-full transition-all duration-200 ease-out rounded-lg group
        ${isCollapsed ? 'px-2 py-2.5' : 'px-4 py-3'}
        ${isActive
          ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md'
          : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600'
        }
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus-visible:ring-2 focus-visible:ring-blue-500
        ${className}
      `}
    >
      <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
        {!isCollapsed && (
          <span className="text-sm font-medium truncate transition-all duration-200">
            {label}
          </span>
        )}
        <div className="relative flex items-center justify-center">
          <i className={`fas ${icon} text-base transition-transform duration-200 group-hover:scale-110`}></i>
          {badge !== undefined && !isCollapsed && (
            <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
              {badge}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
