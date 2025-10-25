/**
 * SidebarHeader Component
 * 
 * Header section with toggle button for sidebar collapse/expand
 */

import React from 'react';

interface SidebarHeaderProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

export function SidebarHeader({ isCollapsed, onToggle }: SidebarHeaderProps) {
  return (
    <div
      onClick={onToggle}
      className="px-3 py-3 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white hover:from-gray-100 hover:to-gray-50 transition-colors duration-200 cursor-pointer"
      title={isCollapsed ? 'توسيع الشريط الجانبي' : 'طي الشريط الجانبي'}
    >
      {!isCollapsed && (
        <h2 className="text-xs font-bold text-gray-600 uppercase tracking-wider truncate">
          القائمة
        </h2>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        title={isCollapsed ? 'توسيع الشريط الجانبي (Alt+S)' : 'طي الشريط الجانبي (Alt+S)'}
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className={`
          p-2 rounded-lg transition-all duration-200 ease-out
          hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500
          ${isCollapsed ? 'ml-auto' : ''}
          group
        `}
      >
        <i
          className={`
            fas transition-transform duration-300 ease-out text-gray-600 group-hover:text-blue-600
            ${isCollapsed ? 'fa-chevron-left' : 'fa-chevron-right'}
          `}
        ></i>
      </button>
    </div>
  );
}
