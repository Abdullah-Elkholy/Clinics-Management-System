'use client';

import React from 'react';

interface EmptyStateProps {
  /** Icon element to display (ReactNode or string for FA icon class) */
  icon?: React.ReactNode | string;
  /** Main empty state title/heading */
  title: string;
  /** Descriptive text */
  description?: string;
  /** @deprecated Use 'description' instead. Alias for backward compatibility. */
  message?: string;
  /** Primary action button label */
  actionLabel?: string;
  /** Callback when action button is clicked */
  onAction?: () => void;
  /** Secondary action button label */
  secondaryActionLabel?: string;
  /** Callback when secondary action button is clicked */
  onSecondaryAction?: () => void;
  /** Custom CSS class names */
  className?: string;
  /** Whether to show a loading state */
  isLoading?: boolean;
}

/**
 * Reusable empty state component
 * 
 * Used when no data is available (templates, conditions, etc.)
 * or when data loading/fetching fails.
 * Provides a consistent UI with optional actions.
 * 
 * @example
 * <EmptyState
 *   title="لا توجد قوالب"
 *   description="لم تنشئ أي قوالب بعد. ابدأ بإنشاء قالب جديد."
 *   actionLabel="إضافة قالب"
 *   onAction={() => openCreateModal()}
 *   icon={<TemplateIcon />}
 * />
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  message, // Backward compatibility alias
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  className = '',
  isLoading = false,
}) => {
  // Use description, fall back to message for backward compatibility
  const displayDescription = description || message;

  // Handle icon as string (FontAwesome class) or ReactNode
  const renderIcon = () => {
    if (!icon) return null;
    if (typeof icon === 'string') {
      return <i className={`fas ${icon} text-4xl text-gray-300`} />;
    }
    return icon;
  };

  if (isLoading) {
    return (
      <div className={`flex flex-col items-center justify-center py-12 ${className}`}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="mt-4 text-sm text-gray-600">جارٍ التحميل...</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 ${className}`}>
      {/* Icon section */}
      {icon && (
        <div className="mb-4 flex justify-center">
          <div className="text-6xl opacity-40">
            {renderIcon()}
          </div>
        </div>
      )}

      {/* Title */}
      <h3 className="mb-2 text-lg font-semibold text-gray-900">
        {title}
      </h3>

      {/* Description */}
      {displayDescription && (
        <p className="mb-6 max-w-sm text-center text-sm text-gray-600">
          {displayDescription}
        </p>
      )}

      {/* Actions */}
      {(actionLabel || secondaryActionLabel) && (
        <div className="flex flex-col gap-2 sm:flex-row">
          {actionLabel && (
            <button
              onClick={onAction}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
            >
              {actionLabel}
            </button>
          )}
          {secondaryActionLabel && (
            <button
              onClick={onSecondaryAction}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {secondaryActionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default EmptyState;
