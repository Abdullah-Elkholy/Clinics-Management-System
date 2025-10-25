/**
 * EmptyState Component
 * 
 * Reusable empty state display for when there's no data
 * Shows icon, title, message, and optional action button
 */

import React from 'react';

interface EmptyStateProps {
  icon: string;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`
      flex flex-col items-center justify-center py-12 px-4
      ${className}
    `}
    >
      {/* Icon */}
      <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4 animate-bounce">
        <i className={`fas ${icon} text-3xl text-blue-600`}></i>
      </div>

      {/* Title */}
      <h3 className="text-lg font-bold text-gray-800 mb-2 text-center">{title}</h3>

      {/* Message */}
      <p className="text-gray-600 text-center max-w-sm mb-6">{message}</p>

      {/* Action Button */}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className={`
            px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700
            text-white rounded-lg font-medium
            hover:from-blue-700 hover:to-blue-800 transition-all duration-200
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
            active:scale-95
          `}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
