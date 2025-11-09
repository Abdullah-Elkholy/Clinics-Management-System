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
  const aria = isCollapsed ? 'Expand sidebar' : 'Collapse sidebar';
  const title = isCollapsed ? 'توسيع الشريط الجانبي (Alt+S)' : 'طي الشريط الجانبي (Alt+S)';
  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle();
        }
      }}
      onClick={onToggle}
      className={`h-12 px-3 py-3 border-b border-gray-200 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} bg-gradient-to-r from-gray-50 to-white hover:from-gray-100 hover:to-gray-50 transition-colors duration-200 cursor-pointer flex-shrink-0`}
      title={title}
      aria-label={aria}
    >
      {!isCollapsed && (
        <h2 className="text-xs font-bold text-gray-600 uppercase tracking-wider truncate">
          القائمة
        </h2>
      )}
      {/* Icon only; entire tile is clickable. No isolated button, no extra hover color. */}
      <i
        className={`fas ${isCollapsed ? 'fa-chevron-left' : 'fa-chevron-right'} text-gray-600`}
        aria-hidden="true"
      ></i>
    </div>
  );
}
