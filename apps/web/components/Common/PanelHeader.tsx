/**
 * PanelHeader Component
 * 
 * Reusable header for all panels with title, icon, stats, and actions
 * Provides consistent styling and responsive layout
 */

import React from 'react';
import { formatArabicNumber } from '@/utils/numberUtils';

interface Stat {
  label: string;
  value: string | number;
  icon?: string;
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'purple';
}

interface PanelHeaderProps {
  title: string;
  icon?: string;
  description?: string;
  stats?: Stat[];
  actions?: Array<{
    label: string;
    icon?: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary' | 'danger';
    disabled?: boolean;
  }>;
  className?: string;
}

const colorMap = {
  blue: 'bg-blue-100 text-blue-600',
  green: 'bg-green-100 text-green-600',
  red: 'bg-red-100 text-red-600',
  yellow: 'bg-yellow-100 text-yellow-600',
  purple: 'bg-purple-100 text-purple-600',
};

const buttonColorMap = {
  primary: 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white',
  secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-800',
  danger: 'bg-red-600 hover:bg-red-700 text-white',
};

export function PanelHeader({
  title,
  icon,
  description,
  stats,
  actions,
  className = '',
}: PanelHeaderProps) {
  return (
    <div className={`
      bg-white rounded-lg shadow-sm border border-gray-200
      p-4 sm:p-6 mb-6
      transition-all duration-300 ease-out
      ${className}
    `}
    >
      {/* Title Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          {icon && (
            <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <i className={`fas ${icon} text-blue-600 text-lg`}></i>
            </div>
          )}
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">{title}</h1>
            {description && (
              <p className="text-gray-600 text-sm mt-1">{description}</p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        {actions && actions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {actions.map((action, index) => (
              <button
                key={index}
                onClick={action.onClick}
                disabled={action.disabled}
                className={`
                  px-4 py-2 rounded-lg font-medium transition-all duration-200
                  flex items-center gap-2 text-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                  disabled:opacity-50 disabled:cursor-not-allowed
                  active:scale-95
                  ${buttonColorMap[action.variant || 'primary']}
                `}
              >
                {action.icon && <i className={`fas ${action.icon}`}></i>}
                <span className="hidden sm:inline">{action.label}</span>
                <span className="sm:hidden">{action.icon ? '' : action.label[0]}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Stats Section */}
      {stats && stats.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.map((stat, index) => (
            <div
              key={index}
              className={`
                p-3 rounded-lg transition-all duration-200 hover:shadow-md
                ${colorMap[stat.color || 'blue']}
              `}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium opacity-75">{stat.label}</p>
                  <p className="text-lg font-bold mt-1">
                    {typeof stat.value === 'number' 
                      ? formatArabicNumber(stat.value)
                      : typeof stat.value === 'string' && /^\d+$/.test(stat.value)
                      ? formatArabicNumber(parseInt(stat.value, 10))
                      : stat.value}
                  </p>
                </div>
                {stat.icon && (
                  <i className={`fas ${stat.icon} text-2xl opacity-30`}></i>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
