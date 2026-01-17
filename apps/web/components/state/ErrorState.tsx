'use client';

import React from 'react';

interface ErrorStateProps {
    /** Main error title */
    title?: string;
    /** Detailed error message */
    message?: string;
    /** Callback for retry action */
    onRetry?: () => void;
    /** Custom retry button label */
    retryLabel?: string;
    /** Custom icon (ReactNode) */
    icon?: React.ReactNode;
    /** Additional CSS classes */
    className?: string;
    /** Compact mode for inline use */
    compact?: boolean;
}

/**
 * ErrorState Component
 * 
 * Displays a user-friendly error message with optional retry action.
 * Used when data fetching fails or an unexpected error occurs.
 * 
 * @example
 * <ErrorState
 *   title="حدث خطأ"
 *   message="تعذر تحميل البيانات. يرجى المحاولة مرة أخرى."
 *   onRetry={() => refetch()}
 * />
 */
export const ErrorState: React.FC<ErrorStateProps> = ({
    title = 'حدث خطأ',
    message = 'تعذر تحميل البيانات. يرجى المحاولة مرة أخرى.',
    onRetry,
    retryLabel = 'إعادة المحاولة',
    icon,
    className = '',
    compact = false,
}) => {
    const defaultIcon = (
        <svg
            className="w-12 h-12 text-red-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
        </svg>
    );

    if (compact) {
        return (
            <div className={`flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg ${className}`}>
                <div className="text-red-500">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <div className="flex-1">
                    <p className="text-sm text-red-800">{message}</p>
                </div>
                {onRetry && (
                    <button
                        onClick={onRetry}
                        className="text-sm font-medium text-red-600 hover:text-red-800 transition-colors"
                    >
                        {retryLabel}
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className={`flex flex-col items-center justify-center py-12 px-4 ${className}`}>
            {/* Icon */}
            <div className="mb-4 opacity-80">
                {icon || defaultIcon}
            </div>

            {/* Title */}
            <h3 className="text-lg font-semibold text-gray-900 mb-2 text-center">
                {title}
            </h3>

            {/* Message */}
            <p className="text-sm text-gray-600 text-center max-w-sm mb-6">
                {message}
            </p>

            {/* Retry Button */}
            {onRetry && (
                <button
                    onClick={onRetry}
                    className={`
            inline-flex items-center gap-2 px-4 py-2
            bg-red-600 hover:bg-red-700
            text-white text-sm font-medium
            rounded-lg transition-colors
            focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2
          `}
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {retryLabel}
                </button>
            )}
        </div>
    );
};

export default ErrorState;
