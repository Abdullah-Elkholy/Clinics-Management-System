'use client';

import React from 'react';

interface LoadingSpinnerProps {
    /** Size of the spinner */
    size?: 'sm' | 'md' | 'lg' | 'xl';
    /** Optional label to display below the spinner */
    label?: string;
    /** Whether to center the spinner in its container */
    centered?: boolean;
    /** Custom className */
    className?: string;
    /** Color variant */
    variant?: 'primary' | 'secondary' | 'white';
}

const sizeClasses = {
    sm: 'h-4 w-4 border-2',
    md: 'h-8 w-8 border-2',
    lg: 'h-12 w-12 border-3',
    xl: 'h-16 w-16 border-4',
};

const variantClasses = {
    primary: 'border-blue-600 border-t-transparent',
    secondary: 'border-gray-400 border-t-transparent',
    white: 'border-white border-t-transparent',
};

/**
 * LoadingSpinner Component
 * 
 * A reusable loading spinner for indicating async operations.
 * Use for buttons, inline loading, or as part of DataStateWrapper.
 * 
 * @example
 * <LoadingSpinner size="md" label="جارٍ التحميل..." />
 */
export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
    size = 'md',
    label,
    centered = true,
    className = '',
    variant = 'primary',
}) => {
    const spinner = (
        <div
            className={`
        animate-spin rounded-full
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        ${className}
      `}
            role="status"
            aria-label={label || 'جارٍ التحميل'}
        />
    );

    if (centered) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 py-8">
                {spinner}
                {label && (
                    <p className="text-sm text-gray-600 animate-pulse">{label}</p>
                )}
            </div>
        );
    }

    return (
        <div className="inline-flex items-center gap-2">
            {spinner}
            {label && <span className="text-sm text-gray-600">{label}</span>}
        </div>
    );
};

export default LoadingSpinner;
