/**
 * TabNavigation Component
 * 
 * Responsive tab navigation for queue panel sections
 * Shows all tabs with active indicator and smooth transitions
 */

import React from 'react';

interface Tab {
  id: string;
  label: string;
  icon?: string;
  badge?: number;
  description?: string;
}

interface TabNavigationProps {
  tabs: Tab[];
  activeTabId: string;
  onTabChange: (tabId: string) => void;
  className?: string;
}

export function TabNavigation({
  tabs,
  activeTabId,
  onTabChange,
  className = '',
}: TabNavigationProps) {
  const activeTab = tabs.find((t) => t.id === activeTabId);

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 mb-6 ${className}`}>
      {/* Tabs */}
      <div className="flex flex-wrap gap-0 border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`
              flex-1 min-w-min px-4 sm:px-6 py-4
              transition-all duration-200 ease-out
              relative group
              border-b-2 border-transparent
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
              ${activeTabId === tab.id
                ? 'border-b-blue-600 bg-blue-50'
                : 'hover:bg-gray-50 border-b-gray-200'
              }
            `}
          >
            {/* Tab Content */}
            <div className="flex items-center justify-center gap-2 sm:gap-3">
              {tab.icon && (
                <i
                  className={`
                    fas ${tab.icon} transition-all duration-200
                    ${activeTabId === tab.id ? 'text-blue-600' : 'text-gray-500 group-hover:text-blue-600'}
                  `}
                ></i>
              )}
              <div className="flex flex-col items-start">
                <span
                  className={`
                    font-medium text-sm transition-all duration-200
                    ${activeTabId === tab.id
                      ? 'text-blue-600'
                      : 'text-gray-700 group-hover:text-blue-600'
                    }
                  `}
                >
                  {tab.label}
                </span>
                {tab.description && (
                  <span className="text-xs text-gray-500 hidden sm:block">
                    {tab.description}
                  </span>
                )}
              </div>
              {tab.badge !== undefined && (
                <span
                  className={`
                    inline-flex items-center justify-center
                    min-w-6 h-6 rounded-full text-xs font-bold
                    transition-all duration-200
                    ${activeTabId === tab.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-800'
                    }
                  `}
                >
                  {tab.badge}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Active Tab Description (Mobile) */}
      {activeTab?.description && (
        <div className="sm:hidden px-4 py-3 bg-blue-50 border-t border-gray-200 text-xs text-gray-600">
          {activeTab.description}
        </div>
      )}
    </div>
  );
}
