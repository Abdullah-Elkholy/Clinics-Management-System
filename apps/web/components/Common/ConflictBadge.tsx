/**
 * Conflict Badge Component
 * 
 * Displays warning badge for conflicting conditions
 * Used in QueueHeader and QueueDashboard
 */

'use client';

import React from 'react';

interface ConflictBadgeProps {
  conflictCount: number;
  hasDefaultConflict?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

export function ConflictBadge({
  conflictCount,
  hasDefaultConflict = false,
  onClick,
  size = 'md',
}: ConflictBadgeProps) {
  if (conflictCount === 0) return null;

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base',
  };

  const tooltip = hasDefaultConflict
    ? `⚠️ ${conflictCount} تضارب في الشروط (شروط متداخلة أو قوالب افتراضية متعددة)`
    : `⚠️ ${conflictCount} شرط متداخل`;

  return (
    <button
      onClick={onClick}
      title={tooltip}
      className={`
        ${sizeClasses[size]}
        inline-flex items-center gap-1.5
        bg-red-100 hover:bg-red-150 text-red-700 hover:text-red-800
        border border-red-300 hover:border-red-400
        rounded-full font-semibold
        transition-colors duration-200
        cursor-pointer
      `}
    >
      <i className="fas fa-exclamation-triangle"></i>
      {conflictCount}
    </button>
  );
}

/**
 * Inline Conflict Warning
 * 
 * Displays inline warning message for conflicts - Collapsible
 */
interface ConflictWarningProps {
  overlappingConditions: Array<{ id1: string; id2: string; description: string }>;
  hasDefaultConflict?: boolean;
  className?: string;
}

export function ConflictWarning({
  overlappingConditions,
  hasDefaultConflict = false,
  className = '',
}: ConflictWarningProps) {
  const [isExpanded, setIsExpanded] = React.useState(true);
  const totalConflicts = overlappingConditions.length + (hasDefaultConflict ? 1 : 0);

  if (totalConflicts === 0) return null;

  return (
    <div className={`bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-400 rounded-xl overflow-hidden shadow-lg shadow-red-200 ${className}`}>
      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between hover:bg-red-200 hover:bg-opacity-30 transition-colors px-4 py-3"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-red-200">
            <i className="fas fa-circle-xmark text-red-700 text-lg"></i>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-red-900">
              تعذر إرسال الرسائل
            </p>
            <span className="inline-block px-2 py-0.5 bg-red-200 text-red-800 text-xs font-semibold rounded-full">
              محظور
            </span>
          </div>
        </div>
        <i className={`fas fa-chevron-down text-red-700 text-lg transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}></i>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <>
          <div className="border-t-2 border-red-300"></div>
          <div className="px-4 py-3">
            <p className="text-xs text-red-800 mb-3 leading-relaxed">
              لا يمكنك إرسال رسائل حالياً. يجب حل جميع العناصر أدناه أولاً:
            </p>
            <div className="space-y-2">
              {overlappingConditions.length > 0 && (
                <div className="bg-white bg-opacity-60 rounded-lg p-2.5 border-l-3 border-red-500">
                  <p className="font-semibold text-red-800 flex items-center gap-2 mb-2 text-xs">
                    <i className="fas fa-code-merge text-red-600 text-sm"></i>
                    حل تضاربات الشروط المتداخلة
                  </p>
                  <div className="ml-6 space-y-1.5">
                    {overlappingConditions.map((overlap, idx) => (
                      <div key={idx} className="text-xs text-red-700 flex items-start gap-2 bg-red-50 rounded p-2">
                        <span className="text-red-500 font-bold mt-0.5 flex-shrink-0">→</span>
                        <span className="leading-relaxed">{overlap.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {hasDefaultConflict && (
                <div className="bg-white bg-opacity-60 rounded-lg p-2.5 border-l-3 border-amber-500 flex items-start gap-2">
                  <i className="fas fa-star text-amber-600 text-sm mt-0.5 flex-shrink-0"></i>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-amber-900 mb-1">
                      أضف شرط افتراضي
                    </p>
                    <p className="text-xs text-amber-800 leading-relaxed">
                      قالب يتم استخدامه عندما لا تنطبق أي شروط أخرى
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
