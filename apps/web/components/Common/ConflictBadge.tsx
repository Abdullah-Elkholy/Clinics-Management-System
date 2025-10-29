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
 * Displays inline warning message for conflicts
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
  const totalConflicts = overlappingConditions.length + (hasDefaultConflict ? 1 : 0);

  if (totalConflicts === 0) return null;

  return (
    <div className={`bg-red-50 border-l-4 border-red-400 rounded-lg p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <i className="fas fa-exclamation-triangle text-red-600 mt-1 flex-shrink-0"></i>
        <div className="flex-1">
          <p className="text-sm font-semibold text-red-800 mb-2">
            تحذير: تضارب في الشروط
          </p>

          {hasDefaultConflict && (
            <p className="text-sm text-red-700 mb-2">
              <i className="fas fa-circle text-red-500 ml-1"></i>
              تم تعريف أكثر من قالب افتراضي واحد (DEFAULT). يمكن أن يكون هناك قالب افتراضي واحد فقط.
            </p>
          )}

          {overlappingConditions.length > 0 && (
            <div>
              <p className="text-sm text-red-700 mb-1">
                <i className="fas fa-circle text-red-500 ml-1"></i>
                تم اكتشاف شروط متداخلة:
              </p>
              <ul className="space-y-1 ml-5">
                {overlappingConditions.map((overlap, idx) => (
                  <li key={idx} className="text-sm text-red-700 flex items-center gap-2 mr-4 mb-1">
                    <span className="text-red-500">•</span>
                    {overlap.description}
                  </li>
                ))}
              </ul>
                <p className="text-sm text-red-700 mb-1">
                <i className="fas fa-circle text-red-500 ml-1"></i>
                يرجى مراجعة الشروط المتداخلة أعلاه لتتمكن من إرسال الرسائل.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
