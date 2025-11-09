'use client';

import React from 'react';

interface SkeletonListProps {
  /** Number of skeleton items to display */
  count?: number;
  /** Height of each skeleton item in Tailwind units (e.g., 'h-12', 'h-16') */
  itemHeight?: string;
  /** Optional custom className */
  className?: string;
  /** Whether to show as a card variant with border and shadow */
  variant?: 'simple' | 'card';
}

/**
 * Skeleton loading component for lists
 * 
 * Displays a series of placeholder "skeleton" elements while loading data.
 * Provides visual feedback that content is being fetched.
 * 
 * @example
 * {isLoading ? (
 *   <SkeletonList count={3} />
 * ) : (
 *   <TemplatesList templates={templates} />
 * )}
 */
export const SkeletonList: React.FC<SkeletonListProps> = ({
  count = 3,
  itemHeight = 'h-12',
  className = '',
  variant = 'simple',
}) => {
  const skeletonItems = Array.from({ length: count }, (_, i) => i);

  if (variant === 'card') {
    return (
      <div className={`space-y-3 ${className}`}>
        {skeletonItems.map((i) => (
          <div key={i} className="rounded-lg border border-gray-200 p-4 shadow-sm">
            <div className="space-y-2">
              <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200"></div>
              <div className="h-3 w-full animate-pulse rounded bg-gray-100"></div>
              <div className="h-3 w-5/6 animate-pulse rounded bg-gray-100"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {skeletonItems.map((i) => (
        <div
          key={i}
          className={`${itemHeight} w-full animate-pulse rounded bg-gray-200`}
        ></div>
      ))}
    </div>
  );
};

export default SkeletonList;
